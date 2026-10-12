<?php

namespace App\Http\Controllers;

use App\Models\HistorialDestino;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HistorialDestinoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(HistorialDestino::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_oficial' => 'required|integer|exists:oficiales,id_oficial',
            'id_epi' => 'required|integer|exists:epis,id_epi',
            'fecha_inicio' => 'required|date',
            'fecha_fin' => 'nullable|date|after_or_equal:fecha_inicio',
        ]);

        $historial = HistorialDestino::create($validated);
        return response()->json($historial, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $historial = HistorialDestino::findOrFail($id);
        return response()->json($historial);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $historial = HistorialDestino::findOrFail($id);

        $validated = $request->validate([
            'id_oficial' => 'sometimes|required|integer|exists:oficiales,id_oficial',
            'id_epi' => 'sometimes|required|integer|exists:epis,id_epi',
            'fecha_inicio' => 'sometimes|required|date',
            'fecha_fin' => 'nullable|date|after_or_equal:fecha_inicio',
        ]);

        $historial->update($validated);
        return response()->json($historial);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $historial = HistorialDestino::findOrFail($id);
        $historial->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
