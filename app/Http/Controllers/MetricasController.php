<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * MetricasController — Agregaciones para el módulo de Reportes.
 * Devuelve series dinámicas (por estado, tipo, EPI, mes, grado, oficial y
 * secretario) calculadas en el servidor a partir de la base de datos, con
 * filtros por EPI y rango de fechas, para alimentar las gráficas del frontend.
 *
 * Notas técnicas:
 *  - La clasificación de estados (aprobado/observado/en proceso) se deriva
 *    del NOMBRE del estado en la tabla estados_documento, no de IDs fijos:
 *    es inmune a diferencias de semillas entre entornos.
 *  - La respuesta se cachea 60 segundos por combinación de filtros: el módulo
 *    de reportes se abre muchas veces al día y las agregaciones son costosas.
 */
class MetricasController extends Controller
{
    public function reportes(Request $request): JsonResponse
    {
        // Filtros globales: EPI y rango de fechas sobre fecha_subida
        $idEpi = $request->input('id_epi');
        $desde = $request->input('desde');
        $hasta = $request->input('hasta');

        // Validación de fechas: formato YYYY-MM-DD y orden coherente
        $request->validate([
            'id_epi' => ['nullable', 'integer', 'min:1'],
            'desde'  => ['nullable', 'date_format:Y-m-d'],
            'hasta'  => ['nullable', 'date_format:Y-m-d', 'after_or_equal:desde'],
        ]);

        $idEpi = $idEpi !== null ? (int) $idEpi : null;

        // Cache de 60s por firma de filtros → segunda visita = respuesta instantánea
        $firma = 'metricas_reportes_'.$idEpi.'_'.($desde ?: '0').'_'.($hasta ?: '0');
        $ttl = now()->addSeconds(60);

        $payload = Cache::remember($firma, $ttl, function () use ($idEpi, $desde, $hasta) {
            return $this->calcular($idEpi, $desde, $hasta);
        });

        return response()->json($payload + [
            'generado_en' => now()->toDateTimeString(),
            'filtros' => [
                'id_epi' => $idEpi,
                'desde' => $desde,
                'hasta' => $hasta,
            ],
        ]);
    }

