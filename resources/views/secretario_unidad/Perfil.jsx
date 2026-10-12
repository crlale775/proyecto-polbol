/**
 * Perfil — información institucional del Secretario EPI y datos de su cuenta
 * Conecta con:
 *   - UsuarioController → GET/PUT /api/usuarios/{id}  (incluye campo foto)
 *   - Subida de foto    → POST /api/upload-foto
 *
 * La anatomía de la ficha vive en `ui/PerfilInstitucional`; acá queda lo propio
 * de esta vista: el cambio de foto y la nota de responsabilidad.
 */
import React, { useState, useRef } from 'react';
import { Camera } from 'lucide-react';
import LayoutSecretario from '../../js/components/LayoutSecretario';
import Alert from '../../js/components/ui/Alert';
import AvatarFoto from '../../js/components/ui/AvatarFoto';
import PerfilInstitucional from '../../js/components/ui/PerfilInstitucional';
import { useAuth } from '../../js/context/AuthContext';
import api from '../../js/lib/api';

export default function Perfil() {
    const { user } = useAuth();
    const [msg, setMsg] = useState(null);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const inputFotoRef = useRef(null);

    const cambiarFoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !user?.id_usuario) return;
        if (!file.type.startsWith('image/')) {
            setMsg({ tipo: 'error', texto: 'El archivo debe ser una imagen (JPG o PNG).' });
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setMsg({ tipo: 'error', texto: 'La imagen no debe superar los 2 MB.' });
            return;
        }
        setSubiendoFoto(true);
        try {
            const fd = new FormData();
            fd.append('foto', file);
            fd.append('id_usuario', user.id_usuario);
            const res = await api.upload('/upload-foto', fd);
            if (res?.ruta) {
                // Actualizar la sesión con la nueva foto
                const actualizado = { ...user, foto: res.ruta };
                sessionStorage.setItem('ofbol_user', JSON.stringify(actualizado));
                window.location.reload();
            }
        } catch (err) {
            setMsg({ tipo: 'error', texto: err.message || 'No se pudo subir la foto.' });
        } finally {
            setSubiendoFoto(false);
            if (inputFotoRef.current) inputFotoRef.current.value = '';
        }
    };

    return (
        <LayoutSecretario>
            <div className="p-6 lg:p-8 max-w-4xl mx-auto ofbol-page-enter">
                {msg && (
                    <div className="mb-5">
                        <Alert type={msg.tipo} onClose={() => setMsg(null)}>{msg.texto}</Alert>
                    </div>
                )}

                <PerfilInstitucional
                    titulo="Perfil institucional"
                    nota="Información del personal y credenciales activas del sistema."
                    acento="#8a9a6d"
                    nombreMostrado={user?.usuario ?? 'Secretario EPI'}
                    correoMostrado={user?.correo ?? 'usuario@policia.bo'}
                    rolMostrado={user?.rol ?? 'Secretario de Unidad (EPI)'}
                    insignias={[{ texto: user?.epi ?? 'EPI asignada', tono: 'papel' }]}
                    avatar={
                        <>
                            <AvatarFoto
                                foto={user?.foto}
                                nombre={user?.usuario}
                                iniciales={user?.usuario?.[0]?.toUpperCase() ?? 'S'}
                                className="w-16 h-16 rounded-[14px] text-2xl"
                                fallbackClassName="bg-[#1a5c52]"
                                ring
                            />
                            <button
                                type="button"
                                onClick={() => inputFotoRef.current?.click()}
                                disabled={subiendoFoto}
                                aria-label="Cambiar foto de perfil"
                                title="Cambiar foto de perfil"
                                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-colors disabled:opacity-60"
                                style={{ background: 'var(--ofbol-teal)', color: '#fff', border: '2px solid #0f1613' }}
                            >
                                {subiendoFoto ? (
                                    <span
                                        className="block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Camera size={13} />
                                )}
                            </button>
                            <input
                                ref={inputFotoRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                aria-label="Seleccionar foto de perfil"
                                onChange={cambiarFoto}
                            />
                        </>
                    }
                    datos={[
                        { etiqueta: 'Usuario', valor: user?.usuario ?? '—' },
                        { etiqueta: 'Correo', valor: user?.correo ?? '—' },
                        { etiqueta: 'Unidad policial (EPI)', valor: user?.epi ?? '—' },
                        { etiqueta: 'Rol en el sistema', valor: user?.rol ?? 'Secretario EPI' },
                        { etiqueta: 'Estado de la cuenta', valor: user?.estado !== false ? 'Activo' : 'Inactivo' },
                        { etiqueta: 'Comando departamental', valor: 'La Paz — Sede Central' },
                    ]}
                >
                    <section className="ofbol-card p-5">
                        <h2 className="ofbol-titulo-seccion">Responsabilidad y términos de uso</h2>
                        <p className="ofbol-nota mt-2">
                            El Secretario de Unidad responde por el registro fidedigno de los memorándums y
                            documentos físicos recibidos en la EPI asignada, y por la integridad de los archivos
                            PDF remitidos.
                        </p>
                    </section>
                </PerfilInstitucional>
            </div>
        </LayoutSecretario>
    );
}
