<?php

namespace Database\Seeders;

use App\Models\TipoDocumento;
use App\Models\TipoMemo;
use Illuminate\Database\Seeder;

/**
 * TiposMemoSeeder — define el PATRÓN INSTITUCIONAL COMPARTIDO de los
 * memorándums de la Policía Boliviana.
 *
 * Todos los tipos comparten la misma estructura (encabezado → destinatario →
 * cuerpo → cierre) y las mismas validaciones base; cada tipo añade sus
 * palabras clave. Es idempotente: se puede correr varias veces sin duplicar.
 */
class TiposMemoSeeder extends Seeder
{
    /** Secciones comunes a todo memorándum institucional. */
    private function formatoBase(array $extra = []): array
    {
        return [
            'secciones' => [
                ['titulo' => 'Encabezado institucional', 'campos' => ['Membrete', 'Código del memorándum', 'Lugar y fecha']],
                ['titulo' => 'Destinatario', 'campos' => ['Grado', 'Nombres y apellidos', 'Cargo y dependencia']],
                ['titulo' => 'Cuerpo del memorándum', 'campos' => array_merge(['Referencia', 'Asunto', 'Fundamentación'], $extra)],
                ['titulo' => 'Cierre y firmas', 'campos' => ['Firma de la autoridad', 'Sello institucional', 'Nombre y cargo']],
            ],
            'pie' => 'Presente.-',
        ];
    }

    private function validacionesBase(array $palabrasExtra = [], int $longitudMinima = 400): array
    {
        $campos = [
            'Membrete', 'Código del memorándum', 'Lugar y fecha',
            'Grado', 'Nombres y apellidos', 'Cargo y dependencia',
            'Referencia', 'Asunto', 'Fundamentación',
            'Firma de la autoridad', 'Sello institucional', 'Nombre y cargo',
        ];

        return [
            'campos_requeridos' => $campos,
            'longitud_minima' => $longitudMinima,
            'palabras_clave' => array_merge(['Policía Boliviana', 'memorándum'], $palabrasExtra),
            'requiere_firma' => true,
            'requiere_sello' => true,
        ];
    }

    public function run(): void
    {
        $tipos = TipoDocumento::pluck('id_tipo', 'nombre');

        $definiciones = [
            [
                'nombre_tipo_documento' => 'Memorándum disciplinario',
                'nombre' => 'Memorándum Disciplinario',
                'codigo' => 'MEMO_DISCIPLINARIO',
                'categoria' => 'Disciplinario',
                'color' => '#991b1b',
                'descripcion' => 'Comunica faltas, sanciones o procesos disciplinarios al personal policial.',
                'palabras' => ['falta', 'sanción', 'disciplinario'],
            ],
            [
                'nombre_tipo_documento' => 'Memorándum felicitación',
                'nombre' => 'Memorándum de Felicitación',
                'codigo' => 'MEMO_FELICITACION',
                'categoria' => 'Reconocimiento',
                'color' => '#b8860b',
                'descripcion' => 'Reconoce el desempeño destacado o actos meritorios del personal.',
                'palabras' => ['felicitación', 'reconocimiento', 'destacado'],
            ],
            [
                'nombre_tipo_documento' => 'Permiso',
                'nombre' => 'Memorándum de Permiso',
                'codigo' => 'MEMO_PERMISO',
                'categoria' => 'Administrativo',
                'color' => '#1a5c52',
                'descripcion' => 'Autoriza permisos especiales o ausencias justificadas del servicio.',
                'palabras' => ['permiso', 'autorización'],
            ],
            [
                'nombre_tipo_documento' => 'Vacación',
                'nombre' => 'Memorándum de Vacación',
                'codigo' => 'MEMO_VACACION',
                'categoria' => 'Administrativo',
                'color' => '#4b5563',
                'descripcion' => 'Concede o programa el periodo de vacaciones del personal.',
                'palabras' => ['vacación', 'descanso', 'días'],
            ],
            [
                'nombre_tipo_documento' => 'Designación',
                'nombre' => 'Memorándum de Designación',
                'codigo' => 'MEMO_DESIGNACION',
                'categoria' => 'Personal',
                'color' => '#3d4a2c',
                'descripcion' => 'Designa al personal en un cargo, comisión o unidad específica.',
                'palabras' => ['designación', 'comisión', 'destino'],
            ],
        ];

        foreach ($definiciones as $def) {
            $idTipo = $tipos[$def['nombre_tipo_documento']] ?? null;

            TipoMemo::firstOrCreate(
                ['codigo' => $def['codigo']],
                [
                    'id_tipo' => $idTipo,
                    'nombre' => $def['nombre'],
                    'categoria' => $def['categoria'],
                    'descripcion' => $def['descripcion'],
                    'color' => $def['color'],
                    'activo' => true,
                    'formato' => $this->formatoBase(),
                    'validaciones' => $this->validacionesBase($def['palabras']),
                ]
            );
        }
    }
}
