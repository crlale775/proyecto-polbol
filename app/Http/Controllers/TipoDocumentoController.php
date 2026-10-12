<?php

namespace App\Http\Controllers;

use App\Models\TipoDocumento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TipoDocumentoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(TipoDocumento::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:100|unique:tipos_documento,nombre',
        ]);

        $tipo = TipoDocumento::create($validated);
        return response()->json($tipo, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $tipo = TipoDocumento::findOrFail($id);
        return response()->json($tipo);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $tipo = TipoDocumento::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|required|string|max:100|unique:tipos_documento,nombre,' . $id . ',id_tipo',
        ]);

        $tipo->update($validated);
        return response()->json($tipo);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $tipo = TipoDocumento::findOrFail($id);
        $tipo->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
