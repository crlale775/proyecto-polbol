<?php

namespace App\Http\Controllers;

use App\Models\Grado;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GradoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Grado::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:50',
            'abreviatura' => 'required|string|max:10',
        ]);

        $grado = Grado::create($validated);
        return response()->json($grado, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $grado = Grado::findOrFail($id);
        return response()->json($grado);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $grado = Grado::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|required|string|max:50',
            'abreviatura' => 'sometimes|required|string|max:10',
        ]);

        $grado->update($validated);
        return response()->json($grado);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $grado = Grado::findOrFail($id);
        $grado->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
