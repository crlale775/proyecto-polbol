<?php

namespace App\Http\Controllers;

use App\Models\Validacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ValidacionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Validacion::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_documento' => 'required|integer|exists:documentos,id_documento',
            'id_regla' => 'required|integer|exists:reglas,id_regla',
            'resultado' => 'required|string|max:20|in:Correcto,Advertencia,Error',
            'mensaje' => 'required|string',
            'fecha' => 'nullable|date',
        ]);

        $validacion = Validacion::create($validated);
        return response()->json($validacion, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $validacion = Validacion::findOrFail($id);
        return response()->json($validacion);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $validacion = Validacion::findOrFail($id);

        $validated = $request->validate([
            'id_documento' => 'sometimes|required|integer|exists:documentos,id_documento',
            'id_regla' => 'sometimes|required|integer|exists:reglas,id_regla',
            'resultado' => 'sometimes|required|string|max:20|in:Correcto,Advertencia,Error',
            'mensaje' => 'sometimes|required|string',
            'fecha' => 'nullable|date',
        ]);

        $validacion->update($validated);
        return response()->json($validacion);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $validacion = Validacion::findOrFail($id);
        $validacion->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
