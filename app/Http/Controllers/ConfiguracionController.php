<?php

namespace App\Http\Controllers;

use App\Models\Configuracion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConfiguracionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Configuracion::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:100|unique:configuracion,nombre',
            'valor' => 'required|string',
        ]);

        $configuracion = Configuracion::create($validated);
        return response()->json($configuracion, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $configuracion = Configuracion::findOrFail($id);
        return response()->json($configuracion);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $configuracion = Configuracion::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|required|string|max:100|unique:configuracion,nombre,' . $id . ',id',
            'valor' => 'sometimes|required|string',
        ]);

        $configuracion->update($validated);
        return response()->json($configuracion);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $configuracion = Configuracion::findOrFail($id);
        $configuracion->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
