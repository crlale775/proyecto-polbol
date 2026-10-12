<?php

namespace App\Http\Controllers;

use App\Models\Notificacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificacionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Notificacion::with('documento');

        if ($request->has('id_usuario')) {
            $query->where('id_usuario', $request->input('id_usuario'));
        }

        $notificaciones = $query->orderBy('fecha', 'desc')->get();
        return response()->json($notificaciones);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_usuario' => 'required|integer|exists:usuarios,id_usuario',
            'id_documento' => 'nullable|integer|exists:documentos,id_documento',
            'titulo' => 'required|string|max:150',
            'mensaje' => 'required|string',
            'leido' => 'nullable|boolean',
            'fecha' => 'nullable|date',
        ]);

        $validated['leido'] = $validated['leido'] ?? false;
        $validated['fecha'] = $validated['fecha'] ?? now();

        $notificacion = Notificacion::create($validated);
        return response()->json($notificacion, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $notificacion = Notificacion::findOrFail($id);
        return response()->json($notificacion);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $notificacion = Notificacion::findOrFail($id);

        $validated = $request->validate([
            'id_usuario' => 'sometimes|required|integer|exists:usuarios,id_usuario',
            'id_documento' => 'nullable|integer|exists:documentos,id_documento',
            'titulo' => 'sometimes|required|string|max:150',
            'mensaje' => 'sometimes|required|string',
            'leido' => 'nullable|boolean',
            'fecha' => 'nullable|date',
        ]);

        $notificacion->update($validated);
        return response()->json($notificacion);
    }

    public function destroy(string|int $id): JsonResponse
    {
        $notificacion = Notificacion::findOrFail($id);
        $notificacion->delete();
        return response()->json(['message' => 'Eliminado correctamente']);
    }
}
