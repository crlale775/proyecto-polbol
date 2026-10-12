<?php

namespace App\Http\Controllers;

use App\Models\Articulo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticuloController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Articulo::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_norma' => 'required|integer|exists:normas,id_norma',
            'numero' => 'required|string|max:20',
            'titulo' => 'nullable|string|max:255',
            'texto' => 'required|string',
        ]);

        $articulo = Articulo::create($validated);
        return response()->json($articulo, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $articulo = Articulo::findOrFail($id);
        return response()->json($articulo);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $articulo = Articulo::findOrFail($id);

        $validated = $request->validate([
            'id_norma' => 'sometimes|required|integer|exists:normas,id_norma',
            'numero' => 'sometimes|required|string|max:20',
            'titulo' => 'nullable|string|max:255',
            'texto' => 'sometimes|required|string',
        ]);

        $articulo->update($validated);
        return response()->json($articulo);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $articulo = Articulo::findOrFail($id);
        $articulo->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
