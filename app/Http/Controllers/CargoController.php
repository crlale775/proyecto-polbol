<?php

namespace App\Http\Controllers;

use App\Models\Cargo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CargoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Cargo::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:100',
        ]);

        $cargo = Cargo::create($validated);
        return response()->json($cargo, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $cargo = Cargo::findOrFail($id);
        return response()->json($cargo);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $cargo = Cargo::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|required|string|max:100',
        ]);

        $cargo->update($validated);
        return response()->json($cargo);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $cargo = Cargo::findOrFail($id);
        $cargo->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
