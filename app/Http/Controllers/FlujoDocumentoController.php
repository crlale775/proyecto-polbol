<?php

namespace App\Http\Controllers;

use App\Models\FlujoDocumento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FlujoDocumentoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(FlujoDocumento::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_documento' => 'required|integer|exists:documentos,id_documento',
            'origen' => 'required|string|max:100',
            'destino' => 'required|string|max:100',
            'usuario' => 'required|integer|exists:usuarios,id_usuario',
            'fecha' => 'nullable|date',
        ]);

        $validated['fecha'] = $validated['fecha'] ?? now();

        $flujo = FlujoDocumento::create($validated);
        return response()->json($flujo, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $flujo = FlujoDocumento::findOrFail($id);
        return response()->json($flujo);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $flujo = FlujoDocumento::findOrFail($id);

        $validated = $request->validate([
            'id_documento' => 'sometimes|required|integer|exists:documentos,id_documento',
            'origen' => 'sometimes|required|string|max:100',
            'destino' => 'sometimes|required|string|max:100',
            'usuario' => 'sometimes|required|integer|exists:usuarios,id_usuario',
            'fecha' => 'nullable|date',
        ]);

        $flujo->update($validated);
        return response()->json($flujo);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $flujo = FlujoDocumento::findOrFail($id);
        $flujo->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
