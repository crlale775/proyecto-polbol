<?php

namespace App\Http\Controllers;

use App\Models\Oficial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OficialController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Oficial::with(['grado', 'epi', 'cargo']);

        if ($request->has('id_epi')) {
            $query->where('id_epi', $request->input('id_epi'));
        }

        if ($request->has('id_grado')) {
            $query->where('id_grado', $request->input('id_grado'));
        }

        if ($request->has('estado')) {
            $query->where('estado', filter_var($request->input('estado'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('nombres', 'ilike', "%{$search}%")
                  ->orWhere('apellidos', 'ilike', "%{$search}%")
                  ->orWhere('ci', 'ilike', "%{$search}%")
                  ->orWhere('escalafon', 'ilike', "%{$search}%");
            });
        }

        $oficiales = $query->orderBy('id_grado')->orderBy('apellidos')->get();
        return response()->json($oficiales);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_grado' => 'required|exists:grados,id_grado',
            'id_epi' => 'required|exists:epis,id_epi',
            'id_cargo' => 'required|exists:cargos,id_cargo',
            'numero_item' => 'nullable|string|max:20|unique:oficiales,numero_item',
            'codigo_institucional' => 'nullable|string|max:30|unique:oficiales,codigo_institucional',
            'escalafon' => 'required|string|max:50|unique:oficiales,escalafon',
            'ci' => 'required|string|max:20|unique:oficiales,ci',
            'nombres' => 'required|string|max:100',
            'apellidos' => 'required|string|max:100',
            'foto' => 'nullable|string|max:255',
            'estado' => 'nullable|boolean',
        ]);

        $oficial = Oficial::create($validated);
        return response()->json($oficial->load(['grado', 'epi', 'cargo']), 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $oficial = Oficial::with(['grado', 'epi', 'cargo', 'historialDestinos', 'documentos.tipoDocumento', 'documentos.estado'])->findOrFail($id);
        return response()->json($oficial);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $oficial = Oficial::findOrFail($id);

        $validated = $request->validate([
            'id_grado' => 'sometimes|required|exists:grados,id_grado',
            'id_epi' => 'sometimes|required|exists:epis,id_epi',
            'id_cargo' => 'sometimes|required|exists:cargos,id_cargo',
            'numero_item' => 'nullable|string|max:20|unique:oficiales,numero_item,' . $id . ',id_oficial',
            'codigo_institucional' => 'nullable|string|max:30|unique:oficiales,codigo_institucional,' . $id . ',id_oficial',
            'escalafon' => 'sometimes|required|string|max:50|unique:oficiales,escalafon,' . $id . ',id_oficial',
            'ci' => 'sometimes|required|string|max:20|unique:oficiales,ci,' . $id . ',id_oficial',
            'nombres' => 'sometimes|required|string|max:100',
            'apellidos' => 'sometimes|required|string|max:100',
            'foto' => 'nullable|string|max:255',
            'estado' => 'nullable|boolean',
        ]);

        $oficial->update($validated);
        return response()->json($oficial->load(['grado', 'epi', 'cargo']));
    }

    public function destroy(string|int $id): JsonResponse
    {
        $oficial = Oficial::findOrFail($id);
        $oficial->delete();
        return response()->json(['message' => 'Oficial eliminado correctamente']);
    }
}
