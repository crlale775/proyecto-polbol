<?php

namespace App\Http\Controllers;

use App\Models\Plantilla;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlantillaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Plantilla::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:150',
            'tipo_documento' => 'required|integer|exists:tipos_documento,id_tipo',
            'ruta_archivo' => 'required|string|max:500',
        ]);

        $plantilla = Plantilla::create($validated);
        return response()->json($plantilla, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $plantilla = Plantilla::findOrFail($id);
        return response()->json($plantilla);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $plantilla = Plantilla::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|required|string|max:150',
            'tipo_documento' => 'sometimes|required|integer|exists:tipos_documento,id_tipo',
            'ruta_archivo' => 'sometimes|required|string|max:500',
        ]);

        $plantilla->update($validated);
        return response()->json($plantilla);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $plantilla = Plantilla::findOrFail($id);
        $plantilla->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
