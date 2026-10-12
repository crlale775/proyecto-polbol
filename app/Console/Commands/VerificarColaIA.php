<?php

namespace App\Console\Commands;

use App\Services\ColaVerificacionIA;
use Illuminate\Console\Command;

/**
 * VerificarColaIA — Worker de la cola FIFO de verificación automática.
 *
 * Uso manual:                php artisan ia:procesar-cola
 * Como demonio (continuo):   php artisan ia:procesar-cola --daemon
 *
 * Cada solicitud del formulario público entra a la cola automáticamente y
 * este worker la procesa en orden de llegada (primero en entrar, primero en
 * salir) — sin botones ni intervención humana.
 */
class VerificarColaIA extends Command
{
    protected $signature = 'ia:procesar-cola {--daemon : Ejecutar en bucle continuo} {--pausa=3 : Segundos entre ciclos en modo daemon}';

    protected $description = 'Procesa la cola FIFO de verificación IA de solicitudes de registro (memo + foto de perfil)';

    public function handle(ColaVerificacionIA $cola): int
    {
        $daemon = (bool) $this->option('daemon');
        $pausa = max(1, (int) config('ia.cola_pausa', 3));

        if (!$cola->verificadorDisponible()) {
            $this->error('La IA local no está configurada (defina IA_URL e IA_MODEL en el .env).');

            return self::FAILURE;
        }

        if (!$daemon) {
            $procesadas = $cola->procesarPendientes();
            $this->info($procesadas === 0
                ? 'Cola vacía: no hay solicitudes pendientes de verificación.'
                : "Verificaciones completadas: {$procesadas}.");

            return self::SUCCESS;
        }

        $this->info('Worker IA iniciado (Ctrl+C para detener). Procesando la cola FIFO…');

        while (true) { // @phpstan-ignore-line
            try {
                $solicitud = $cola->procesarSiguiente();

                if ($solicitud === null) {
                    sleep($pausa);
                    continue;
                }

                $this->info("Solicitud #{$solicitud->id_solicitud} ({$solicitud->nombres} {$solicitud->apellidos}) verificada → ia_advertencia: " . ($solicitud->ia_advertencia ? 'SÍ' : 'no'));
            } catch (\Throwable $e) {
                $this->error('Error en el worker: ' . $e->getMessage());
                sleep($pausa);
            }
        }
    }
}
