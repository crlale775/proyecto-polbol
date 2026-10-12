@echo off
REM =====================================================
REM  OFBOL - Reaplica la config de carga del modelo IA
REM  en LM Studio tras un reinicio (parallel=1, ctx 16384,
REM  flash attention, KV en GPU).
REM
REM  - Doble click: ejecuta y muestra el resultado.
REM  - Autoarranque: Win+R -> shell:startup -> crear acceso
REM    directo a este .bat. En LM Studio deja activado
REM    "Start server on startup".
REM =====================================================
title OFBOL - LM Studio modelo optimizado
echo === OFBOL: reaplicando config del modelo en LM Studio ===
python "C:\laragon\www\ofbol\freebuf\lmstudio_load_model.py" --espera 300
echo.
echo === Cerrando en 10 segundos... ===
timeout /t 10 /nobreak >nul
