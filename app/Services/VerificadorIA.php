<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * VerificadorIA — Cliente de la IA LOCAL (LM Studio) que analiza el memorándum
 * de designación subido en el formulario público de registro.
 *
 * Servidor: LM Studio → http://127.0.0.1:1234  (configurable en .env)
 *   Modelo:  qwen/qwen2.5-vl-7b (visión, 7B — MODELO ÚNICO para todo)
 *   Endpoint: POST /api/v1/chat
 *   Body: {
 *     "model": "qwen2-vl-2b-instruct",
 *     "temperature": 0,
 *     "input": [
 *       {"type": "text",  "content": "instrucciones + JSON esperado"},
 *       {"type": "image", "data_url": "data:image/png;base64,<imagen>"},
 *     ]
 *   }
 *   Respuesta: { "output": [ { "type": "message", "content": "..." } ] }
 *
 * Estrategia de consulta (probada en vivo con qwen2-vl-2b):
 *   - El modelo de 2B responde JSON confiable con UNA o DOS imágenes; con más
 *     tiende a narrar o a evaluar solo la última.
 *   - Los prompts de "identificar/resumir" inducen al modelo a recortar el
 *     nombre (devuelve solo el primer nombre). La tarea que funciona es la
 *     COPIA VERBATIM: pedir que copie exactamente la línea del destinatario
 *     (bloque "Al Señor(a): ... Presente.-"), palabra por palabra.
 *   - Las preguntas binarias de presencia ("¿está escrito X?") NO sirven: el
 *     modelo 2B contesta "true" casi siempre (sesgo de sí).
 *   - Por eso la identidad se decide comparando LOCALMENTE el nombre copiado
 *     del memo contra el nombre registrado, sin pedirle opinión a la IA.
 *
 * MODELO ÚNICO: qwen2.5-vl-7b (IA_MODEL) responde TODAS las consultas.
 * Ya no se alterna entre modelos: intercambiarlos en caliente en LM Studio
 * (descargar 6 GB → cargar otro → ...) era la causa de verificaciones de 4+
 * minutos y de timeouts sin respuesta.
 *
 * Pipeline por verificación (optimizado para velocidad con el 7B):
 *   1) NOMBRES: UNA consulta con la PÁGINA COMPLETA (la más barata); si no
 *      coincide, mitad inferior; como último recurso, mitad superior.
 *   2) FIRMA/SELLO: UNA consulta con la página completa; solo si falta algo,
 *      mitades inferior y superior como respaldo (corte temprano al tener
 *      ambos). Antes eran hasta 7 consultas secuenciales; ahora típicamente 2.
 *   3) Decisión local de identidad + reglas de negocio (normalizar()).
 *
 * Configuración (.env): IA_URL, IA_ENDPOINT, IA_MODEL, IA_TIMEOUT,
 * IA_MAX_PAGINAS, IA_DPI.
 */
class VerificadorIA
{
    /** Registro de consultas de la verificación en curso (para el log). */
    protected array $consultas = [];

    public function __construct(protected PdfPaginas $paginas)
    {
    }

    public function disponible(): bool
    {
        return config('ia.url') !== '' && config('ia.model') !== '';
    }

    public function url(): string
    {
        return rtrim((string) config('ia.url'), '/');
    }

    /**
     * Analiza un PDF (memo de designación) y devuelve el resultado normalizado.
     *
     * @param  string  $rutaAbsoluta  Ruta absoluta al PDF en storage.
     * @param  array   $esperado      ['nombres' => ..., 'apellidos' => ...]
     * @return array{firma:bool,sello:bool,nombres:array,coincide:bool|null,mensaje:string|null,raw:array}
     */
    public function analizar(string $rutaAbsoluta, array $esperado = []): array
    {
        if (!$this->disponible()) {
            throw new RuntimeException(
                'La IA local no está configurada. Defina IA_URL e IA_MODEL en el archivo .env (ej. http://127.0.0.1:1234 y qwen2-vl-2b-instruct).'
            );
        }

        // 1. Convertir páginas del PDF a imágenes (vista completa + recortes 2x2).
        $paginas = $this->paginas->renderizar($rutaAbsoluta);
        if (count($paginas) === 0) {
            throw new RuntimeException('El PDF no pudo convertirse a imágenes para la verificación.');
        }

        $nombreEsperado = trim(($esperado['nombres'] ?? '') . ' ' . ($esperado['apellidos'] ?? ''));
        $contenidos = [];

        // 2. Copia verbatim del destinatario (sin mencionar el nombre registrado:
        //    un modelo pequeño repetiría el nombre que le dan en vez de leer).
        $nombresRaw = $this->consultarDestinatario($paginas, $contenidos, $nombreEsperado);

        // 3. Decisión de identidad 100% local (la IA solo copia texto).
        $limpios = $this->nombresLimpiosDe($nombresRaw);
        if ($nombreEsperado !== '') {
            $nombresRaw['coincide'] = count($limpios) > 0
                ? $this->coinciden($nombreEsperado, $limpios)
                : false; // destinatario ilegible → revisión manual (advertencia)
        }

        // 4. FIRMA/SELLO por cuadrante (1 imagen por consulta, resultado con OR).
        [$firma, $sello] = $this->consultarFirmaSello($paginas, $contenidos);

        $raw = array_merge($nombresRaw, ['firma' => $firma, 'sello' => $sello]);

        $resultado = $this->normalizar($raw, $esperado, implode("\n---\n", $contenidos));
        $this->registrarResumen('registro_publico');

        return $resultado;
    }

