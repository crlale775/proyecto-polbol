<?php

namespace App\Http\Controllers;

use App\Models\RegistroLink;
use App\Models\SolicitudRegistro;
use App\Models\Usuario;
use App\Services\ColaVerificacionIA;
use App\Services\VerificadorIA;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SolicitudRegistroController extends Controller
{
    /**
     * Lista de solicitudes de registro (panel interno).
     */
    public function index(Request $request): JsonResponse
    {
        $query = SolicitudRegistro::with(['link.rol', 'link.epi', 'rol', 'epi', 'usuarioCreado']);

        if ($request->has('estado_solicitud')) {
            $query->where('estado_solicitud', $request->input('estado_solicitud'));
        }

        if ($request->has('con_advertencia') && filter_var($request->input('con_advertencia'), FILTER_VALIDATE_BOOLEAN)) {
            $query->where('ia_advertencia', true);
        }

        if ($request->has('q')) {
            $q = $request->input('q');
            $query->where(function ($qb) use ($q) {
                $qb->where('nombres', 'ilike', "%{$q}%")
                    ->orWhere('apellidos', 'ilike', "%{$q}%")
                    ->orWhere('telefono', 'ilike', "%{$q}%")
                    ->orWhere('usuario', 'ilike', "%{$q}%")
                    ->orWhere('ci', 'ilike', "%{$q}%");
            });
        }

        $solicitudes = $query->orderByDesc('id_solicitud')->get();

        return response()->json($solicitudes);
    }

    public function show(string|int $id): JsonResponse
    {
        $solicitud = SolicitudRegistro::with(['link.rol', 'link.epi', 'link.emisor', 'rol', 'epi', 'usuarioCreado.epi'])
            ->findOrFail($id);

        return response()->json($solicitud);
    }

    /**
     * Formulario PÚBLICO de registro (el oficial llega por el link de WhatsApp).
     * Sube el memo de designación, crea la cuenta en BD (estado inactivo hasta
     * aprobación) y deja la solicitud lista para la verificación IA.
     */
    public function registrarPublico(string $token, Request $request): JsonResponse
    {
        $link = RegistroLink::with(['rol', 'epi'])
            ->where('token', $token)
            ->first();

        if (!$link || $link->estado !== 'activo') {
            return response()->json(['message' => 'El enlace de registro no es válido o ya fue utilizado.'], 404);
        }

        $validated = $request->validate([
            'nombres' => [
                'required', 'string', 'min:2', 'max:100',
                'regex:/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\']+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ\']+)*$/u',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (!self::nombreConAspectoReal((string) $value)) {
                        $fail('Ingrese NOMBRES reales (cada palabra con letras y vocales, sin texto inventado como "jadajij").');
                    }
                },
            ],
            'apellidos' => [
                'required', 'string', 'min:2', 'max:100',
                'regex:/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\']+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ\']+)*$/u',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (!self::nombreConAspectoReal((string) $value)) {
                        $fail('Ingrese APELLIDOS reales (cada palabra con letras y vocales, sin texto inventado como "jadajij").');
                    }
                },
            ],
            // CI: parte numérica de 7, 8 o 9 dígitos + complemento opcional (ej. "4892301 LP").
            'ci' => ['nullable', 'string', 'max:20', 'regex:/^[0-9]{7,9}( [A-Za-z]{1,2})?$/'],
            // Celular boliviano: EXACTAMENTE 8 dígitos, comienza en 6 o 7.
            'telefono' => ['required', 'string', 'regex:/^[67][0-9]{7}$/'],
            'usuario' => 'nullable|string|min:3|max:50|regex:/^[a-zA-Z0-9_.-]+$/',
            'password' => 'required|string|min:4',
            // Foto de perfil obligatoria: la IA debe detectar un rostro.
            'foto' => 'required|image|mimes:jpg,jpeg,png|max:5120',
            'archivo' => 'required|file|mimes:pdf|max:15360',
        ]);

        $nombres = trim($validated['nombres']);
        $apellidos = trim($validated['apellidos']);

        // Usuario de acceso: el que digita la persona o uno autogenerado único.
        $usuario = $this->usuarioUnico(
            isset($validated['usuario']) && $validated['usuario'] !== ''
                ? mb_strtolower($validated['usuario'])
                : $this->slugUsuario($nombres . ' ' . $apellidos)
        );

        // Guardar el memo de designación en storage/app/public/solicitudes
        $archivo = $request->file('archivo');
        $ruta = $archivo->storeAs('solicitudes', $token . '_' . time() . '.pdf', 'public');
        $rutaAbsoluta = storage_path('app/public/' . $ruta);
        $hashMemo = hash_file('sha256', $rutaAbsoluta);

        // Guardar la foto de perfil en storage/app/public/solicitudes/fotos
        $foto = $request->file('foto');
        $extensionFoto = strtolower($foto->getClientOriginalExtension() ?: 'jpg');
        $rutaFoto = $foto->storeAs('solicitudes/fotos', $token . '_' . time() . '.' . $extensionFoto, 'public');

        // Crear la cuenta (inactiva hasta que el panel la apruebe tras la verificación IA)
        $usuarioNuevo = Usuario::create([
            'id_rol' => $link->id_rol,
            'id_epi' => $link->id_epi,
            'usuario' => $usuario,
            'password' => Hash::make($validated['password']),
            'correo' => $usuario . '@registro.ofbol',
            'estado' => false,
            'created_at' => now(),
        ]);

        $solicitud = SolicitudRegistro::create([
            'id_link' => $link->id_link,
            'token' => $link->token,
            'id_rol' => $link->id_rol,
            'id_epi' => $link->id_epi,
            'nombres' => $nombres,
            'apellidos' => $apellidos,
            'ci' => $validated['ci'] ?? null,
            'telefono' => trim($validated['telefono']),
            'usuario' => $usuario,
            'ruta_memo' => $ruta,
            'ruta_foto' => $rutaFoto,
            'hash_memo' => $hashMemo,
            'estado_solicitud' => 'recibida',
            // EN COLA: la verificación IA arranca sola (FIFO, sin botones).
            'ia_estado' => 'en_cola',
            'id_usuario_creado' => $usuarioNuevo->id_usuario,
            'creado_en' => now(),
        ]);

        // VERIFICACIÓN AUTOMÁTICA: la solicitud queda EN COLA y se despacha un
        // worker en segundo plano que procesa la cola FIFO (memo + foto).
        // El formulario responde al instante; la IA empieza a trabajar ya.
        $this->despacharWorker();

        return response()->json([
            'message' => 'Su solicitud fue recibida y está EN COLA de verificación automática (firma, sello, identidad y foto de perfil). En cuanto la IA valide su memo podrá ingresar al sistema.',
            'solicitud' => $solicitud->load(['link.rol', 'link.epi', 'rol', 'epi']),
            'credenciales' => [
                'usuario' => $usuario,
                'rol' => $link->rol?->nombre ?? 'Usuario',
                'epi' => $link->epi?->nombre ?? null,
                'estado' => 'inactivo (en verificación)',
            ],
        ], 201);
    }

    /**
     * Ejecuta (o re-ejecuta) la verificación con la IA local.
     */
    public function verificarIA(string|int $id): JsonResponse
    {
        $solicitud = SolicitudRegistro::with(['link'])->findOrFail($id);
        $verificador = app(VerificadorIA::class);

        try {
            $resultado = $this->ejecutarVerificacion($solicitud, $verificador);
        } catch (\Throwable $e) {
            $solicitud->ia_estado = 'error';
            $solicitud->ia_mensaje = $e->getMessage();
            $solicitud->save();

            return response()->json([
                'message' => 'No se pudo completar la verificación con la IA local.',
                'solicitud' => $solicitud->load(['link.rol', 'link.epi', 'usuarioCreado']),
            ], 502);
        }

        return response()->json([
            'message' => $resultado['advertencia']
                ? 'Verificación completada con ADVERTENCIAS.'
                : 'Verificación completada correctamente.',
            'solicitud' => $solicitud->load(['link.rol', 'link.epi', 'usuarioCreado']),
        ]);
    }

    /**
     * Aprueba la solicitud y ACTIVA la cuenta del oficial registrado.
     */
    public function aprobar(string|int $id): JsonResponse
    {
        $solicitud = SolicitudRegistro::findOrFail($id);

        $usuario = $solicitud->id_usuario_creado
            ? Usuario::find($solicitud->id_usuario_creado)
            : null;

        if (!$usuario) {
            return response()->json(['message' => 'La cuenta de este registro ya no existe en el sistema.'], 422);
        }

        $usuario->estado = true;
        $usuario->save();

        $solicitud->estado_solicitud = 'aprobada';
        $solicitud->resuelto_en = now();
        $solicitud->save();

        if ($solicitud->link) {
            $solicitud->link->estado = 'usado';
            $solicitud->link->save();
        }

        return response()->json([
            'message' => "Registro aprobado. La cuenta '{$usuario->usuario}' quedó ACTIVADA para ingresar al sistema.",
            'solicitud' => $solicitud->load(['link.rol', 'link.epi', 'usuarioCreado']),
        ]);
    }

    /**
     * Rechaza la solicitud (la cuenta permanece inactiva).
     */
    public function rechazar(string|int $id, Request $request): JsonResponse
    {
        $solicitud = SolicitudRegistro::findOrFail($id);

        $validated = $request->validate([
            'observacion' => 'required|string|min:3|max:500',
        ]);

        $solicitud->estado_solicitud = 'rechazada';
        $solicitud->observacion = $validated['observacion'];
        $solicitud->resuelto_en = now();
        $solicitud->save();

        return response()->json([
            'message' => 'Solicitud rechazada. La cuenta quedó inactiva.',
            'solicitud' => $solicitud->load(['link.rol', 'link.epi', 'usuarioCreado']),
        ]);
    }

    /**
     * Ejecuta la verificación IA (memo + foto de perfil) y persiste el resultado.
     * Usada por el botón de re-verificación del panel y por la cola FIFO.
     */
    protected function ejecutarVerificacion(SolicitudRegistro $solicitud, VerificadorIA $verificador): array
    {
        $rutaAbsoluta = storage_path('app/public/' . $solicitud->ruta_memo);

        $resultado = $verificador->analizar($rutaAbsoluta, [
            'nombres' => $solicitud->nombres,
            'apellidos' => $solicitud->apellidos,
        ]);

        $advertencia = $resultado['coincide'] === false
            || !$resultado['firma']
            || !$resultado['sello'];

        // Verificación de rostro en la foto de perfil (si existe).
        $mensajeRostro = '';
        $esRostro = null;
        if ($solicitud->ruta_foto) {
            $rutaFoto = storage_path('app/public/' . $solicitud->ruta_foto);
            if (is_file($rutaFoto)) {
                try {
                    $rostro = $verificador->analizarRostro($rutaFoto);
                    $esRostro = $rostro['es_rostro'];
                    $mensajeRostro = ' ' . $rostro['mensaje'];
                    if (!$esRostro) {
                        $advertencia = true;
                    }
                } catch (\Throwable) {
                    $mensajeRostro = ' No se pudo verificar la foto de perfil.';
                }
            }
        }

        $solicitud->ia_firma = $resultado['firma'];
        $solicitud->ia_sello = $resultado['sello'];
        $solicitud->ia_nombres = json_encode($resultado['nombres'], JSON_UNESCAPED_UNICODE);
        $solicitud->ia_coincide = $resultado['coincide'];
        $solicitud->ia_rostro = $esRostro;
        $solicitud->ia_advertencia = $advertencia;
        $solicitud->ia_mensaje = ($resultado['mensaje'] ?? '') . $mensajeRostro;
        $solicitud->ia_estado = 'procesada';
        $solicitud->ia_verificado_en = now();
        if (!$advertencia && $solicitud->estado_solicitud === 'recibida') {
            $solicitud->estado_solicitud = 'verificada';
        }
        $solicitud->save();

        return array_merge($resultado, ['advertencia' => $advertencia]);
    }

    /**
     * Despacha el worker de la cola IA en segundo plano (sin bloquear la
     * respuesta del formulario). En Windows (Laragon) se lanza vía cmd `start /B`;
     * en Linux/production, un proceso desvinculado con `&`.
     */
    protected function despacharWorker(): void
    {
        try {
            $php = PHP_BINARY ?: 'php';
            $artisan = base_path('artisan');

            if (stripos(PHP_OS_FAMILY, 'WIN') === 0) {
                // Windows: popen ejecuta vía cmd.exe; `start "" /B` lanza el
                // proceso desvinculado (el primer "" es el título de ventana:
                // sin él, start trataría la ruta del PHP como título y no
                // ejecutaría nada). Una pasada completa de la cola por despacho.
                $cmd = 'start "" /B ' . escapeshellarg($php) . ' ' . escapeshellarg($artisan) . ' ia:procesar-cola';
                pclose(popen($cmd, 'r'));
            } else {
                $cmd = escapeshellarg($php) . ' ' . escapeshellarg($artisan) . ' ia:procesar-cola > /dev/null 2>&1 &';
                exec($cmd);
            }
        } catch (\Throwable) {
            // Si el dispatch falla (p. ej. hosting restringido), la solicitud
            // queda 'en_cola' y el daemon de Laragon la tomará luego.
        }
    }

    /**
     * Heurística anti-basura para nombres/apellidos: rechaza tokens sin
     * vocales ("jijj"), tokens de 1-2 letras sin ser partículas válidas,
     * repeticiones obvias y ruido de teclado.
     */
    public static function nombreConAspectoReal(string $nombreCompleto): bool
    {
        $particulas = ['de', 'del', 'la', 'el', 'los', 'las', 'y', 'san', 'santa', "d'", 'da', 'di', 'do', 'von', 'van', 'mc', 'mac'];
        $tokens = preg_split('/\s+/', trim($nombreCompleto), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if (count($tokens) === 0) {
            return false;
        }

        foreach ($tokens as $token) {
            $t = mb_strtolower(trim($token, " .,;:'\"-"), 'UTF-8');
            $t = str_replace(['á','é','í','ó','ú','ü','ñ'], ['a','e','i','o','u','u','n'], $t);
            if ($t === '') {
                continue;
            }

            // Partículas válidas (de, del, la...) pueden ser cortas.
            if (in_array($t, $particulas, true)) {
                continue;
            }

            // Debe tener al menos 3 caracteres.
            if (mb_strlen($t) < 3) {
                return false;
            }

            // Debe tener al menos 2 vocales o combinación consonante+vocal variada.
            $vocales = preg_match_all('/[aeiou]/', $t);
            $unicos = count(count_chars($t, 1) ? array_unique(str_split($t)) : []);
            if ($vocales < 2 && $unicos < 3) {
                return false;
            }

            // No puede ser una sola letra repetida (ej. "aaaa", "jjjj").
            if (preg_match('/^(.)\1+$/u', $t)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Genera un nombre de usuario legible a partir del nombre completo.
     */
    protected function slugUsuario(string $nombreCompleto): string
    {
        $slug = Str::slug($nombreCompleto, '');
        if ($slug === '') {
            $slug = 'usuario' . Str::lower(Str::random(5));
        }

        return mb_substr($slug, 0, 50);
    }

    /**
     * Asegura que el nombre de usuario no exista aún (agrega sufijo numérico).
     */
    protected function usuarioUnico(string $base): string
    {
        $candidato = $base;
        for ($i = 1; $i <= 12; $i++) {
            if (!Usuario::where('usuario', $candidato)->exists()) {
                return $candidato;
            }
            $candidato = mb_substr($base, 0, 46) . $i;
        }

        return mb_substr($base, 0, 40) . Str::lower(Str::random(6));
    }
}
