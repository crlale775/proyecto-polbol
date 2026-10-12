<?php

namespace App\Http\Controllers;

use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UsuarioController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Usuario::with(['rol', 'epi']);

        if ($request->has('id_rol')) {
            $query->where('id_rol', $request->input('id_rol'));
        }

        if ($request->has('id_epi')) {
            $query->where('id_epi', $request->input('id_epi'));
        }

        if ($request->has('estado')) {
            $query->where('estado', filter_var($request->input('estado'), FILTER_VALIDATE_BOOLEAN));
        }

        $usuarios = $query->orderBy('id_usuario')->get();
        return response()->json($usuarios);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id_rol' => 'required|exists:roles,id_rol',
            'id_epi' => 'nullable|exists:epis,id_epi',
            'usuario' => 'required|string|max:50|unique:usuarios,usuario',
            'password' => 'required|string|min:4',
            'correo' => 'required|email|max:100|unique:usuarios,correo',
            'foto' => 'nullable|string|max:255',
            'estado' => 'nullable|boolean',
        ]);

        $validated['password'] = Hash::make($validated['password']);
        $validated['estado'] = $validated['estado'] ?? true;
        $validated['created_at'] = now();

        $usuario = Usuario::create($validated);
        $usuario->load(['rol', 'epi']);

        return response()->json($usuario, 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $usuario = Usuario::with(['rol', 'epi'])->findOrFail($id);
        return response()->json($usuario);
    }

    public function update(Request $request, string|int $id): JsonResponse
    {
        $usuario = Usuario::findOrFail($id);

        $validated = $request->validate([
            'id_rol' => 'sometimes|required|exists:roles,id_rol',
            'id_epi' => 'nullable|exists:epis,id_epi',
            'usuario' => 'sometimes|required|string|max:50|unique:usuarios,usuario,' . $id . ',id_usuario',
            'password' => 'nullable|string|min:4',
            'correo' => 'sometimes|required|email|max:100|unique:usuarios,correo,' . $id . ',id_usuario',
            'foto' => 'nullable|string|max:255',
            'estado' => 'nullable|boolean',
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $usuario->update($validated);
        $usuario->load(['rol', 'epi']);

        return response()->json($usuario);
    }

    public function destroy(string|int $id): JsonResponse
    {
        // Regla institucional de negocio: NUNCA eliminar físicamente un usuario, solo desactivar
        $usuario = Usuario::findOrFail($id);
        $usuario->estado = false;
        $usuario->save();

        return response()->json([
            'message' => 'Usuario desactivado correctamente en el sistema (baja lógica)',
            'usuario' => $usuario->load(['rol', 'epi']),
        ]);
    }

    public function resetPassword(Request $request, string|int $id): JsonResponse
    {
        $usuario = Usuario::findOrFail($id);
        $newPassword = $request->input('password', 'ale775');
        
        $usuario->password = Hash::make($newPassword);
        $usuario->save();

        return response()->json([
            'message' => 'Contraseña restablecida exitosamente',
            'usuario' => $usuario->load(['rol', 'epi']),
        ]);
    }

    /**
     * Subida de foto de perfil del usuario autenticado (secretario, revisor, etc.).
     * Guarda la imagen en storage/app/public/fotos/usuarios y actualiza el campo foto.
     */
    public function subirFoto(Request $request): JsonResponse
    {
        $request->validate([
            'foto' => 'required|image|mimes:jpg,jpeg,png|max:2048',
        ]);

        $idUsuario = $request->input('id_usuario');
        if (!$idUsuario) {
            return response()->json(['message' => 'No se identificó al usuario.'], 422);
        }

        $usuario = Usuario::findOrFail($idUsuario);

        $archivo = $request->file('foto');
        $nombre = 'usuario_' . $usuario->id_usuario . '_' . time() . '.' . $archivo->getClientOriginalExtension();
        $ruta = $archivo->storeAs('fotos/usuarios', $nombre, 'public');

        $usuario->foto = $ruta;
        $usuario->save();

        return response()->json([
            'message' => 'Foto de perfil actualizada correctamente',
            'ruta' => $ruta,
            'usuario' => $usuario->load(['rol', 'epi']),
        ]);
    }
}