    /**
     * Modelo para leer nombres del destinatario (y todo lo demás).
     *
     * MODELO ÚNICO: qwen2.5-vl-7b (IA_MODEL). Un solo modelo visionario carga
     * en LM Studio y responde nombre + firma + sello; intercambiar modelos en
     * caliente (2B → 9B → 2B) obligaba a LM Studio a descargar/recargar pesos
     * (6 GB) en cada verificación y era la causa de los intentos de 4+ minutos.
     * El 7B es el mejor lector de OCR de escaneos reales de los disponibles
     * (probado: lee "Estela Huallpa Mamani" donde el 2B leía "Sofia Mariani").
     */
    protected function modeloParaNombre(array $paginas): ?string
    {
        $modelo = (string) config('ia.model', '');
        if ($modelo === '') {
            return null;
        }

        // Comprobación rápida de que el modelo está disponible en el servidor.
        try {
            $r = Http::timeout(20)->asJson()->get($this->url() . '/v1/models');
            $ids = collect($r->json('data', []) ?? [])->pluck('id');
            if ($ids->contains($modelo)) {
                return $modelo;
            }
        } catch (\Throwable) {
            // no hacer nada: se intentará igualmente con el modelo configurado
        }

        return null;
    }

    /**
     * Copia verbatim el nombre del destinatario del memo.
     *
     * Estrategia (siempre con el modelo único IA_MODEL, ej. qwen2.5-vl-7b):
     *   1. Mitad superior (recortes c1_1 + c1_2 juntos): el bloque destinatario
     *      suele estar arriba. Si la lectura coincide con el nombre registrado,
     *      se acepta de inmediato (sin gastar más consultas).
     *   2. Si leyó algo pero NO coincide, reintenta con la página completa y
     *      luego con la mitad inferior; se queda la mejor lectura.
     * NUNCA se pasa el nombre registrado en el prompt.
     */
    protected function consultarDestinatario(array $paginas, array &$contenidos, string $nombreEsperado = ''): array
    {
        $grupos = $this->agruparPrimeraPagina($paginas);

        $modeloNombre = $this->modeloParaNombre($paginas);
        $texto = 'En esta imagen hay un MEMORÁNDUM institucional de la Policía Boliviana '
            . '(escaneado o fotografiado; puede estar rotado). Busca el bloque del DESTINATARIO que '
            . 'empieza después de "Al Señor(a):" o "A la Señora:" y termina antes de "Presente.-". '
            . 'Copia EXACTAMENTE el NOMBRE COMPLETO de la persona destinataria (nombres y apellidos), '
            . 'sin grados militares (como "Sof.", "Sgto.", "Cnl.", "2do"), sin cargos ni '
            . 'dependencias. Si hay varias líneas, copia solo la que contiene el nombre de la persona. '
            . 'Si no puedes leerla, responde {"destinatario": null}. '
            . 'Respuesta SOLO con JSON válido: {"destinatario": "<nombre copiado>"}.';

        // Sin modelo disponible: último intento con la mitad inferior.
        if ($modeloNombre === null) {
            $lecturaBaja = $this->intentarMitadInferior($grupos, $texto, $nombreEsperado, $contenidos);
            return ['destinatario' => $lecturaBaja];
        }

        $timeoutBase = max(90, (int) config('ia.timeout_fallback', 120));
        $primeraLectura = null;

        // 1) PÁGINA COMPLETA: una sola consulta con la vista completa. Con el
        //    7B suele bastar para leer el bloque destinatario y es la consulta
        //    MÁS RÁPIDA (1 imagen, sin recortes). Si la lectura coincide con el
        //    nombre registrado, se acepta de inmediato sin más consultas.
        $full = $grupos['full'][0] ?? null;
        if ($full !== null) {
            try {
                $contenido = $this->consultar([$full], $texto, $modeloNombre, $timeoutBase);
                $contenidos[] = '[destinatario/full] ' . $contenido;
                $destinatario = $this->extraerDestinatario($contenido);
                if ($destinatario !== null) {
                    if ($nombreEsperado === '' || $this->coinciden($nombreEsperado, [$destinatario])) {
                        return ['destinatario' => $destinatario];
                    }
                    // Leyó algo pero no coincide: se guarda y se compara con la
                    // lectura de la mitad inferior.
                    $primeraLectura = $destinatario;
                }
            } catch (\Throwable) {
                // se intenta con los recortes
            }
        }

        // 2) MITAD INFERIOR (c21 + c22): el bloque destinatario a veces cae
        //    por debajo del centro de la hoja.
        $lecturaBaja = $this->intentarMitadInferior($grupos, $texto, $nombreEsperado, $contenidos);
        if ($lecturaBaja !== null) {
            if ($primeraLectura === null || $this->esMejorLectura($lecturaBaja, $primeraLectura, $nombreEsperado)) {
                return ['destinatario' => $lecturaBaja];
            }
            return ['destinatario' => $primeraLectura];
        }

        // 3) Último recurso: MITAD SUPERIOR (c11 + c12) solo si la página
        //    completa no leyó nada.
        if ($primeraLectura === null) {
            $imagenes = array_values(array_filter(array_merge($grupos['c11'], $grupos['c12'])));
            if (count($imagenes) > 0) {
                try {
                    $contenido = $this->consultar($imagenes, $texto, $modeloNombre, $timeoutBase);
                    $contenidos[] = '[destinatario/mitad_superior] ' . $contenido;
                    $destinatario = $this->extraerDestinatario($contenido);
                    if ($destinatario !== null) {
                        return ['destinatario' => $destinatario];
                    }
                } catch (\Throwable) {
                    // sin lectura
                }
            }
        }

        return ['destinatario' => $primeraLectura];
    }

    /**
     * Último intento: mitad inferior de la página (los memos escaneados a veces
     * traen el bloque destinatario por debajo del centro). Devuelve la lectura
     * válida o null.
     */
    protected function intentarMitadInferior(array $grupos, string $texto, string $nombreEsperado, array &$contenidos): ?string
    {
        $imagenes = array_values(array_filter(array_merge($grupos['c21'], $grupos['c22'])));
        if (count($imagenes) === 0) {
            return null;
        }

        try {
            $contenido = $this->consultar($imagenes, $texto);
            $contenidos[] = "[destinatario/mitad_inferior] " . $contenido;
            $destinatario = $this->extraerDestinatario($contenido);
            if ($destinatario !== null) {
                if ($nombreEsperado === '' || $this->coinciden($nombreEsperado, [$destinatario])) {
                    return $destinatario;
                }
                return $destinatario; // lectura no coincidente: la decide analizar()
            }
        } catch (\Throwable) {
            // sin lectura
        }

        return null;
    }

