<?php

namespace App\Http\Controllers;

use App\Models\Epi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EpiController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Epi::all());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_comando' => 'required|integer|exists:comando_departamental,id_comando',
            'nombre' => 'required|string|max:100',
            'direccion' => 'nullable|string',
            'telefono' => 'nullable|string|max:20',
            'estado' => 'nullable|boolean',
        ]);

        $validated['estado'] = $validated['estado'] ?? true;

        $epi = Epi::create($validated);
        return response()->json($epi, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $epi = Epi::findOrFail($id);
        return response()->json($epi);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $epi = Epi::findOrFail($id);

        $validated = $request->validate([
            'id_comando' => 'sometimes|required|integer|exists:comando_departamental,id_comando',
            'nombre' => 'sometimes|required|string|max:100',
            'direccion' => 'nullable|string',
            'telefono' => 'nullable|string|max:20',
            'estado' => 'nullable|boolean',
        ]);

        $epi->update($validated);
        return response()->json($epi);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $epi = Epi::findOrFail($id);
        $epi->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