    /**
     * Ejecuta las 8 agregaciones y devuelve el arreglo del reporte.
     */
    private function calcular(?int $idEpi, ?string $desde, ?string $hasta): array
    {
        $base = DB::table('documentos as d');
        if ($idEpi) {
            $base->where('d.id_epi', $idEpi);
        }
        if ($desde) {
            $base->where('d.fecha_subida', '>=', $desde.' 00:00:00');
        }
        if ($hasta) {
            $base->where('d.fecha_subida', '<=', $hasta.' 23:59:59');
        }

        // Clasificación de estados leída de la BD (una consulta liviana, cacheada).
        [$aprobadosIds, $observadosIds, $procesoIds] = $this->idsPorCategoria();

        $aprobadosIn = implode(',', $aprobadosIds);
        $observadosIn = implode(',', $observadosIds);
        $procesoIn = implode(',', $procesoIds);

        // Clonar la consulta base para cada agregación
        $clonar = fn () => clone $base;

        // 0. Conteo crudo por estado (para el resumen y el donut)
        $porEstado = $clonar()
            ->join('estados_documento as e', 'e.id_estado', '=', 'd.estado_actual')
            ->select('e.id_estado', 'e.nombre as estado', DB::raw('COUNT(*) as total'))
            ->groupBy('e.id_estado', 'e.nombre')
            ->orderBy('e.id_estado')
            ->get();

        $total = (int) $porEstado->sum('total');
        $aprobados = (int) $porEstado->whereIn('id_estado', $aprobadosIds)->sum('total');
        $observados = (int) $porEstado->whereIn('id_estado', $observadosIds)->sum('total');
        $enProceso = (int) $porEstado->whereIn('id_estado', $procesoIds)->sum('total');

        $resumen = [
            'total' => $total,
            'aprobados' => $aprobados,
            'observados' => $observados,
            'en_proceso' => $enProceso,
            'tasa_aprobacion' => $total > 0 ? round(($aprobados / $total) * 100, 1) : 0,
            'tasa_observacion' => $total > 0 ? round(($observados / $total) * 100, 1) : 0,
        ];

        // 1. Distribución por tipo de trámite
        $porTipo = $clonar()
            ->join('tipos_documento as t', 't.id_tipo', '=', 'd.id_tipo')
            ->select('t.nombre as tipo', DB::raw('COUNT(*) as total'))
            ->groupBy('t.nombre')
            ->orderByDesc('total')
            ->get();

        // 2. Comparativo por EPI (volumen y calidad) — CASE portable en vez de FILTER
        $porEpi = $clonar()
            ->join('epis as epi', 'epi.id_epi', '=', 'd.id_epi')
            ->select('epi.id_epi', 'epi.nombre as epi')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("COUNT(CASE WHEN d.estado_actual IN ({$aprobadosIn}) THEN 1 END) as aprobados")
            ->selectRaw("COUNT(CASE WHEN d.estado_actual IN ({$observadosIn}) THEN 1 END) as observados")
            ->selectRaw("COUNT(CASE WHEN d.estado_actual IN ({$procesoIn}) THEN 1 END) as en_proceso")
            ->groupBy('epi.id_epi', 'epi.nombre')
            ->orderByDesc('total')
            ->get();

        // 3. Evolución mensual
        $porMes = $clonar()
            ->selectRaw("TO_CHAR(d.fecha_subida, 'YYYY-MM') as mes")
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("COUNT(CASE WHEN d.estado_actual IN ({$aprobadosIn}) THEN 1 END) as aprobados")
            ->selectRaw("COUNT(CASE WHEN d.estado_actual IN ({$observadosIn}) THEN 1 END) as observados")
            ->groupBy(DB::raw("TO_CHAR(d.fecha_subida, 'YYYY-MM')"))
            ->orderBy('mes')
            ->get();

        // 4. Carga de trabajo por grado del oficial involucrado
        $porGrado = $clonar()
            ->join('oficiales as o', 'o.id_oficial', '=', 'd.id_oficial')
            ->join('grados as g', 'g.id_grado', '=', 'o.id_grado')
            ->select('g.id_grado', 'g.abreviatura as grado', DB::raw('COUNT(*) as total'))
            ->groupBy('g.id_grado', 'g.abreviatura')
            ->orderBy('g.id_grado')
            ->get();

        // 5. Top oficiales con más trámites (incluye foto para el ranking visual)
        $topOficiales = $clonar()
            ->join('oficiales as o', 'o.id_oficial', '=', 'd.id_oficial')
            ->join('grados as g', 'g.id_grado', '=', 'o.id_grado')
            ->select(
                'o.id_oficial',
                'o.nombres',
                'o.apellidos',
                'o.foto',
                'g.abreviatura as grado',
                DB::raw('COUNT(*) as total')
            )
            ->selectRaw("COUNT(CASE WHEN d.estado_actual IN ({$observadosIn}) THEN 1 END) as observados")
            ->groupBy('o.id_oficial', 'o.nombres', 'o.apellidos', 'o.foto', 'g.abreviatura')
            ->orderByDesc('total')
            ->limit(8)
            ->get();

        // 6. Actividad de los secretarios (usuarios que emiten documentos)
        $porSecretario = $clonar()
            ->join('usuarios as u', 'u.id_usuario', '=', 'd.id_usuario')
            ->select('u.id_usuario', 'u.usuario', 'u.foto')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('u.id_usuario', 'u.usuario', 'u.foto')
            ->orderByDesc('total')
            ->limit(8)
            ->get();

        // 7. Serie diaria de los últimos 30 días (pulso operativo)
        $porDia = $clonar()
            ->where('d.fecha_subida', '>=', now()->subDays(30)->startOfDay())
            ->selectRaw("TO_CHAR(d.fecha_subida, 'YYYY-MM-DD') as dia")
            ->selectRaw('COUNT(*) as total')
            ->groupBy(DB::raw("TO_CHAR(d.fecha_subida, 'YYYY-MM-DD')"))
            ->orderBy('dia')
            ->get();

        return [
            'resumen' => $resumen,
            'por_estado' => $porEstado,
            'por_tipo' => $porTipo,
            'por_epi' => $porEpi,
            'por_mes' => $porMes,
            'por_grado' => $porGrado,
            'top_oficiales' => $topOficiales,
            'por_secretario' => $porSecretario,
            'por_dia' => $porDia,
        ];
    }

    /**
     * Devuelve [idsAprobados, idsObservados, idsEnProceso] leyendo los NOMBRES
     * de estados de la tabla estados_documento (con caché de 10 minutos).
     * Palabras clave insensibles a acentos/mayúsculas.
     */
    private function idsPorCategoria(): array
    {
        $mapa = Cache::remember('metricas_categorias_estado', now()->addMinutes(10), function () {
            $estados = DB::table('estados_documento')
                ->select('id_estado', 'nombre')
                ->get()
                ->map(function ($e) {
                    // Normaliza: minúsculas y sin acentos para comparar con seguridad
                    $n = mb_strtolower(trim((string) $e->nombre));
                    $n = str_replace(
                        ['á', 'é', 'í', 'ó', 'ú', 'ü'],
                        ['a', 'e', 'i', 'o', 'u', 'u'],
                        $n
                    );

                    return ['id' => (int) $e->id_estado, 'nombre' => $n];
                });

            $aprobados = $estados->filter(fn ($e) => (bool) preg_match(
                '/aprob|remitid|registrad|remision/',
                $e['nombre']
            ))->pluck('id')->values()->all();

            $observados = $estados->filter(fn ($e) => (bool) preg_match(
                '/observad|devuelto|rechazad|correcc/',
                $e['nombre']
            ))->pluck('id')->values()->all();

            $proceso = $estados->filter(fn ($e) => (bool) preg_match(
                '/proceso|revision|revisado|enviado|borrador|reenviad|cola|pendiente/',
                $e['nombre']
            ))->pluck('id')->values()->all();

            return [$aprobados, $observados, $proceso];
        });

        return $mapa;
    }
}
