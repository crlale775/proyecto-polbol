<?php

namespace App\Http\Controllers;

use App\Models\Sesion;
use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Autenticación institucional OFBOL.
     * Verifica credenciales contra la tabla usuarios (hash bcrypt),
     * rechaza cuentas desactivadas y registra la sesión en la tabla sesiones.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'usuario' => ['required', 'string', 'max:50'],
            'password' => ['required', 'string'],
        ]);

        $usuario = Usuario::whereRaw('LOWER(usuario) = ?', [mb_strtolower(trim($validated['usuario']))])
            ->with(['rol', 'epi'])
            ->first();

        if (! $usuario || ! Hash::check($validated['password'], $usuario->password)) {
            return response()->json(['message' => 'Usuario o contraseña incorrectos.'], 401);
        }

        if (! $usuario->estado) {
            return response()->json(['message' => 'El usuario se encuentra desactivado. Contacte al Comando General para su reactivación.'], 403);
        }

        Sesion::create([
            'id_usuario' => $usuario->id_usuario,
            'ip' => $request->ip() ?: '127.0.0.1',
            'fecha_inicio' => now(),
        ]);

        return response()->json($usuario->load(['rol', 'epi']));
    }
}
