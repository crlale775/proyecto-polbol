<?php

return [
    /*
    |--------------------------------------------------------------------------
    | IA LOCAL DE VERIFICACIÓN DOCUMENTAL (firma, sello y nombres en el memo)
    |--------------------------------------------------------------------------
    | Servidor: LM Studio (compatible OpenAI).
    |   'url'      → http://IP:PUERTO   (ej. http://127.0.0.1:1234)
    |   'endpoint' → POST {url}/api/v1/chat  con body:
    |                   { "model": "qwen/qwen2.5-vl-7b",
    |                     "temperature": 0,
    |                     "input": [ {"type":"text","content":"..."},
    |                                {"type":"image","data_url":"data:image/png;base64,..."} ] }
    |   y respuesta {"output":[{"type":"message","content":"..."}]}
    |
    | MODELO ÚNICO: qwen/qwen2.5-vl-7b (visión, Q4_K_M, ~6 GB).
    |   Un solo modelo cargado en LM Studio responde TODAS las consultas
    |   (nombre del destinatario, firma y sello). Esto elimina el intercambio
    |   de modelos en caliente (descargar 7B → cargar 9B → ...), que era la
    |   causa principal de verificaciones lentas (4+ minutos) y timeouts.
    |
    | Carga recomendada en LM Studio (equipo: RTX 3050 4 GB + 28 GB RAM):
    |   context_length 16384, parallel 1, flash_attention on,
    |   offload_kv_cache_to_gpu on.
    |
    | PARA MÁXIMA VELOCIDAD (revisión en vivo de ~90s → ~10-25s):
    |   1. Tener cargado UN SOLO modelo: qwen/qwen2.5-vl-7b en cuantización
    |      Q4_K_M (≈ 6 GB). El intercambio de modelos en caliente es la causa
    |      más común de lentitud (LM Studio descarga/recarga pesos en cada
    |      petición). Si el equipo no da abasto, usar qwen2.5-vl-3b Q4_K_M
    |      (≈ 2× más rápido, algo menos preciso en OCR de escaneos).
    |   2. En LM Studio → pestaña del modelo cargado:
    |      - "GPU Offload" al máximo (toda la capa a la GPU); con 4 GB VRAM
    |        bajar a 24-32 capas si falla por memoria.
    |      - Flash Attention: ON.
    |      - Context length: 8192 (suficiente para una imagen; 16384 no acelera).
    |      - Parallel requests: 1 (una sola consulta a la vez).
    |      - Keep model in memory: ON (evita recargar el modelo entre revisiones).
    |      - Speculative decoding: OFF (con 4 GB VRAM suele ralentizar).
    |   3. En .env: IA_DPI_RAPIDO=96 e IA_TIMEOUT_RAPIDO=60; la revisión del
    |      módulo Subir Documento usa UNA sola consulta de visión.
    |   4. El pipeline del registro público (memo) también se aceleró: primero
    |      se consulta la PÁGINA COMPLETA (1 consulta para destinatario + 1
    |      para firma/sello) y solo si falta algo se usan los recortes 2x2
    |      como respaldo (antes eran hasta 7 consultas secuenciales).
    |   5. La foto de perfil se reduce a 1024 px antes de enviarla (GD).
    */
    'url' => env('IA_URL', ''),
    'endpoint' => env('IA_ENDPOINT', '/api/v1/chat'),
    'model' => env('IA_MODEL', 'qwen/qwen2.5-vl-7b'),
    // Obsoleto: ya no se usa modelo alternativo (el modelo único hace todo).
    'model_fallback' => env('IA_MODEL_FALLBACK', ''),
    'timeout' => (int) env('IA_TIMEOUT', 120),
    'timeout_fallback' => (int) env('IA_TIMEOUT_FALLBACK', 120),
    'max_paginas' => (int) env('IA_MAX_PAGINAS', 1),
    // 120 DPI es suficiente para el OCR del 7B y reduce ~35% los tokens de
    // visión frente a 150 DPI (menos píxeles = respuestas más rápidas).
    'dpi' => (int) env('IA_DPI', 120),

    /*
    | Revisión RÁPIDA en vivo (módulo "Subir Documento").
    |   'dpi_rapido'    → resolución de la 1ª página para la consulta única
    |                     (110 ya es suficiente para leer un memo; menos
    |                     píxeles = menos tokens = respuesta más rápida).
    |   'timeout_rapido'→ tope de espera por la consulta única (segundos).
    */
    'dpi_rapido' => (int) env('IA_DPI_RAPIDO', 96),
    'timeout_rapido' => (int) env('IA_TIMEOUT_RAPIDO', 60),

    /*
    | Cola FIFO de verificación automática.
    |   'cola_lote' → solicitudes máximo por invocación de `php artisan ia:procesar-cola`.
    |   'cola_pausa' → segundos de espera del worker daemon cuando la cola está vacía.
    */
    'cola_lote' => (int) env('IA_COLA_LOTE', 10),
    'cola_pausa' => (int) env('IA_COLA_PAUSA', 3),
];
