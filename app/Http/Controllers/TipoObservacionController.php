<?php

namespace App\Http\Controllers;

use App\Models\TipoObservacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TipoObservacionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(TipoObservacion::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:100|unique:tipos_observacion,nombre',
            'descripcion' => 'nullable|string',
        ]);

        $tipo = TipoObservacion::create($validated);
        return response()->json($tipo, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $tipo = TipoObservacion::findOrFail($id);
        return response()->json($tipo);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $tipo = TipoObservacion::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|required|string|max:100|unique:tipos_observacion,nombre,' . $id . ',id_tipo',
            'descripcion' => 'nullable|string',
        ]);

        $tipo->update($validated);
        return response()->json($tipo);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $tipo = TipoObservacion::findOrFail($id);
        $tipo->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
