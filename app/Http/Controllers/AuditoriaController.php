<?php

namespace App\Http\Controllers;

use App\Models\Auditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditoriaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Auditoria::with(['usuario.rol', 'usuario.epi']);

        if ($request->has('id_usuario')) {
            $query->where('id_usuario', $request->input('id_usuario'));
        }

        if ($request->has('accion')) {
            $query->where('accion', 'like', '%' . $request->input('accion') . '%');
        }

        if ($request->has('tabla')) {
            $query->where('tabla', $request->input('tabla'));
        }

        $auditorias = $query->orderBy('fecha', 'desc')->get();
        return response()->json($auditorias);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_usuario' => 'required|exists:usuarios,id_usuario',
            'tabla' => 'required|string|max:100',
            'accion' => 'required|string|max:50',
            'descripcion' => 'required|string',
            'fecha' => 'nullable|date',
        ]);

        $validated['fecha'] = $validated['fecha'] ?? now();
        $auditoria = Auditoria::create($validated);
        $auditoria->load(['usuario.rol', 'usuario.epi']);

        return response()->json($auditoria, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $auditoria = Auditoria::with(['usuario.rol', 'usuario.epi'])->findOrFail($id);
        return response()->json($auditoria);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $auditoria = Auditoria::findOrFail($id);

        $validated = $request->validate([
            'id_usuario' => 'sometimes|required|exists:usuarios,id_usuario',
            'tabla' => 'sometimes|required|string|max:100',
            'accion' => 'sometimes|required|string|max:50',
            'descripcion' => 'sometimes|required|string',
            'fecha' => 'nullable|date',
        ]);

        $auditoria->update($validated);
        $auditoria->load(['usuario.rol', 'usuario.epi']);

        return response()->json($auditoria);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $auditoria = Auditoria::findOrFail($id);
        $auditoria->delete();
        return response()->json(['message' => 'Registro de auditoría eliminado']);
    }
}
