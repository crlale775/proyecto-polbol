<?php

namespace App\Http\Controllers;

use App\Models\VersionDocumento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VersionDocumentoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(VersionDocumento::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_documento' => 'required|integer|exists:documentos,id_documento',
            'version' => 'required|integer|min:1',
            'ruta_pdf' => 'required|string|max:500',
            'fecha' => 'nullable|date',
            'subido_por' => 'required|integer|exists:usuarios,id_usuario',
        ]);

        $validated['fecha'] = $validated['fecha'] ?? now();

        $version = VersionDocumento::create($validated);
        return response()->json($version, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $version = VersionDocumento::findOrFail($id);
        return response()->json($version);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $version = VersionDocumento::findOrFail($id);

        $validated = $request->validate([
            'id_documento' => 'sometimes|required|integer|exists:documentos,id_documento',
            'version' => 'sometimes|required|integer|min:1',
            'ruta_pdf' => 'sometimes|required|string|max:500',
            'fecha' => 'nullable|date',
            'subido_por' => 'sometimes|required|integer|exists:usuarios,id_usuario',
        ]);

        $version->update($validated);
        return response()->json($version);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $version = VersionDocumento::findOrFail($id);
        $version->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