    /**
     * Decide si $nueva es mejor candidato que $actual para ser la lectura del
     * destinatario.
     *
     * Criterios:
     *   - Si el nombre esperado coincide con $nueva y no con $actual, gana $nueva.
     *   - Si $nueva tiene más palabras que $actual, es más probable que sea el
     *     nombre completo (el 2B a veces devuelve solo un nombre corto).
     *   - Si $actual parece alucinación (muy corto, o palabras sospechosas),
     *     gana $nueva si tiene aspecto de nombre.
     */
    protected function esMejorLectura(string $nueva, string $actual, string $nombreEsperado): bool
    {
        if ($this->coinciden($nombreEsperado, [$nueva]) && !$this->coinciden($nombreEsperado, [$actual])) {
            return true;
        }

        $palabrasNueva = count(preg_split('/\s+/', trim($nueva)) ?: []);
        $palabrasActual = count(preg_split('/\s+/', trim($actual)) ?: []);
        if ($palabrasNueva > $palabrasActual) {
            return true;
        }

        // Si el actual parece placeholder o texto del prompt, la nueva gana.
        $bajoActual = mb_strtolower($actual, 'UTF-8');
        if (str_contains($bajoActual, 'texto copiado') || str_contains($bajoActual, '<nombre copiado>') || str_contains($bajoActual, 'destinatario')) {
            return true;
        }

        return false;
    }

    /**
     * Extrae el destinatario de la respuesta cruda de la IA, descartando
     * respuestas sospechosas (placeholder copiado del prompt, "null" literal,
     * texto narrativo, nombres de campos, etc.).
     */
    protected function extraerDestinatario(string $contenido): ?string
    {
        $json = $this->extraerJson($contenido);
        $candidato = $json['destinatario'] ?? null;
        if ($candidato === null || !is_string($candidato)) {
            return null;
        }

        $candidato = trim($candidato);
        if ($candidato === '') {
            return null;
        }

        // Respuestas que revelan que la IA no leyó (copió el ejemplo o narró).
        $sospechoso = [
            'texto copiado', 'nombre copiado', 'destinatario', 'la persona', 'no se puede',
            'no puedo', 'no se encuentra', 'no se encontro', 'no hay', 'null', 'ninguno',
            'no legible', 'ilegible', 'desconocido', 'no aplica', 'n/a', 'nadie',
            'no identific', 'no logro', 'no pude', 'no pudo', 'imposible', 'sin datos',
        ];
        $bajo = mb_strtolower($candidato, 'UTF-8');
        foreach ($sospechoso as $s) {
            if (str_contains($bajo, $s)) {
                return null;
            }
        }

        // Debe parecer un nombre: al menos 2 palabras y al menos una letra mayúscula
        // (o ser todo mayúsculas como suele aparecer en los memos).
        if (preg_match('/[A-ZÁÉÍÓÚÑ]/u', $candidato) !== 1 && mb_strtoupper($candidato, 'UTF-8') !== $candidato) {
            return null;
        }
        $palabras = preg_split('/\s+/', trim($candidato)) ?: [];
        if (count($palabras) < 2) {
            return null;
        }

        return $candidato;
    }

    /**
     * Separa las imágenes de la primera página por cuadrantes.
     *
     * @return array{full:array,c11:array,c12:array,c21:array,c22:array}
     */
    protected function agruparPrimeraPagina(array $paginas): array
    {
        $grupos = ['full' => [], 'c11' => [], 'c12' => [], 'c21' => [], 'c22' => []];
        $prefijo = 'pagina_1';

        foreach ($paginas as $pagina) {
            $nombre = (string) ($pagina['archivo'] ?? '');
            if (str_starts_with($nombre, $prefijo . '_c')) {
                // "pagina_1_c1_1.png" → "11", "pagina_1_c1_2.png" → "12", ...
                $clave = substr($nombre, strlen($prefijo) + 2); // "1_1.png"
                $clave = str_replace(['_1.png', '_2.png', '.png'], ['1', '2', ''], $clave);
                $clave = str_replace('_', '', $clave);
                if (isset($grupos['c' . $clave])) {
                    $grupos['c' . $clave][] = $pagina['data_url'];
                }
            } elseif (str_starts_with($nombre, $prefijo . '.png')) {
                $grupos['full'][] = $pagina['data_url'];
            }
        }

        return $grupos;
    }

    /**
     * Consultas individuales (una imagen por consulta) de firma y sello en los
     * cuatro cuadrantes; el resultado se combina con OR.
     *
     * @return array{0: bool, 1: bool}
     */
    protected function consultarFirmaSello(array $paginas, array &$contenidos): array
    {
        $grupos = $this->agruparPrimeraPagina($paginas);

        $texto = 'Recorte ampliado de un memorándum. Responde SOLO con JSON válido y sin texto adicional: '
            . '{"firma": true si hay una FIRMA manuscrita (rúbrica de tinta) sobre o junto al nombre '
            . 'impreso de la autoridad, false si no, y "sello": true si hay un SELLO/timbre institucional '
            . 'circular de tinta morada/azul/roja, false si no}. Escribe ambos campos en un único objeto.';

        $firma = false;
        $sello = false;

        $procesar = function (array $imagenes, string $etiqueta) use (&$firma, &$sello, $texto, &$contenidos): void {
            $imagen = $imagenes[0] ?? null;
            if (!$imagen) {
                return;
            }
            try {
                $contenido = $this->consultar([$imagen], $texto);
                $contenidos[] = "[{$etiqueta}] " . $contenido;
                $json = $this->extraerJson($contenido);
                if ($json !== null) {
                    if (!empty($json['firma'])) {
                        $firma = true;
                    }
                    if (!empty($json['sello'])) {
                        $sello = true;
                    }
                }
            } catch (\Throwable) {
                // una imagen que falle no debe tumbar la verificación
            }
        };

        // 1) PÁGINA COMPLETA: 1 consulta. La firma y el sello son elementos
        //    grandes; el 7B los detecta en la vista completa la mayoría de las
        //    veces. (Antes se consultaba cuadrante por cuadrante: hasta 4.)
        $procesar($grupos['full'], 'firma_sello/full');

        // 2) Solo si falta algo: mitad inferior (c21 + c22), donde suelen
        //    estar la firma y el sello.
        foreach (['c21' => $grupos['c21'], 'c22' => $grupos['c22']] as $clave => $imagenes) {
            if ($firma && $sello) {
                break;
            }
            $procesar($imagenes, $clave);
        }

        // 3) Último recurso: mitad superior (c11 + c12).
        if (!($firma && $sello)) {
            foreach (['c11' => $grupos['c11'], 'c12' => $grupos['c12']] as $clave => $imagenes) {
                if ($firma && $sello) {
                    break;
                }
                $procesar($imagenes, $clave);
            }
        }

        return [$firma, $sello];
    }

