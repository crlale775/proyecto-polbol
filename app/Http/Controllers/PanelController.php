<?php

namespace App\Http\Controllers;

use App\Models\Documento;
use App\Models\Epi;
use App\Models\TipoDocumento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * PanelController — endpoints LIGEROS para los dashboards.
 *
 * Los dashboards antes pedían `/documentos` (todas las relaciones anidadas de
 * cientos de trámites) más otros endpoints. Aquí cada rol obtiene TODO lo que
 * su inicio necesita en UNA sola respuesta agregada: solo conteos y listas
 * cortas, con columnas mínimas.
 *
 * Rangos de estado (según el catálogo real estados_documento):
 *   1 Borrador · 2 Enviado por EPI · 3 En revisión · 4 Observado
 *   5 Devuelto · 6 Aprobado · 7 Remitido al C.G. · 8 Registrado
 */
class PanelController extends Controller
{
    private const EN_PROCESO = [1, 2, 3];
    private const OBSERVADOS = [4, 5];
    private const APROBADOS = [6, 7];
    private const REGISTRADO = 8;

    /** Panel de la Secretaría EPI (su propia unidad). */
    public function unidad(Request $request): JsonResponse
    {
        $idEpi = (int) $request->input('id_epi', 0);

        $conteos = $this->conteos([$idEpi]);
        $resumen = $this->resumen($conteos);

        $porTipo = Documento::where('id_epi', $idEpi)
            ->join('tipos_documento as t', 't.id_tipo', '=', 'documentos.id_tipo')
            ->select('t.nombre as tipo', DB::raw('COUNT(*) as total'))
            ->groupBy('t.nombre')
            ->orderByDesc('total')
            ->get();

        $porMes = Documento::where('id_epi', $idEpi)
            ->where('fecha_subida', '>=', now()->subMonths(5)->startOfMonth())
            ->selectRaw("TO_CHAR(fecha_subida, 'YYYY-MM') as mes")
            ->selectRaw('COUNT(*) as total')
            ->groupBy(DB::raw("TO_CHAR(fecha_subida, 'YYYY-MM')"))
            ->orderBy('mes')
            ->get();

        $actividad = $this->recientes(6, $idEpi, true);

        return response()->json([
            'resumen' => $resumen,
            'por_estado' => $conteos,
            'por_tipo' => $porTipo,
            'por_mes' => $porMes,
            'actividad' => $actividad,
        ]);
    }

    /** Panel del Comando Departamental (las 9 EPIs de La Paz). */
    public function departamental(): JsonResponse
    {
        $conteos = $this->conteos();
        $resumen = $this->resumen($conteos);

        // Volumen y pendientes por cada EPI (incluye las que no tienen carga)
        $agregado = Documento::select('id_epi')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('COUNT(CASE WHEN estado_actual IN (1,2,3) THEN 1 END) as pendientes')
            ->selectRaw('COUNT(CASE WHEN estado_actual IN (4,5) THEN 1 END) as observados')
            ->selectRaw('COUNT(CASE WHEN estado_actual = 8 THEN 1 END) as registrados')
            ->groupBy('id_epi')
            ->get()
            ->keyBy('id_epi');

        $porEpi = Epi::orderBy('id_epi')->get()->map(function ($epi) use ($agregado) {
            $a = $agregado->get($epi->id_epi);

            return [
                'id_epi' => $epi->id_epi,
                'nombre' => $epi->nombre,
                'codigo' => $epi->codigo,
                'total' => (int) ($a->total ?? 0),
                'pendientes' => (int) ($a->pendientes ?? 0),
                'observados' => (int) ($a->observados ?? 0),
                'registrados' => (int) ($a->registrados ?? 0),
            ];
        });

        return response()->json([
            'resumen' => $resumen,
            'por_estado' => $conteos,
            'por_epi' => $porEpi,
            'recientes' => $this->recientes(6),
        ]);
    }

