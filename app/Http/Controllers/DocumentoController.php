<?php

namespace App\Http\Controllers;

use App\Models\Documento;
use App\Models\Epi;
use App\Models\HistorialEstado;
use App\Models\TipoDocumento;
use App\Models\Usuario;
use App\Services\VerificadorIA;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Documento::with([
            'tipoDocumento',
            'oficial.grado',
            'oficial.cargo',
            'usuario.epi',
            'epi',
            'estado',
            'revisiones.revisor',
            'revisiones.tipoObservacion',
            'versiones',
        ]);

        if ($request->has('estado_actual')) {
            $query->where('estado_actual', $request->input('estado_actual'));
        }

        if ($request->has('id_epi')) {
            $query->where('id_epi', $request->input('id_epi'));
        }

        if ($request->has('id_oficial')) {
            $query->where('id_oficial', $request->input('id_oficial'));
        }

        if ($request->has('id_tipo')) {
            $query->where('id_tipo', $request->input('id_tipo'));
        }

        if ($request->has('id_usuario')) {
            $query->where('id_usuario', $request->input('id_usuario'));
        }

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('codigo_documento', 'ilike', "%{$search}%")
                  ->orWhere('referencia', 'ilike', "%{$search}%")
                  ->orWhereHas('oficial', function ($oq) use ($search) {
                      $oq->where('nombres', 'ilike', "%{$search}%")
                         ->orWhere('apellidos', 'ilike', "%{$search}%")
                         ->orWhere('ci', 'ilike', "%{$search}%");
                  });
            });
        }

        $documentos = $query->orderBy('fecha_subida', 'desc')->get();
        return response()->json($documentos);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_tipo' => 'required|exists:tipos_documento,id_tipo',
            'id_oficial' => 'required|exists:oficiales,id_oficial',
            'id_usuario' => 'required|exists:usuarios,id_usuario',
            'id_epi' => 'required|exists:epis,id_epi',
            'codigo_documento' => 'required|string|max:50|unique:documentos,codigo_documento',
            'referencia' => 'required|string|max:255',
            'ruta_pdf' => 'required|string|max:500',
            'hash' => 'required|string|max:64',
            'fecha_subida' => [
                'nullable',
                'date',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if ($value === null || $value === '') {
                        return;
                    }
                    try {
                        $fecha = \Illuminate\Support\Carbon::parse($value)->toDateString();
                    } catch (\Throwable) {
                        $fail('La fecha oficial del documento no es válida.');
                        return;
                    }
                    if ($fecha !== now()->toDateString()) {
                        $fail('La fecha oficial del documento debe ser la de HOY. No se permiten fechas pasadas ni futuras.');
                    }
                },
            ],
            'estado_actual' => 'required|exists:estados_documento,id_estado',
        ]);

        $validated['fecha_subida'] = $validated['fecha_subida'] ?? now();
        $documento = Documento::create($validated);

        // Registrar en historial_estados
        HistorialEstado::create([
            'id_documento' => $documento->id_documento,
            'estado_anterior' => null,
            'estado_nuevo' => $documento->estado_actual,
            'usuario' => $documento->id_usuario,
            'fecha' => now(),
        ]);

        return response()->json($documento->load(['tipoDocumento', 'oficial.grado', 'epi', 'estado']), 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $documento = Documento::with([
            'tipoDocumento',
            'oficial.grado',
            'oficial.cargo',
            'usuario.epi',
            'epi',
            'estado',
            'versiones.usuario',
            'revisiones.revisor',
            'revisiones.tipoObservacion',
            'validaciones.regla',
            'flujos.usuario',
            'historialEstados.usuario.rol',
            'historialEstados.estadoAnterior',
            'historialEstados.estadoNuevo',
        ])->findOrFail($id);

        return response()->json($documento);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $documento = Documento::findOrFail($id);

        $validated = $request->validate([
            'id_tipo' => 'sometimes|required|exists:tipos_documento,id_tipo',
            'id_oficial' => 'sometimes|required|exists:oficiales,id_oficial',
            'id_usuario' => 'sometimes|required|exists:usuarios,id_usuario',
            'id_epi' => 'sometimes|required|exists:epis,id_epi',
            'codigo_documento' => 'sometimes|required|string|max:50|unique:documentos,codigo_documento,' . $id . ',id_documento',
            'referencia' => 'sometimes|required|string|max:255',
            'ruta_pdf' => 'sometimes|required|string|max:500',
            'hash' => 'sometimes|required|string|max:64',
            'fecha_subida' => 'nullable|date',
            'estado_actual' => 'sometimes|required|exists:estados_documento,id_estado',
        ]);

        $estadoAnterior = $documento->estado_actual;
        $documento->update($validated);

        if (isset($validated['estado_actual']) && $validated['estado_actual'] != $estadoAnterior) {
            HistorialEstado::create([
                'id_documento' => $documento->id_documento,
                'estado_anterior' => $estadoAnterior,
                'estado_nuevo' => $validated['estado_actual'],
                'usuario' => $request->input('usuario_cambio', $documento->id_usuario),
                'fecha' => now(),
            ]);
        }

        return response()->json($documento->load(['tipoDocumento', 'oficial.grado', 'epi', 'estado']));
    }

    /**
     * REVISIÓN IA EN VIVO del PDF antes de registrarlo (módulo Subir Documento).
     *
     * Recibe el PDF recién adjuntado, lo convierte a imagen (1ª página, baja
     * resolución) y hace UNA sola consulta al modelo de visión local
     * (LM Studio) para determinar si es un memorándum, su tipo, destinatario,
     * fecha, firma y sello. El resultado alimenta el panel del Sistema Experto.
     */
    public function revisarIA(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'archivo' => 'required|file|mimes:pdf|max:15360',
            'tipo_esperado' => 'nullable|string|max:120',
            'oficial_esperado' => 'nullable|string|max:250',
        ]);

        $verificador = app(VerificadorIA::class);

        if (!$verificador->disponible()) {
            return response()->json([
                'ia_disponible' => false,
                'mensaje' => 'La IA local no está configurada. Defina IA_URL e IA_MODEL en el archivo .env.',
            ]);
        }

        // El disco 'local' apunta a storage/app/private (Laravel 11+), por lo
        // que la ruta absoluta se resuelve con Storage::path(), no con
        // storage_path('app/...'), que apuntaba a una carpeta inexistente y
        // provocaba "El archivo PDF no existe" en la revisión con IA.
        $rutaRel = $request->file('archivo')->store('ia_tmp', 'local');
        $rutaAbs = \Illuminate\Support\Facades\Storage::disk('local')->path($rutaRel);

        try {
            $resultado = $verificador->revisarRapido($rutaAbs, [
                'tipo_esperado' => $validated['tipo_esperado'] ?? '',
                'oficial_esperado' => $validated['oficial_esperado'] ?? '',
            ]);

            return response()->json($resultado);
        } catch (\Throwable $e) {
            return response()->json([
                'ia_disponible' => false,
                'mensaje' => $e->getMessage(),
            ]);
        } finally {
            if (is_file($rutaAbs)) {
                @unlink($rutaAbs);
            }
        }
    }

    /**
     * Persiste físicamente el PDF adjunto en storage/app/public/documentos
     * y devuelve la ruta relativa para guardarla en documentos.ruta_pdf.
     */
    public function subirArchivo(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'archivo' => 'required|file|mimes:pdf|max:15360',
        ]);

        $archivo = $request->file('archivo');
        $nombre = preg_replace('/[^A-Za-z0-9._-]+/', '_', (string) $archivo->getClientOriginalName());
        $nombre = $nombre ?: ('documento_' . now()->format('Ymd_His') . '.pdf');

        $ruta = $archivo->storeAs('documentos', $nombre, 'public');

        return response()->json([
            'ruta' => $ruta,
            'nombre' => $nombre,
        ], 201);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $documento = Documento::findOrFail($id);
        $documento->delete();
        return response()->json(['message' => 'Documento eliminado correctamente']);
    }

    /**
     * Obtener trazabilidad completa y estructurada de un documento
     */
    public function trazabilidad(string|int $id): JsonResponse
    {
        $documento = Documento::with([
            'tipoDocumento',
            'oficial.grado',
            'oficial.cargo',
            'usuario.epi',
            'epi',
            'estado',
            'versiones.usuario',
            'revisiones.revisor',
            'revisiones.tipoObservacion',
            'historialEstados.usuario.rol',
            'historialEstados.estadoAnterior',
            'historialEstados.estadoNuevo',
        ])->findOrFail($id);

        $historial = $documento->historialEstados->sortBy('fecha')->values();

        // Mapeo completo de etapas institucionales
        $etapasDefinidas = [
            ['paso' => 1, 'clave' => 'subido', 'nombre' => 'Subido por Secretario EPI', 'icono' => 'document-arrow-up'],
            ['paso' => 2, 'clave' => 'recibido_dptal', 'nombre' => 'Recibido en Comando Departamental', 'icono' => 'inbox-arrow-down'],
            ['paso' => 3, 'clave' => 'en_revision', 'nombre' => 'En Revisión Normativa', 'icono' => 'magnifying-glass'],
            ['paso' => 4, 'clave' => 'observado', 'nombre' => 'Observado (si aplica)', 'icono' => 'exclamation-triangle'],
            ['paso' => 5, 'clave' => 'corregido', 'nombre' => 'Corregido / Re-enviado', 'icono' => 'arrow-path'],
            ['paso' => 6, 'clave' => 'aprobado', 'nombre' => 'Aprobado por Comando Departamental', 'icono' => 'check-badge'],
            ['paso' => 7, 'clave' => 'remitido', 'nombre' => 'Remitido al Comando General', 'icono' => 'paper-airplane'],
            ['paso' => 8, 'clave' => 'recepcionado_cg', 'nombre' => 'Recepcionado en Comando General', 'icono' => 'building-library'],
            ['paso' => 9, 'clave' => 'registrado', 'nombre' => 'Registrado Oficialmente en Escalafón', 'icono' => 'document-check'],
            ['paso' => 10, 'clave' => 'flujo_cerrado', 'nombre' => 'Flujo Institucional Cerrado', 'icono' => 'lock-closed'],
        ];

        return response()->json([
            'documento' => $documento,
            'historial' => $historial,
            'revisiones' => $documento->revisiones,
            'versiones' => $documento->versiones,
            'etapas_definidas' => $etapasDefinidas,
        ]);
    }

    /**
     * Desempeño comparativo de las 9 EPIs
     */
    public function desempenioEpis(): JsonResponse
    {
        $epis = Epi::orderBy('id_epi')->get();
        $tipos = TipoDocumento::orderBy('id_tipo')->get();
        $documentos = Documento::with(['tipoDocumento', 'estado', 'usuario', 'epi', 'oficial.grado', 'historialEstados'])->get();
        $secretarios = Usuario::where('id_rol', 1)->where('estado', true)->with('epi')->get()->keyBy('id_epi');

        $resultado = $epis->map(function ($epi) use ($documentos, $secretarios, $tipos) {
            $docsEpi = $documentos->where('id_epi', $epi->id_epi);

            $total = $docsEpi->count();
            $enviados = $docsEpi->whereIn('estado_actual', [2, 3])->count();
            $enRevision = $docsEpi->where('estado_actual', 3)->count();
            $observados = $docsEpi->whereIn('estado_actual', [4, 5])->count();
            $aprobados = $docsEpi->whereIn('estado_actual', [6, 7, 8])->count();
            $registrados = $docsEpi->where('estado_actual', 8)->count();

            $tasaAprobacion = $total > 0 ? round(($aprobados / $total) * 100, 1) : 0;
            $tasaObservacion = $total > 0 ? round(($observados / $total) * 100, 1) : 0;

            // Desglose por tipo
            $porTipo = [];
            foreach ($tipos as $t) {
                $porTipo[$t->nombre] = $docsEpi->where('id_tipo', $t->id_tipo)->count();
            }

            $sec = $secretarios->get($epi->id_epi);

            // Detalle por tipo dentro de esta EPI (para el panel de la torre)
            $porTipoDetalle = $tipos->map(function ($t) use ($docsEpi) {
                $d = $docsEpi->where('id_tipo', $t->id_tipo);

                return [
                    'id_tipo' => $t->id_tipo,
                    'tipo' => $t->nombre,
                    'total' => $d->count(),
                    'aprobados' => $d->whereIn('estado_actual', [6, 7, 8])->count(),
                    'observados' => $d->whereIn('estado_actual', [4, 5])->count(),
                ];
            })->sortByDesc('total')->values();

            // Oficiales (destinatarios) que más memorándums recibieron de esta EPI,
            // con el desglose por tipo: "quién recibió más y de qué tipo".
            $topReceptores = $docsEpi->groupBy('id_oficial')
                ->map(function ($grupo) {
                    $of = $grupo->first()->oficial;
                    if (!$of) {
                        return null;
                    }
                    $porTipoOf = $grupo->groupBy(fn ($d) => $d->tipoDocumento?->nombre ?? 'Otro')
                        ->map->count()
                        ->sortDesc();

                    return [
                        'id_oficial' => $of->id_oficial,
                        'nombres' => $of->nombres,
                        'apellidos' => $of->apellidos,
                        'grado' => $of->grado->abreviatura ?? ($of->grado->nombre ?? ''),
                        'foto' => $of->foto ?? null,
                        'total' => $grupo->count(),
                        'tipo_principal' => $porTipoOf->keys()->first(),
                        'por_tipo' => $porTipoOf->all(),
                    ];
                })
                ->filter()
                ->sortByDesc('total')
                ->take(5)
                ->values();

            // Tiempo promedio REAL (horas) desde la subida hasta el último
            // cambio de estado registrado en historial_estados. Antes se
            // devolvía rand(18,36): datos inventados para una métrica oficial.
            $horasTotales = 0.0;
            $conTiempo = 0;
            foreach ($docsEpi as $d) {
                $inicio = $d->fecha_subida ? \Illuminate\Support\Carbon::parse($d->fecha_subida) : null;
                if (!$inicio) {
                    continue;
                }
                $hist = $d->historialEstados->sortBy('fecha');
                $fin = $hist->isNotEmpty() ? \Illuminate\Support\Carbon::parse($hist->last()->fecha) : now();
                $horasTotales += max(0, (float) $inicio->diffInHours($fin));
                $conTiempo++;
            }
            $tiempoPromedioHoras = $conTiempo > 0 ? round($horasTotales / $conTiempo, 1) : 0;

            return [
                'id_epi' => $epi->id_epi,
                'nombre' => $epi->nombre,
                'codigo' => $epi->codigo,
                'ubicacion' => $epi->ubicacion,
                'secretario' => $sec ? [
                    'id_usuario' => $sec->id_usuario,
                    'usuario' => $sec->usuario,
                    'correo' => $sec->correo,
                    'estado' => $sec->estado,
                ] : null,
                'metricas' => [
                    'total_documentos' => $total,
                    'enviados' => $enviados,
                    'en_revision' => $enRevision,
                    'observados' => $observados,
                    'aprobados' => $aprobados,
                    'registrados' => $registrados,
                    'tasa_aprobacion' => $tasaAprobacion,
                    'tasa_observacion' => $tasaObservacion,
                    'tiempo_promedio_horas' => $tiempoPromedioHoras,
                ],
                'por_tipo' => $porTipo,
                'por_tipo_detalle' => $porTipoDetalle,
                'top_receptores' => $topReceptores,
            ];
        });

        // ══════════════════════════════════════════════════════════════
        // CONSOLIDADO GLOBAL — fusiona el antiguo módulo de Estadísticas.
        // Todo viaja en la MISMA respuesta: la vista no hace peticiones extra.
        // ══════════════════════════════════════════════════════════════
        $totalGlobal = $documentos->count();
        $aprobadosGlobal = $documentos->whereIn('estado_actual', [6, 7, 8])->count();
        $observadosGlobal = $documentos->whereIn('estado_actual', [4, 5])->count();

        $resumenGlobal = [
            'total' => $totalGlobal,
            'aprobados' => $aprobadosGlobal,
            'observados' => $observadosGlobal,
            'en_proceso' => $documentos->whereIn('estado_actual', [1, 2, 3])->count(),
            'registrados' => $documentos->where('estado_actual', 8)->count(),
            'epis_activas' => $epis->count(),
            'epis_con_carga' => $documentos->pluck('id_epi')->unique()->count(),
        ];
        $resumenGlobal['tasa_aprobacion'] = $totalGlobal > 0 ? round(($aprobadosGlobal / $totalGlobal) * 100, 1) : 0;
        $resumenGlobal['tasa_observacion'] = $totalGlobal > 0 ? round(($observadosGlobal / $totalGlobal) * 100, 1) : 0;

        // Distribución por estado (formato de serie, listo para gráficas)
        $porEstado = $documentos
            ->groupBy(fn ($d) => $d->estado?->nombre ?? 'Sin estado')
            ->map(fn ($grupo, $nombre) => ['estado' => $nombre, 'total' => $grupo->count()])
            ->values()
            ->sortByDesc('total')
            ->values();

        // Tipos de memorándum MÁS y MENOS usados, con la EPI que más los emite
        $tiposMasUsados = $tipos->map(function ($t) use ($documentos, $epis) {
            $d = $documentos->where('id_tipo', $t->id_tipo);
            $idEpiTop = $d->groupBy('id_epi')->sortDesc()->keys()->first();

            return [
                'id_tipo' => $t->id_tipo,
                'tipo' => $t->nombre,
                'total' => $d->count(),
                'aprobados' => $d->whereIn('estado_actual', [6, 7, 8])->count(),
                'observados' => $d->whereIn('estado_actual', [4, 5])->count(),
                'epi_principal' => $idEpiTop ? $epis->firstWhere('id_epi', $idEpiTop)?->nombre : null,
            ];
        })->sortByDesc('total')->values();

        // Ranking global de destinatarios (quién recibió más memorándums)
        $topReceptoresGlobal = $documentos->groupBy('id_oficial')
            ->map(function ($grupo) {
                $of = $grupo->first()->oficial;
                if (!$of) {
                    return null;
                }
                $porTipoOf = $grupo->groupBy(fn ($d) => $d->tipoDocumento?->nombre ?? 'Otro')
                    ->map->count()
                    ->sortDesc();

                return [
                    'id_oficial' => $of->id_oficial,
                    'nombres' => $of->nombres,
                    'apellidos' => $of->apellidos,
                    'grado' => $of->grado->abreviatura ?? ($of->grado->nombre ?? ''),
                    'foto' => $of->foto ?? null,
                    'epi_origen' => $grupo->first()->epi?->nombre,
                    'total' => $grupo->count(),
                    'observados' => $grupo->whereIn('estado_actual', [4, 5])->count(),
                    'tipo_principal' => $porTipoOf->keys()->first(),
                ];
            })
            ->filter()
            ->sortByDesc('total')
            ->take(8)
            ->values();

        return response()->json([
            'epis' => $resultado,
            'resumen_global' => $resumenGlobal,
            'por_estado' => $porEstado,
            'tipos_mas_usados' => $tiposMasUsados,
            'top_receptores_global' => $topReceptoresGlobal,
        ]);
    }

    /**
     * Estadísticas generales consolidadas
     */
    public function estadisticasGenerales(): JsonResponse
    {
        $documentos = Documento::with(['tipoDocumento', 'estado', 'epi'])->get();
        $total = $documentos->count();

        $aprobados = $documentos->whereIn('estado_actual', [6, 7, 8])->count();
        $observados = $documentos->whereIn('estado_actual', [4, 5])->count();
        $enRevision = $documentos->whereIn('estado_actual', [2, 3])->count();
        $registrados = $documentos->where('estado_actual', 8)->count();

        $porEstado = $documentos->groupBy('estado.nombre')->map->count();
        $porTipo = $documentos->groupBy('tipoDocumento.nombre')->map->count();
        $porEpi = $documentos->groupBy('epi.nombre')->map->count();

        return response()->json([
            'total_documentos' => $total,
            'aprobados' => $aprobados,
            'observados' => $observados,
            'en_revision' => $enRevision,
            'registrados' => $registrados,
            'tasa_aprobacion' => $total > 0 ? round(($aprobados / $total) * 100, 1) : 0,
            'por_estado' => $porEstado,
            'por_tipo' => $porTipo,
            'por_epi' => $porEpi,
        ]);
    }
}
