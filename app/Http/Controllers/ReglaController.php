<?php

namespace App\Http\Controllers;

use App\Models\Regla;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReglaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Regla::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_articulo' => 'required|integer|exists:articulos,id_articulo',
            'nombre' => 'required|string|max:150',
            'descripcion' => 'nullable|string',
            'tipo_documento' => 'required|integer|exists:tipos_documento,id_tipo',
            'observacion_sugerida' => 'nullable|string',
        ]);

        $regla = Regla::create($validated);
        return response()->json($regla, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $regla = Regla::findOrFail($id);
        return response()->json($regla);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $regla = Regla::findOrFail($id);

        $validated = $request->validate([
            'id_articulo' => 'sometimes|required|integer|exists:articulos,id_articulo',
            'nombre' => 'sometimes|required|string|max:150',
            'descripcion' => 'nullable|string',
            'tipo_documento' => 'sometimes|required|integer|exists:tipos_documento,id_tipo',
            'observacion_sugerida' => 'nullable|string',
        ]);

        $regla->update($validated);
        return response()->json($regla);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $regla = Regla::findOrFail($id);
        $regla->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
