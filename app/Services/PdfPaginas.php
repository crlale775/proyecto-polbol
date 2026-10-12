<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * PdfPaginas — Convierte las primeras páginas de un PDF a imágenes PNG
 * (data URLs base64) para que la IA de visión (qwen2-vl en LM Studio) pueda
 * analizar el memorándum.
 *
 * Orden de rasterizadores disponibles:
 *   1. Python + PyMuPDF (script database/render_pdf.py)  → recomendado
 *   2. Ghostscript  (gs / gswin64c)
 *   3. Poppler      (pdftoppm)
 */
class PdfPaginas
{
    /**
     * @return array<int, array{archivo:string, data_url:string}>
     */
    public function renderizar(string $rutaAbsoluta, ?int $maxPaginas = null, ?int $dpi = null): array
    {
        $maxPaginas = $maxPaginas ?? (int) config('ia.max_paginas', 3);
        $dpi = $dpi ?? (int) config('ia.dpi', 150);

        if (!is_file($rutaAbsoluta)) {
            throw new RuntimeException("El archivo PDF no existe: {$rutaAbsoluta}");
        }

        $dir = storage_path('app/ia_tmp_' . uniqid());
        @mkdir($dir, 0777, true);

        try {
            $intentos = [
                fn () => $this->conPython($rutaAbsoluta, $dir, $maxPaginas, $dpi),
                fn () => $this->conGhostscript($rutaAbsoluta, $dir, $maxPaginas, $dpi),
                fn () => $this->conPoppler($rutaAbsoluta, $dir, $maxPaginas, $dpi),
            ];

            $pngs = [];
            foreach ($intentos as $intento) {
                try {
                    $pngs = $intento();
                } catch (\Throwable) {
                    $pngs = [];
                }
                if (count($pngs) > 0) {
                    break;
                }
            }

            if (count($pngs) === 0) {
                throw new RuntimeException(
                    'No fue posible convertir el PDF a imágenes para la IA de visión. ' .
                    'Instale PyMuPDF en Python:  python -m pip install pymupdf   ' .
                    '(o instale Ghostscript/Poppler). El archivo PDF no tiene capa de texto utilizable y no hay rasterizador disponible.'
                );
            }

            sort($pngs, SORT_NATURAL);

            return array_map(function (string $png) {
                $binario = file_get_contents($png);
                if ($binario === false) {
                    throw new RuntimeException("No se pudo leer la imagen generada: {$png}");
                }

                return [
                    'archivo' => basename($png),
                    'data_url' => 'data:image/png;base64,' . base64_encode($binario),
                ];
            }, $pngs);
        } finally {
            $this->eliminarDirectorio($dir);
        }
    }

    protected function conPython(string $pdf, string $dir, int $maxPaginas, int $dpi): array
    {
        $script = database_path('render_pdf.py');
        $errores = [];

        foreach (['python', 'py', 'python3'] as $binario) {
            try {
                $proceso = Process::timeout(180)
                    ->run([$binario, $script, $pdf, $dir, (string) $maxPaginas, (string) $dpi]);
                $salida = trim($proceso->output());
                $json = json_decode($salida, true);

                if (is_array($json) && ($json['ok'] ?? false)) {
                    return array_map(
                        fn (string $f) => $dir . DIRECTORY_SEPARATOR . $f,
                        $json['archivos'] ?? []
                    );
                }
                $errores[] = $binario . ': ' . ($json['error'] ?? $salida);
            } catch (\Throwable $e) {
                $errores[] = $binario . ': ' . $e->getMessage();
            }
        }

        return [];
    }

    protected function conGhostscript(string $pdf, string $dir, int $maxPaginas, int $dpi): array
    {
        $binarios = ['gswin64c', 'gswin32c', 'gs'];
        foreach ($binarios as $gs) {
            try {
                $proceso = Process::timeout(180)->run([
                    $gs,
                    '-sDEVICE=png16m',
                    '-r' . $dpi,
                    '-dFirstPage=1',
                    '-dLastPage=' . $maxPaginas,
                    '-dNOPAUSE',
                    '-dBATCH',
                    '-sOutputFile=' . $dir . DIRECTORY_SEPARATOR . 'pagina-%d.png',
                    $pdf,
                ]);
                if ($proceso->successful() || $proceso->exitCode() === 0) {
                    return glob($dir . DIRECTORY_SEPARATOR . 'pagina-*.png') ?: [];
                }
            } catch (\Throwable) {
                // probar el siguiente binario
            }
        }

        return [];
    }

    protected function conPoppler(string $pdf, string $dir, int $maxPaginas, int $dpi): array
    {
        foreach (['pdftoppm', 'pdfimages'] as $binario) {
            if ($binario === 'pdftoppm') {
                try {
                    $proceso = Process::timeout(180)->run([
                        'pdftoppm', '-png', '-r', (string) $dpi,
                        '-f', '1', '-l', (string) $maxPaginas,
                        $pdf, $dir . DIRECTORY_SEPARATOR . 'pg',
                    ]);
                    if ($proceso->successful() || $proceso->exitCode() === 0) {
                        return glob($dir . DIRECTORY_SEPARATOR . 'pg-*.png') ?: [];
                    }
                } catch (\Throwable) {
                    // siguiente
                }
            } else {
                // pdfimages extrae imágenes embebidas (memo escaneado).
                try {
                    $proceso = Process::timeout(180)->run([
                        'pdfimages', '-png', '-f', '1', '-l', (string) $maxPaginas,
                        $pdf, $dir . DIRECTORY_SEPARATOR . 'img',
                    ]);
                    if ($proceso->successful() || $proceso->exitCode() === 0) {
                        return glob($dir . DIRECTORY_SEPARATOR . 'img-*.png') ?: [];
                    }
                } catch (\Throwable) {
                    // siguiente
                }
            }
        }

        return [];
    }

    protected function eliminarDirectorio(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (glob($dir . DIRECTORY_SEPARATOR . '*') ?: [] as $archivo) {
            @unlink($archivo);
        }
        @rmdir($dir);
    }
}