    /** Panel del Comando General (visión institucional). */
    public function general(): JsonResponse
    {
        $conteos = $this->conteos();
        $resumen = $this->resumen($conteos);

        $agregado = Documento::select('id_epi')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('COUNT(CASE WHEN estado_actual = 8 THEN 1 END) as cerrados')
            ->selectRaw('COUNT(CASE WHEN estado_actual IN (6,7) THEN 1 END) as por_validar')
            ->groupBy('id_epi')
            ->get()
            ->keyBy('id_epi');

        $total = max(1, $resumen['total']);
        $porEpi = Epi::orderBy('id_epi')->get()->map(function ($epi) use ($agregado, $total) {
            $a = $agregado->get($epi->id_epi);
            $t = (int) ($a->total ?? 0);

            return [
                'id_epi' => $epi->id_epi,
                'nombre' => $epi->nombre,
                'codigo' => $epi->codigo,
                'total' => $t,
                'cerrados' => (int) ($a->cerrados ?? 0),
                'pendientes' => (int) ($a->por_validar ?? 0),
                'pct' => $t > 0 ? (int) round(($t / $total) * 100) : 0,
            ];
        })->sortByDesc('total')->values();

        $porTipo = TipoDocumento::orderBy('id_tipo')->get()->map(function ($t) use ($total) {
            $c = Documento::where('id_tipo', $t->id_tipo)->count();

            return [
                'id_tipo' => $t->id_tipo,
                'nombre' => $t->nombre,
                'total' => $c,
                'pct' => $c > 0 ? (int) round(($c / $total) * 100) : 0,
            ];
        })->filter(fn ($t) => $t['total'] > 0)->sortByDesc('total')->values();

        return response()->json([
            'resumen' => $resumen,
            'por_estado' => $conteos,
            'por_epi' => $porEpi,
            'por_tipo' => $porTipo,
            'recientes' => $this->recientes(5),
        ]);
    }

    /* ───────────────────────── Helpers ───────────────────────── */

    /**
     * Conteo por estado (una sola consulta). Con `$idsEpi` filtra por unidad;
     * sin argumentos agrega todo el sistema.
     *
     * @param  array<int>  $idsEpi
     * @return array<int, array{estado:string,id_estado:int,total:int}>
     */
    private function conteos(array $idsEpi = []): array
    {
        $query = Documento::query()
            ->join('estados_documento as e', 'e.id_estado', '=', 'documentos.estado_actual')
            ->select('e.id_estado', 'e.nombre as estado', DB::raw('COUNT(*) as total'))
            ->groupBy('e.id_estado', 'e.nombre')
            ->orderByDesc('total');

        if (!empty($idsEpi)) {
            $query->whereIn('documentos.id_epi', $idsEpi);
        }

        return $query->get()->map(fn ($r) => [
            'id_estado' => (int) $r->id_estado,
            'estado' => $r->estado,
            'total' => (int) $r->total,
        ])->values()->all();
    }

    /**
     * Deriva las métricas del panel a partir del conteo por estado.
     *
     * @param  array<int, array{estado:string,id_estado:int,total:int}>  $conteos
     * @return array<string, int>
     */
    private function resumen(array $conteos): array
    {
        $total = array_sum(array_column($conteos, 'total'));
        $suma = function (array $ids) use ($conteos): int {
            $sub = 0;
            foreach ($conteos as $c) {
                if (in_array($c['id_estado'], $ids, true)) {
                    $sub += $c['total'];
                }
            }

            return $sub;
        };

        $registrados = $suma([self::REGISTRADO]);

        return [
            'total' => $total,
            'en_proceso' => $suma(self::EN_PROCESO),
            'observados' => $suma(self::OBSERVADOS),
            'aprobados' => $suma(self::APROBADOS),
            'registrados' => $registrados,
            'por_validar' => $suma(self::APROBADOS),
            'hoy' => $this->hoy(),
            'tasa_cierre' => $total > 0 ? (int) round(($registrados / $total) * 100) : 0,
        ];
    }

    private function hoy(): int
    {
        return Documento::whereDate('fecha_subida', now()->toDateString())->count();
    }

    /**
     * Últimos documentos con SOLO las columnas necesarias para las tarjetas.
     *
     * @return \Illuminate\Support\Collection<int, Documento>
     */
    private function recientes(int $limite, ?int $idEpi = null, bool $conActividad = false)
    {
        $query = Documento::with([
            'estado:id_estado,nombre',
            'tipoDocumento:id_tipo,nombre',
        ]);

        if ($conActividad) {
            $query->with(['oficial:id_oficial,nombres,apellidos,ci,id_grado', 'oficial.grado:id_grado,abreviatura,nombre']);
        } else {
            $query->with([
                'epi:id_epi,nombre',
                'oficial:id_oficial,nombres,apellidos,ci,id_grado',
                'oficial.grado:id_grado,abreviatura,nombre',
                'usuario:id_usuario,usuario,id_epi',
                'usuario.epi:id_epi,nombre',
            ]);
        }

        if ($idEpi) {
            $query->where('id_epi', $idEpi);
        }

        return $query->orderByDesc('fecha_subida')
            ->limit($limite)
            ->get(['id_documento', 'codigo_documento', 'referencia', 'fecha_subida', 'id_tipo', 'estado_actual', 'id_epi', 'id_oficial', 'id_usuario']);
    }
}