    /**
     * Envía una consulta multimodal a LM Studio y devuelve el contenido textual.
     *
     * @param  array<int, string>  $dataUrls
     */
    protected function consultar(array $dataUrls, string $texto, ?string $modelo = null, ?int $timeout = null): string
    {
        $input = [['type' => 'text', 'content' => $texto]];
        foreach ($dataUrls as $dataUrl) {
            $input[] = ['type' => 'image', 'data_url' => $dataUrl];
        }

        $endpoint = $this->url() . '/' . ltrim((string) config('ia.endpoint', '/api/v1/chat'), '/');
        $inicio = microtime(true);

        try {
            $response = Http::timeout(min($timeout ?? (int) config('ia.timeout', 120), 180))
                ->asJson()
                ->post($endpoint, [
                    'model' => $modelo ?? (string) config('ia.model'),
                    'temperature' => 0,
                    'input' => $input,
                ]);
        } catch (\Throwable $e) {
            $this->registrarConsulta(count($dataUrls), $modelo, microtime(true) - $inicio, 'error');
            throw new RuntimeException('No se pudo contactar a la IA local (' . $this->url() . '): ' . $e->getMessage());
        }

        $duracion = microtime(true) - $inicio;

        if ($response->failed()) {
            $this->registrarConsulta(count($dataUrls), $modelo, $duracion, 'http_' . $response->status());
            $detalle = $response->json('error.message') ?? $response->json('error') ?? $response->body();
            throw new RuntimeException(
                'La IA local respondió con error HTTP ' . $response->status() . ': ' .
                (is_string($detalle) ? mb_substr($detalle, 0, 300) : 'verifique que LM Studio tenga cargado el modelo de visión configurado en IA_MODEL.')
            );
        }

        $this->registrarConsulta(count($dataUrls), $modelo, $duracion, 'ok');

        $output = $response->json('output');
        $contenido = '';
        if (is_array($output)) {
            foreach ($output as $bloque) {
                if (is_array($bloque) && ($bloque['type'] ?? null) === 'message' && isset($bloque['content'])) {
                    $contenido .= $bloque['content'];
                }
            }
        }

        return trim((string) $contenido);
    }

    /**
     * Registra una consulta individual a la IA en el log (para auditar cuántas
     * consultas hace cada verificación y cuánto tarda cada una).
     */
    protected function registrarConsulta(int $nImagenes, ?string $modelo, float $duracion, string $estado = 'ok'): void
    {
        $this->consultas[] = [
            'imagenes' => $nImagenes,
            'modelo' => $modelo ?: (string) config('ia.model'),
            'duracion' => round($duracion, 1),
            'estado' => $estado,
        ];

        Log::info(sprintf(
            '[VerificadorIA] consulta #%d: %d imagen(es), modelo %s, %s → %.1f s',
            count($this->consultas),
            $nImagenes,
            $modelo ?: (string) config('ia.model'),
            $estado,
            $duracion
        ));
    }

    /**
     * Registra el resumen de una verificación completa (flujo + nº de consultas
     * + duración total) para saber de un vistazo cuánto costó cada proceso.
     */
    protected function registrarResumen(string $flujo): void
    {
        $total = count($this->consultas);
        $duracion = array_sum(array_column($this->consultas, 'duracion'));
        $imagenes = array_sum(array_column($this->consultas, 'imagenes'));

        Log::info(sprintf(
            '[VerificadorIA] RESUMEN %s: %d consulta(s), %d imagen(es) enviadas, duración total %.1f s',
            $flujo,
            $total,
            $imagenes,
            $duracion
        ));

        $this->consultas = [];
    }

    /**
     * Extrae el primer objeto JSON de una cadena (tolerante a código fence).
     */
    protected function extraerJson(string $texto): ?array
    {
        $texto = trim($texto);
        $texto = preg_replace('/^```(?:json)?/i', '', $texto);
        $texto = preg_replace('/```$/', '', $texto);
        $texto = trim((string) $texto);

        $inicio = strpos($texto, '{');
        if ($inicio === false) {
            return null;
        }
        $texto = substr($texto, $inicio);

        $decodificado = json_decode($texto, true);
        if (is_array($decodificado)) {
            return $decodificado;
        }

        // Equilibrio de llaves (fallback)
        $profundidad = 0;
        $fin = null;
        for ($i = 0; $i < strlen($texto); $i++) {
            if ($texto[$i] === '{') {
                $profundidad++;
            } elseif ($texto[$i] === '}') {
                $profundidad--;
                if ($profundidad === 0) {
                    $fin = $i + 1;
                    break;
                }
            }
        }
        if ($fin !== null) {
            $decodificado = json_decode(substr($texto, 0, $fin), true);
            if (is_array($decodificado)) {
                return $decodificado;
            }
        }

        return null;
    }

