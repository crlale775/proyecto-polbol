<?php

namespace App\Http\Controllers;

use App\Models\Auditoria;
use App\Models\Documento;
use App\Models\TipoDocumento;
use App\Models\TipoMemo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * TipoMemoController — Gestión de los TIPOS DE MEMORÁNDUM institucionales.
 *
 * Solo el Comando General administra este catálogo. Cada tipo define un
 * "patrón" (formato) y sus validaciones, que se guardan como JSONB.
 *
 * Protecciones:
 *   · Nombre y código únicos (el código es un identificador estable).
 *   · Un tipo ligado a documentos registrados NO se puede eliminar.
 *   · Eliminar exige confirmar el nombre exacto (confirmacion).
 *   · Toda creación/edición/eliminación queda en la auditoría institucional.
 */
class TipoMemoController extends Controller
{
    public function index(): JsonResponse
    {
        // Uso real por tipo de documento (una sola consulta agregada)
        $usos = Documento::select('id_tipo', DB::raw('count(*) as total'))
            ->groupBy('id_tipo')
            ->pluck('total', 'id_tipo');

        $tipos = TipoDocumento::orderBy('nombre')->get();

        $conMemo = TipoMemo::pluck('id_tipo')->filter()->all();

        $memos = TipoMemo::with('tipoDocumento')
            ->orderBy('nombre')
            ->get()
            ->map(fn (TipoMemo $m) => array_merge($m->toArray(), [
                'usos' => (int) ($usos[$m->id_tipo] ?? 0),
            ]));

        // Tipos de memorándum más usados (según los documentos registrados)
        $masUsados = $tipos
            ->map(fn ($t) => [
                'id_tipo' => $t->id_tipo,
                'tipo' => $t->nombre,
                'total' => (int) ($usos[$t->id_tipo] ?? 0),
                'definido' => in_array($t->id_tipo, $conMemo, true),
            ])
            ->filter(fn ($t) => $t['total'] > 0)
            ->sortByDesc('total')
            ->values();

        // Tipos usados pero SIN patrón definido → sugerencias para crear el memo
        $sugerencias = $masUsados->filter(fn ($t) => !$t['definido'])->values();

        return response()->json([
            'memos' => $memos,
            'mas_usados' => $masUsados,
            'sugerencias' => $sugerencias,
            'tipos_documento' => $tipos,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->reglas());

        $memo = TipoMemo::create($validated);

        $this->auditar($request, 'TIPO_MEMO_CREADO', sprintf(
            'Creación del tipo de memorándum "%s" (%s).',
            $memo->nombre,
            $memo->codigo
        ));

        return response()->json($memo->load('tipoDocumento'), 201);
    }

    public function show(string|int $id): JsonResponse
    {
        return response()->json(TipoMemo::with('tipoDocumento')->findOrFail($id));
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $memo = TipoMemo::findOrFail($id);

        $validated = $request->validate($this->reglas($memo->id_memo));

        $cambios = [];
        foreach ($validated as $campo => $valor) {
            if ($memo->getAttribute($campo) != $valor) {
                $cambios[] = $campo;
            }
        }

        $memo->update($validated);

        $this->auditar($request, 'TIPO_MEMO_EDITADO', sprintf(
            'Edición del tipo de memorándum "%s" (%s). Campos modificados: %s.',
            $memo->nombre,
            $memo->codigo,
            $cambios ? implode(', ', $cambios) : 'ninguno'
        ));

        return response()->json($memo->load('tipoDocumento'));
    }

    public function destroy(Request $request, string|int $id): JsonResponse
    {
        $memo = TipoMemo::findOrFail($id);

        // Protección: confirmación explícita por nombre exacto
        $confirmacion = trim((string) $request->input('confirmacion', ''));
        if ($confirmacion !== $memo->nombre) {
            return response()->json([
                'message' => 'Debe escribir el nombre exacto del tipo de memorándum para confirmar la eliminación.',
            ], 422);
        }

        // Protección: no se elimina un tipo que ya tiene documentos registrados
        if ($memo->id_tipo) {
            $usos = Documento::where('id_tipo', $memo->id_tipo)->count();
            if ($usos > 0) {
                return response()->json([
                    'message' => "No se puede eliminar \"{$memo->nombre}\": tiene {$usos} documento(s) registrado(s) en el sistema.",
                ], 409);
            }
        }

        $nombre = $memo->nombre;
        $codigo = $memo->codigo;
        $memo->delete();

        $this->auditar($request, 'TIPO_MEMO_ELIMINADO', sprintf(
            'Eliminación del tipo de memorándum "%s" (%s).',
            $nombre,
            $codigo
        ));

        return response()->json(['message' => 'Tipo de memorándum eliminado correctamente.']);
    }

    /**
     * Reglas compartidas por creación y edición (mismo patrón para todos los
     * tipos: secciones → campos → validaciones).
     *
     * @return array<string, mixed>
     */
    private function reglas(?int $id = null): array
    {
        return [
            'id_tipo' => [
                'nullable', 'integer', 'exists:tipos_documento,id_tipo',
                Rule::unique('tipos_memo', 'id_tipo')->ignore($id, 'id_memo'),
            ],
            'nombre' => [
                'required', 'string', 'max:120',
                Rule::unique('tipos_memo', 'nombre')->ignore($id, 'id_memo'),
            ],
            'codigo' => [
                'required', 'string', 'max:30', 'regex:/^[A-Z0-9][A-Z0-9_-]*$/',
                Rule::unique('tipos_memo', 'codigo')->ignore($id, 'id_memo'),
            ],
            'categoria' => 'nullable|string|max:60',
            'descripcion' => 'nullable|string|max:1000',
            'color' => ['nullable', 'string', 'max:20', 'regex:/^#[0-9a-fA-F]{3,8}$/'],
            'activo' => 'boolean',

            // Formato: secciones con campos + pie institucional
            'formato' => 'nullable|array',
            'formato.secciones' => 'nullable|array|max:20',
            'formato.secciones.*.titulo' => 'required|string|max:120',
            'formato.secciones.*.campos' => 'nullable|array|max:30',
            'formato.secciones.*.campos.*' => 'string|max:120',
            'formato.pie' => 'nullable|string|max:200',

            // Validaciones institucionales del patrón
            'validaciones' => 'nullable|array',
            'validaciones.campos_requeridos' => 'nullable|array|max:60',
            'validaciones.campos_requeridos.*' => 'string|max:120',
            'validaciones.longitud_minima' => 'nullable|integer|min:0|max:100000',
            'validaciones.palabras_clave' => 'nullable|array|max:30',
            'validaciones.palabras_clave.*' => 'string|max:60',
            'validaciones.requiere_firma' => 'boolean',
            'validaciones.requiere_sello' => 'boolean',
        ];
    }

    private function auditar(Request $request, string $accion, string $descripcion): void
    {
        $idUsuario = $request->input('id_usuario');
        if (!$idUsuario) {
            return;
        }

        try {
            Auditoria::create([
                'id_usuario' => $idUsuario,
                'tabla' => 'tipos_memo',
                'accion' => $accion,
                'descripcion' => $descripcion,
                'fecha' => now(),
            ]);
        } catch (\Throwable) {
            // La auditoría nunca debe tumbar la operación principal
        }
    }
}
