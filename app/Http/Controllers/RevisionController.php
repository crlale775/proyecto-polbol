<?php

namespace App\Http\Controllers;

use App\Models\Revision;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RevisionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Revision::with(['documento', 'revisor', 'tipoObservacion']);

        if ($request->has('id_documento')) {
            $query->where('id_documento', $request->input('id_documento'));
        }

        $revisiones = $query->orderBy('fecha', 'desc')->get();
        return response()->json($revisiones);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_documento' => 'required|exists:documentos,id_documento',
            'usuario_revisor' => 'required|exists:usuarios,id_usuario',
            'id_tipo_observacion' => 'nullable|exists:tipos_observacion,id_tipo',
            'nivel_revision' => 'required|string|max:50',
            'estado' => 'required|string|max:50',
            'observacion_libre' => 'nullable|string',
            'fecha' => 'nullable|date',
        ]);

        $revision = Revision::create($validated);
        return response()->json($revision, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $revision = Revision::with(['documento', 'revisor', 'tipoObservacion'])->findOrFail($id);
        return response()->json($revision);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $revision = Revision::findOrFail($id);

        $validated = $request->validate([
            'id_documento' => 'sometimes|required|exists:documentos,id_documento',
            'usuario_revisor' => 'sometimes|required|exists:usuarios,id_usuario',
            'id_tipo_observacion' => 'nullable|exists:tipos_observacion,id_tipo',
            'nivel_revision' => 'sometimes|required|string|max:50',
            'estado' => 'sometimes|required|string|max:50',
            'observacion_libre' => 'nullable|string',
            'fecha' => 'nullable|date',
        ]);

        $revision->update($validated);
        return response()->json($revision);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $revision = Revision::findOrFail($id);
        $revision->delete();
        return response()->json(['message' => 'Revisión eliminada correctamente']);
    }
}