    /**
     * Normaliza la respuesta a la estructura interna y aplica las reglas de
     * negocio (advertencias de identidad, firma y sello). La identidad ya fue
     * decidida localmente en analizar(); aquí solo se cubren los casos límite.
     */
    protected function normalizar(array $raw, array $esperado = [], string $respuestaCruda = ''): array
    {
        $firma = $raw['firma'] ?? $raw['tiene_firma'] ?? false;
        $sello = $raw['sello'] ?? $raw['tiene_sello'] ?? false;

        $destinatario = $raw['destinatario'] ?? null;
        $nombres = $this->nombresLimpiosDe($raw);

        $coincide = $raw['coincide'] ?? $raw['coincidencia_nombre'] ?? null;
        $mensaje = $raw['mensaje'] ?? null;

        $esperadoCompleto = trim(($esperado['nombres'] ?? '') . ' ' . ($esperado['apellidos'] ?? ''));
        $identidadLegible = count($nombres) > 0;

        // Caso límite: no se pudo leer el destinatario del memo → no se puede
        // confirmar la identidad; advertencia para revisión manual (nunca se
        // activa una cuenta sin poder vincularla al memo).
        if ($coincide === null && $esperadoCompleto !== '' && !$identidadLegible) {
            $coincide = false;
        }

        // Mensajes de advertencia acumulativos (identidad, firma y sello).
        $advertencias = [];
        if ($coincide === false) {
            if ($esperadoCompleto !== '' && !$identidadLegible) {
                $advertencias[] = sprintf(
                    'ADVERTENCIA DE IDENTIDAD: no se pudo leer el nombre del destinatario del memo '
                    . '(bloque "Al Señor(a):"), por lo que no se puede confirmar que %s sea la persona '
                    . 'designada. Revisar el documento adjunto antes de aprobar.',
                    $esperadoCompleto
                );
            } else {
                $detectados = $identidadLegible ? implode(', ', $nombres) : 'sin nombres legibles';
                $advertencias[] = sprintf(
                    'ADVERTENCIA DE IDENTIDAD: la persona registrada (%s) NO tiene relación con el/los '
                    . 'nombre(s) del memo de designación (%s).',
                    $esperadoCompleto !== '' ? $esperadoCompleto : 'registro',
                    $detectados
                );
            }
        }
        if (!$firma) {
            $advertencias[] = 'No se detectó la FIRMA en el memo de designación.';
        }
        if (!$sello) {
            $advertencias[] = 'No se detectó el SELLO institucional en el memo de designación.';
        }

        $mensaje = count($advertencias) > 0
            ? implode(' ', $advertencias)
            : ($mensaje ?: 'Documento verificado correctamente: firma y sello detectados e identidad coherente con el memo.');

        return [
            'firma' => (bool) $firma,
            'sello' => (bool) $sello,
            'nombres' => $nombres,
            'destinatario' => is_string($destinatario) && trim($destinatario) !== ''
                ? $this->limpiarNombre($destinatario)
                : null,
            'autoridad' => null,
            'coincide' => $coincide,
            'mensaje' => $mensaje,
            'raw' => ['respuesta_ia' => $respuestaCruda, 'datos' => $raw],
        ];
    }

    /**
     * Devuelve los nombres detectados ya limpios (sin grados ni cargos).
     */
    protected function nombresLimpiosDe(array $raw): array
    {
        $destinatario = $raw['destinatario'] ?? $raw['destinatario_nombre']
            ?? $raw['designado'] ?? $raw['designada'] ?? $raw['persona'] ?? null;
        $nombres = $raw['nombres'] ?? $raw['nombres_detectados'] ?? $raw['personas'] ?? [];
        if (is_string($nombres)) {
            $nombres = preg_split('/[,;|\n]+/', $nombres) ?: [];
        }
        $nombres = array_values(array_filter(array_map('trim', (array) $nombres)));
        if ($destinatario !== null && trim((string) $destinatario) !== '') {
            array_unshift($nombres, trim((string) $destinatario));
        }

        return array_values(array_filter(array_map(
            fn ($n) => $this->limpiarNombre((string) $n),
            $nombres
        ), fn ($n) => $n !== ''));
    }

    /**
     * Elimina grados militares (Sgt., Cnl., 2do., ...), cargos y palabras de
     * relleno de un nombre detectado para quedarse solo con nombres/apellidos.
     */
    protected function limpiarNombre(string $nombre): string
    {
        $nombre = trim($nombre);
        if ($nombre === '') {
            return '';
        }

        $desacentuar = function (string $s): string {
            return str_replace(
                ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', 'Á', 'É', 'Í', 'Ó', 'Ú', 'Ü', 'Ñ'],
                ['a', 'e', 'i', 'o', 'u', 'u', 'n', 'A', 'E', 'I', 'O', 'U', 'U', 'N'],
                $s
            );
        };

        $stop = [
            // grados y jerarquía policial/militar
            'sgt', 'sgto', 'sarg', 'sargento', 'cbo', 'cabo', 'cnl', 'coronel', 'tcnl',
            'teniente', 'cap', 'capitan', 'capitán', 'tte', 'sbtte', 'subtte', 'subteniente',
            'gral', 'general', 'mgr', 'msc', 'magister', 'dr', 'dra', 'lic', 'licenciado',
            'cad', 'cadete', 'oficial', 'suboficial', 'sof', 'sdo', 'alumno', 'egresado',
            '2do', '2°', '1ro', '1er', '1°', '3ro', '4to', '5to', '6to', '7mo', '8vo', '9no',
            // fórmulas de tratamiento
            'sr', 'sra', 'srta', 'senor', 'senora', 'senorita', 'usted', 'presente',
            // cargos e institucionales que a veces se cuelan
            'seguridad', 'interna', 'custodio', 'custodios', 'encargada', 'encargado',
            'centro', 'orientacion', 'femenina', 'obrajes', 'direccion', 'subdireccion',
            'nacional', 'regimen', 'penitenciario', 'policia', 'boliviana', 'designacion',
            // dependencias / secciones que aparecen junto al destinatario
            'seg', 'seccion', 'sección', 'externa', 'externo', 'miraflores', 'cpf', 'c.p.f.',
            'kardex', 'filiacion', 'division', 'custodia', 'privada', 'libertad',
            'agente', 'agentes', 'servicio', 'servicios', 'unidad', 'unidades', 'epi', 'eps',
            'destacamento', 'brigada', 'comando', 'departamental', 'regional', 'nivel', 'central',
            'cuartel', 'prefectura', 'oficina', 'oficinas', 'jefatura', 'subjefatura', 'mando',
            'personal', 'administrativo', 'administrativa', 'plantel', 'tropa', 'clase', 'clases',
            // conectores
            'de', 'del', 'la', 'el', 'los', 'las', 'y', 'a', 'en', 'por', 'para', 'al', 'con', 'su',
        ];
        $stop = array_map($desacentuar, $stop);
        $stopSet = array_flip($stop);

        $tokens = preg_split('/\s+/', $desacentuar($nombre)) ?: [];
        $limpios = [];
        foreach ($tokens as $tok) {
            $tok = trim($tok, " .,;:()/-\t");
            if ($tok === '') {
                continue;
            }
            $tokLimpio = trim($tok, ".,;:()/-");
            if ($tokLimpio === '') {
                continue;
            }
            $base = mb_strtolower($tokLimpio, 'UTF-8');
            if (isset($stopSet[$base])) {
                continue;
            }
            if (preg_match('/^[0-9]+$/', $tokLimpio)) {
                continue;
            }
            $limpios[] = $tokLimpio;
        }

        return implode(' ', $limpios);
    }

