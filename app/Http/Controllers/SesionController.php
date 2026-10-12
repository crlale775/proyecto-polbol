<?php

namespace App\Http\Controllers;

use App\Models\Sesion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SesionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Sesion::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_usuario' => 'required|integer|exists:usuarios,id_usuario',
            'ip' => 'required|string|max:45',
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date',
        ]);

        $validated['fecha_inicio'] = $validated['fecha_inicio'] ?? now();

        $sesion = Sesion::create($validated);
        return response()->json($sesion, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $sesion = Sesion::findOrFail($id);
        return response()->json($sesion);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $sesion = Sesion::findOrFail($id);

        $validated = $request->validate([
            'id_usuario' => 'sometimes|required|integer|exists:usuarios,id_usuario',
            'ip' => 'sometimes|required|string|max:45',
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date',
        ]);

        $sesion->update($validated);
        return response()->json($sesion);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $sesion = Sesion::findOrFail($id);
        $sesion->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
