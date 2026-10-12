<?php

namespace App\Http\Controllers;

use App\Models\ComandoDepartamental;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ComandoDepartamentalController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(ComandoDepartamental::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:100',
            'departamento' => 'required|string|max:50',
        ]);

        $comando = ComandoDepartamental::create($validated);
        return response()->json($comando, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $comando = ComandoDepartamental::findOrFail($id);
        return response()->json($comando);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $comando = ComandoDepartamental::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|required|string|max:100',
            'departamento' => 'sometimes|required|string|max:50',
        ]);

        $comando->update($validated);
        return response()->json($comando);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $comando = ComandoDepartamental::findOrFail($id);
        $comando->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