    /**
     * Comparación aproximada (sin tildes, sin mayúsculas) entre el nombre
     * esperado y los nombres copiados del memo.
     *
     * Coincide si:
     *   - TODO el nombre registrado aparece en el memo (token por token), o
     *   - el nombre registrado normalizado es subcadena del texto detectado, o
     *   - comparte al menos 2 palabras (no basta un apellido común: "José Carlos
     *     Mamani Flores" vs "Alejandro Quispe Mamani" NO coincide).
     *
     * Además tolera errores de OCR del modelo pequeño (ej. "Estel" ≈ "Estela")
     * usando similar_text con umbral alto por token.
     */
    protected function coinciden(string $esperado, array $detectados): bool
    {
        $normalizar = function (string $s): string {
            $s = mb_strtolower($s, 'UTF-8');
            $s = str_replace(
                ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', 'ä', 'ë', 'ï', 'ö', 'à', 'è', 'ì', 'ò', 'ù'],
                ['a', 'e', 'i', 'o', 'u', 'u', 'n', 'a', 'e', 'i', 'o', 'a', 'e', 'i', 'o', 'u'],
                $s
            );

            return trim((string) preg_replace('/[^a-z0-9 ]/', ' ', $s));
        };

        $esperadoNormalizado = $normalizar($esperado);
        $tokEsperado = preg_split('/\s+/', $esperadoNormalizado, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $tokEsperado = array_values(array_filter($tokEsperado, fn ($t) => mb_strlen($t) >= 3));
        if (count($tokEsperado) === 0) {
            return false;
        }

        // Unión de todos los tokens copiados del memo + texto completo normalizado.
        $unionDetectada = [];
        $textoDetectadoCompleto = '';
        foreach ($detectados as $detectado) {
            $normalizado = $normalizar((string) $detectado);
            $textoDetectadoCompleto .= ' ' . $normalizado;
            $toks = preg_split('/\s+/', $normalizado, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            foreach ($toks as $t) {
                if (mb_strlen($t) >= 3) {
                    $unionDetectada[$t] = true;
                }
            }
        }

        // Subcadena: el nombre registrado completo aparece literalmente en el memo.
        if ($esperadoNormalizado !== '' && str_contains(trim($textoDetectadoCompleto), $esperadoNormalizado)) {
            return true;
        }

        $unionDetectada = array_keys($unionDetectada);

        $todosPresentes = true;
        $compartidas = 0;
        foreach ($tokEsperado as $t) {
            if ($this->tokenCoincide($t, $unionDetectada)) {
                $compartidas++;
            } else {
                $todosPresentes = false;
            }
        }

        return $todosPresentes || $compartidas >= 2;
    }

    /**
     * Compara un token esperado contra la lista de tokens detectados,
     * permitiendo errores de OCR leves (1-2 letras) vía similar_text.
     */
    protected function tokenCoincide(string $token, array $detectados): bool
    {
        if (in_array($token, $detectados, true)) {
            return true;
        }

        foreach ($detectados as $d) {
            if (mb_strlen($d) < 4 || mb_strlen($token) < 4) {
                continue;
            }
            similar_text($token, $d, $porcentaje);
            // Umbral alto: "estel" vs "estela" (~91%) sí; "mamani" vs "flores" no.
            if ($porcentaje >= 88) {
                return true;
            }
        }

        return false;
    }

    /**
     * REVISIÓN RÁPIDA en vivo (para el módulo "Subir Documento").
     *
     * A diferencia del pipeline completo (hasta 7 consultas: destinatario con
     * reintentos + firma/sello por cuadrante), aquí se hace UNA SOLA consulta
     * de visión sobre la primera página a baja resolución (IA_DPI_RAPIDO),
     * pidiendo TODO en un único JSON: es_memo, tipo, destinatario, fecha,
     * firma y sello. Esto baja la revisión de ~90 segundos a ~10-25 segundos.
     *
     * @param  string  $rutaAbsoluta  Ruta absoluta al PDF en storage.
     * @param  array   $contexto      ['tipo_esperado' => ..., 'oficial_esperado' => ...]
     * @return array{ia_disponible:bool,es_memo:bool,tipo_detectado:?string,tipo_esperado:?string,coincide_tipo:?bool,destinatario:?string,coincide_oficial:?bool,fecha_documento:?string,firma:bool,sello:bool,resumen:?string,alertas:array,advertencias:array,tiempo_seg:float}
     */
    public function revisarRapido(string $rutaAbsoluta, array $contexto = []): array
    {
        if (!$this->disponible()) {
            throw new RuntimeException(
                'La IA local no está configurada. Defina IA_URL e IA_MODEL en el archivo .env (ej. http://127.0.0.1:1234 y qwen/qwen2.5-vl-7b).'
            );
        }

        $inicio = microtime(true);

        // 1. Solo la PRIMERA página y a baja resolución (rápido y barato).
        $paginas = $this->paginas->renderizar($rutaAbsoluta, 1, (int) config('ia.dpi_rapido', 110));
        if (count($paginas) === 0) {
            throw new RuntimeException('El PDF no pudo convertirse a imagen para la revisión con IA.');
        }

        // 2. Usar la vista completa de la página (no los recortes 2x2).
        $imagen = $paginas[0]['data_url'] ?? null;
        foreach ($paginas as $p) {
            if (($p['archivo'] ?? '') === 'pagina_1.png') {
                $imagen = $p['data_url'];
                break;
            }
        }
        if ($imagen === null) {
            throw new RuntimeException('No se obtuvo la imagen de la primera página del PDF.');
        }

        // 3. UNA consulta con todo lo necesario.
        $texto = 'Eres el sistema experto documental de la Policía Boliviana. Analiza la imagen adjunta '
            . '(documento escaneado o fotografiado, puede estar levemente rotado). Responde ÚNICAMENTE '
            . 'con JSON válido, sin texto adicional, con estos campos: '
            . '"es_memo": true solo si es un memorándum u oficio institucional (membrete policial, '
            . 'destinatario "Al Señor(a):", fecha y firmas); false si es otra cosa (tesis, informe '
            . 'académico, carta particular, factura, formulario, etc.). '
            . '"tipo_memo": si es memo, el tipo en UNA palabra entre DESIGNACIÓN, LLAMADA DE ATENCIÓN, '
            . 'ARRESTO, VACACIÓN, CUENTA VACACIÓN, COMISIÓN DE ESTUDIO, CAMBIO DE DESTINO, FELICITACIÓN '
            . 'u OTRO (null si no es memo). '
            . '"destinatario": el nombre completo del destinatario escrito después de "Al Señor(a):" '
            . '(sin grados ni cargos; null si no se distingue). '
            . '"fecha_documento": la fecha del documento en formato dd/mm/aaaa (null si no se ve). '
            . '"firma": true si hay firma manuscrita visible, false si no. '
            . '"sello": true si hay sello o timbre institucional, false si no. '
            . '"resumen": una frase corta (máx. 15 palabras) de qué trata el documento.';

        $contenido = $this->consultar([$imagen], $texto, null, (int) config('ia.timeout_rapido', 90));
        $json = $this->extraerJson($contenido) ?? [];

        // 4. Normalizar campos.
        $esMemo = !empty($json['es_memo']) || (($json['es_memo'] ?? null) === 'true');
        $tipoDetectado = is_string($json['tipo_memo'] ?? null) ? trim($json['tipo_memo']) : '';
        $tipoEsperado = trim((string) ($contexto['tipo_esperado'] ?? ''));
        $oficialEsperado = trim((string) ($contexto['oficial_esperado'] ?? ''));
        $destinatario = is_string($json['destinatario'] ?? null) ? trim($json['destinatario']) : '';
        $fechaDocumento = is_string($json['fecha_documento'] ?? null) ? trim($json['fecha_documento']) : '';
        $resumen = is_string($json['resumen'] ?? null) ? trim($json['resumen']) : '';
        $firma = !empty($json['firma']) || (($json['firma'] ?? null) === 'true');
        $sello = !empty($json['sello']) || (($json['sello'] ?? null) === 'true');

        // 5. Comparaciones locales (la IA solo extrae; la decisión es nuestra).
        $coincideTipo = null;
        if ($tipoDetectado !== '' && $tipoEsperado !== '' && $esMemo) {
            $coincideTipo = $this->tiposCoinciden($tipoEsperado, $tipoDetectado);
        }

        $coincideOficial = null;
        if ($destinatario !== '' && $oficialEsperado !== '') {
            $limpio = $this->limpiarNombre($destinatario);
            $coincideOficial = $limpio !== '' && $this->coinciden($oficialEsperado, [$limpio]);
        }

        // 6. Alertas (bloquean envío) y advertencias (avisan).
        $alertas = [];
        $advertencias = [];

        if (!$esMemo) {
            $alertas[] = 'El sistema determinó que el documento NO es un memorándum institucional de la Policía Boliviana. Verifique el archivo adjunto.';
        } elseif ($coincideTipo === false) {
            $alertas[] = sprintf(
                'El documento parece ser del tipo "%s", que NO coincide con el tipo seleccionado ("%s").',
                $tipoDetectado,
                $tipoEsperado
            );
        } else {
            $aprobacion = 'El documento fue identificado como memorándum institucional';
            if ($tipoDetectado !== '') {
                $aprobacion .= ' (tipo: ' . $tipoDetectado . ')';
            }
            $advertencias[] = $aprobacion . '.';
        }

        if ($coincideOficial === false) {
            $advertencias[] = sprintf(
                'El destinatario del documento ("%s") no parece coincidir con el oficial seleccionado (%s).',
                $destinatario,
                $oficialEsperado
            );
        } elseif ($coincideOficial === true) {
            $advertencias[] = sprintf('Destinatario confirmado en el documento: %s.', $destinatario);
        }

        if ($fechaDocumento !== '') {
            $advertencias[] = 'Fecha detectada en el documento: ' . $fechaDocumento . '.';
        }

        if (!$firma) {
            $advertencias[] = 'No se detectó firma manuscrita en el documento.';
        }
        if (!$sello) {
            $advertencias[] = 'No se detectó sello institucional en el documento.';
        }
        if ($firma && $sello) {
            $advertencias[] = 'Firma y sello institucional detectados en el documento.';
        }

        $resultado = [
            'ia_disponible' => true,
            'es_memo' => $esMemo,
            'tipo_detectado' => $tipoDetectado !== '' ? $tipoDetectado : null,
            'tipo_esperado' => $tipoEsperado !== '' ? $tipoEsperado : null,
            'coincide_tipo' => $coincideTipo,
            'destinatario' => $destinatario !== '' ? $destinatario : null,
            'coincide_oficial' => $coincideOficial,
            'fecha_documento' => $fechaDocumento !== '' ? $fechaDocumento : null,
            'firma' => (bool) $firma,
            'sello' => (bool) $sello,
            'resumen' => $resumen !== '' ? $resumen : null,
            'alertas' => $alertas,
            'advertencias' => $advertencias,
            'tiempo_seg' => round(microtime(true) - $inicio, 1),
        ];

        $this->registrarResumen('subir_documento');

        return $resultado;
    }

    /**
     * Compara el tipo seleccionado por el secretario con el tipo leído por la IA.
     * Tolerante a mayúsculas, tildes y sinónimos comunes.
     */
    protected function tiposCoinciden(string $esperado, string $detectado): bool
    {
        $norm = function (string $s): string {
            $s = mb_strtolower($s, 'UTF-8');
            $s = str_replace(
                ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', 'à', 'è', 'ì', 'ò', 'ù'],
                ['a', 'e', 'i', 'o', 'u', 'u', 'n', 'a', 'e', 'i', 'o', 'u'],
                $s
            );
            return trim((string) preg_replace('/[^a-z0-9 ]/', ' ', $s));
        };

        $e = $norm($esperado);
        $d = $norm($detectado);
        if ($e === '' || $d === '') {
            return false;
        }

        if ($e === $d || str_contains($e, $d) || str_contains($d, $e)) {
            return true;
        }

        // Sinónimos: si ambos hablan de lo mismo con otras palabras.
        $alias = [
            'designacion' => ['designa', 'designado', 'designada'],
            'llamada de atencion' => ['llamada', 'atencion', 'llamado'],
            'arresto' => ['arresto', 'detencion', 'detenido'],
            'vacacion' => ['vacacion', 'descanso', 'licencia', 'permiso'],
            'cuenta vacacion' => ['cuenta', 'vacaciones', 'dias'],
            'comision de estudio' => ['comision', 'estudio', 'estudios', 'curso'],
            'cambio de destino' => ['cambio', 'destino', 'traslado'],
            'felicitacion' => ['felicitacion', 'felicitaciones', 'felicita'],
        ];
        foreach ($alias as $clave => $sinonimos) {
            $coincideE = $e === $clave || in_array($e, $sinonimos, true);
            $coincideD = $d === $clave || in_array($d, $sinonimos, true);
            if ($coincideE && $coincideD) {
                return true;
            }
        }

        // Palabras significativas compartidas (ignorando artículos/preposiciones).
        $palabras = fn (string $s) => array_values(array_filter(
            preg_split('/\s+/', $s) ?: [],
            fn ($t) => !in_array($t, ['de', 'del', 'la', 'el', 'los', 'las', 'y', 'al', 'a', 'por', 'para', 'cuenta', 'memo', 'memorandum'], true)
        ));
        $compartidas = count(array_intersect($palabras($e), $palabras($d)));

        return $compartidas >= 2;
    }

    /**
     * Analiza la FOTO DE PERFIL subida en el registro público y determina si
     * contiene un ROSTRO humano (no objetos, animales, logos, documentos, etc.).
     * Usa el mismo modelo de visión local (IA_MODEL) con una sola imagen.
     *
     * @return array{es_rostro:bool,mensaje:string}
     */
    public function analizarRostro(string $rutaAbsoluta): array
    {
        if (!$this->disponible()) {
            throw new RuntimeException('La IA local no está configurada. Defina IA_URL e IA_MODEL en el archivo .env.');
        }
        if (!is_file($rutaAbsoluta)) {
            throw new RuntimeException('La foto de perfil no se encontró en el servidor.');
        }

        $ext = strtolower(pathinfo($rutaAbsoluta, PATHINFO_EXTENSION));
        $mime = $ext === 'png' ? 'png' : 'jpeg';

        // Reducir la foto antes de enviarla: las cámaras suben fotos de 3-5 MB
        // que al modelo le llegan reescaladas igualmente, así que enviar más
        // píxeles solo alarga el base64 y la latencia. 1024 px de lado mayor es
        // más que suficiente para detectar un rostro.
        $binario = (string) file_get_contents($rutaAbsoluta);
        if (function_exists('imagecreatefromstring') && $binario !== '') {
            $im = @imagecreatefromstring($binario);
            if ($im !== false) {
                $ancho = imagesx($im);
                $alto = imagesy($im);
                $maxLado = 1024;
                if ($ancho > $maxLado || $alto > $maxLado) {
                    $escala = $maxLado / max($ancho, $alto);
                    $nuevoAncho = max(1, (int) round($ancho * $escala));
                    $nuevoAlto = max(1, (int) round($alto * $escala));
                    $nuevo = imagecreatetruecolor($nuevoAncho, $nuevoAlto);
                    if ($mime === 'png') {
                        imagealphablending($nuevo, false);
                        imagesavealpha($nuevo, true);
                    }
                    imagecopyresampled($nuevo, $im, 0, 0, 0, 0, $nuevoAncho, $nuevoAlto, $ancho, $alto);
                    $buf = fopen('php://temp', 'r+');
                    if ($buf !== false) {
                        if ($mime === 'png') {
                            imagepng($nuevo, $buf);
                        } else {
                            imagejpeg($nuevo, $buf, 85);
                        }
                        rewind($buf);
                        $binario = (string) stream_get_contents($buf);
                        fclose($buf);
                    }
                    imagedestroy($nuevo);
                }
                imagedestroy($im);
            }
        }
        $dataUrl = 'data:image/' . $mime . ';base64,' . base64_encode($binario);

        $texto = 'Mira esta imagen y determina si contiene el ROSTRO de una persona (foto tipo perfil: '
            . 'cara humana visible, de frente o ligeramente girada). Responde false si es otra cosa: '
            . 'objetos, animales, paisajes, logos, capturas de pantalla, documentos o imágenes sin personas. '
            . 'Responde SOLO con JSON válido: {"rostro": true} o {"rostro": false}.';

        $contenido = $this->consultar([$dataUrl], $texto, $this->modeloParaNombre([]), 90);
        $json = $this->extraerJson($contenido);

        $valor = $json['rostro'] ?? $json['es_rostro'] ?? $json['face'] ?? null;
        $esRostro = false;
        if (is_bool($valor)) {
            $esRostro = $valor;
        } elseif (is_string($valor)) {
            $esRostro = in_array(mb_strtolower(trim($valor), 'UTF-8'), ['true', 'si', 'sí', 'yes', '1'], true);
        } elseif (is_numeric($valor)) {
            $esRostro = ((int) $valor) === 1;
        }

        return [
            'es_rostro' => $esRostro,
            'mensaje' => $esRostro
                ? 'Se detectó un rostro humano en la foto de perfil.'
                : 'La foto de perfil NO parece contener un rostro humano. Solicitar una foto correcta.',
        ];
    }
}
