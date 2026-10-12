<?php

namespace App\Http\Controllers;

use App\Models\Norma;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NormaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Norma::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'codigo' => 'required|string|max:50|unique:normas,codigo',
            'nombre' => 'required|string|max:255',
            'version' => 'required|string|max:20',
            'vigente' => 'nullable|boolean',
            'fecha_inicio' => 'required|date',
            'fecha_fin' => 'nullable|date',
        ]);

        $validated['vigente'] = $validated['vigente'] ?? true;

        $norma = Norma::create($validated);
        return response()->json($norma, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $norma = Norma::findOrFail($id);
        return response()->json($norma);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $norma = Norma::findOrFail($id);

        $validated = $request->validate([
            'codigo' => 'sometimes|required|string|max:50|unique:normas,codigo,' . $id . ',id_norma',
            'nombre' => 'sometimes|required|string|max:255',
            'version' => 'sometimes|required|string|max:20',
            'vigente' => 'nullable|boolean',
            'fecha_inicio' => 'sometimes|required|date',
            'fecha_fin' => 'nullable|date',
        ]);

        $norma->update($validated);
        return response()->json($norma);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $norma = Norma::findOrFail($id);
        $norma->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
