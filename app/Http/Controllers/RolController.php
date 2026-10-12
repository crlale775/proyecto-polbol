<?php

namespace App\Http\Controllers;

use App\Models\Rol;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RolController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Rol::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:50|unique:roles,nombre',
            'descripcion' => 'nullable|string',
            'estado' => 'nullable|boolean',
        ]);

        $validated['estado'] = $validated['estado'] ?? true;

        $rol = Rol::create($validated);
        return response()->json($rol, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $rol = Rol::findOrFail($id);
        return response()->json($rol);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $rol = Rol::findOrFail($id);

        $validated = $request->validate([
            'nombre' => 'sometimes|required|string|max:50|unique:roles,nombre,' . $id . ',id_rol',
            'descripcion' => 'nullable|string',
            'estado' => 'nullable|boolean',
        ]);

        $rol->update($validated);
        return response()->json($rol);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $rol = Rol::findOrFail($id);
        $rol->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
