<?php

namespace App\Http\Controllers;

use App\Models\Documento;
use App\Models\SolicitudRegistro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * SincronizacionController — Corazón del modo EN VIVO de OFBOL.
 *
 * Endpoints livianos de sondeo (polling): las páginas abiertas preguntan cada
 * pocos segundos "¿qué cambió desde X?" y reciben SOLO los cambios (ids de
 * documentos movidos/creados, solicitudes nuevas, resumen por EPI). Así dos
 * ventanas (Secretario EPI subiendo + Comando Departamental revisando) ven
 * los movimientos en vivo sin recargar la página.
 *
 * Respuesta de estado:
 *   {
 *     servidor_hora: "2026-09-06T15:40:12-04:00",   → se devuelve como 'desde' en la próxima consulta
 *     documentos:    [{id_documento, estado_actual, id_epi, fecha_subida}],  → creados/movidos desde 'desde'
 *     solicitudes:   [{id_solicitud, estado_solicitud, ia_estado}],  → nuevas/resueltas desde 'desde'
 *     resumen_epi:   [{id_epi, total, en_revision, observados, aprobados}], → siempre completo (liviano)
 *   }
 */
class SincronizacionController extends Controller
{
    public function estado(Request $request): JsonResponse
    {
        $desde = $request->input('desde'); // ISO8601 devuelto por la llamada anterior (opcional)

        // 1. Documentos creados o con cambios de estado desde 'desde'.
        $docsQuery = Documento::query()
            ->select('id_documento', 'estado_actual', 'id_epi', 'fecha_subida')
            ->orderBy('id_documento');

        if ($desde) {
            $docsQuery->where(function ($q) use ($desde) {
                $q->where('fecha_subida', '>', $desde)
                    ->orWhereHas('historialEstados', function ($h) use ($desde) {
                        $h->where('fecha', '>', $desde);
                    });
            });
        }
        $documentos = $docsQuery->limit(200)->get();

        // 2. Solicitudes de registro nuevas o actualizadas desde 'desde' (panel IA Comando General).
        $solQuery = SolicitudRegistro::query()
            ->select('id_solicitud', 'estado_solicitud', 'ia_estado', 'ia_coincide')
            ->orderBy('id_solicitud');

        if ($desde) {
            $solQuery->where(function ($q) use ($desde) {
                $q->where('creado_en', '>', $desde)
                    ->orWhere('ia_verificado_en', '>', $desde)
                    ->orWhere('resuelto_en', '>', $desde);
            });
        }
        $solicitudes = $solQuery->limit(200)->get();

        // 3. Resumen por EPI (siempre completo: es un GROUP BY barato y alimenta el campus visual).
        $resumen = Documento::query()
            ->selectRaw('id_epi, estado_actual, COUNT(*) as total')
            ->groupBy('id_epi', 'estado_actual')
            ->get()
            ->groupBy('id_epi')
            ->map(function ($filas, $idEpi) {
                return [
                    'id_epi' => (int) $idEpi,
                    'total' => $filas->sum('total'),
                    'en_revision' => $filas->whereIn('estado_actual', [2, 3])->sum('total'),
                    'observados' => $filas->whereIn('estado_actual', [4, 5])->sum('total'),
                    'aprobados' => $filas->whereIn('estado_actual', [6, 7, 8])->sum('total'),
                ];
            })
            ->values();

        return response()->json([
            'servidor_hora' => now()->toIso8601String(),
            'documentos' => $documentos,
            'solicitudes' => $solicitudes,
            'resumen_epi' => $resumen,
        ]);
    }

    /**
     * Eco de vida para el indicador "EN VIVO" del header.
     */
    public function ping(): JsonResponse
    {
        return response()->json(['ok' => true, 'servidor_hora' => now()->toIso8601String()]);
    }
}
