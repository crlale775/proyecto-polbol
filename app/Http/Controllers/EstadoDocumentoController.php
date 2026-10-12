<?php

namespace App\Http\Controllers;

use App\Models\EstadoDocumento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EstadoDocumentoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(EstadoDocumento::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:50|unique:estados_documento,nombre',
        ]);

        $estado = EstadoDocumento::create($validated);
        return response()->json($estado, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $estado = EstadoDocumento::findOrFail($id);
        return response()->json($estado);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $estado = EstadoDocumento::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|required|string|max:50|unique:estados_documento,nombre,' . $id . ',id_estado',
        ]);

        $estado->update($validated);
        return response()->json($estado);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $estado = EstadoDocumento::findOrFail($id);
        $estado->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
