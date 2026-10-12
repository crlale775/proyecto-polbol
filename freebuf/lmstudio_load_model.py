"""OFBOL — Reaplica la config de carga del modelo IA en LM Studio.

LM Studio NO persiste la config de carga personalizada tras un reinicio
(vuelve a parallel=4 con slots de 2048 tokens, que desperdicia VRAM y
contexto). Este script espera a que el servidor este disponible y vuelve
a cargar qwen2.5-vl-7b con la config optimizada para este equipo
(RTX 3050 Laptop 4 GB VRAM + Ryzen 9 6900HS + 27.7 GB RAM).

Uso:
    python lmstudio_load_model.py [--espera N]
    (--espera N = segundos maximos de espera al servidor; default 300)
"""
import json
import sys
import time
import urllib.request

URL_BASE = "http://127.0.0.1:1234"
MODELO = "qwen/qwen2.5-vl-7b"

# Config optimizada para RTX 3050 4 GB (ver freebuf/cambios.txt)
CONFIG = {
    "context_length": 16384,
    "parallel": 1,
    "flash_attention": True,
    "offload_kv_cache_to_gpu": True,
    "eval_batch_size": 2048,
    "physical_batch_size": 512,
}


def _post(ruta, cuerpo, timeout=300):
    peticion = urllib.request.Request(
        URL_BASE + ruta,
        data=json.dumps(cuerpo).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(peticion, timeout=timeout) as r:
        return json.loads(r.read().decode())


def _get(ruta, timeout=10):
    with urllib.request.urlopen(URL_BASE + ruta, timeout=timeout) as r:
        return json.loads(r.read().decode())


def estado_carga():
    """Devuelve (ok: bool, estado: str, instancias: list).

    IMPORTANTE: LM Studio permite cargar VARIAS instancias del mismo modelo
    (p.ej. la buena + otra parallel=4 tras un reinicio): eso divide la VRAM.
    Solo se considera OK si hay EXACTAMENTE una instancia con la config optima.
    """
    try:
        datos = _get("/api/v1/models")
    except Exception:
        return False, "servidor-no-disponible", []
    instancias = []
    for m in datos.get("models", []):
        if m.get("key") != MODELO:
            continue
        # Cada instancia tiene un id unico: "qwen/qwen2.5-vl-7b", ":2", ":3"...
        instancias = list(m.get("loaded_instances", []))
        break
    if len(instancias) == 0:
        return False, "catalogado-sin-cargar", instancias
    if len(instancias) > 1:
        return False, "multi-instancia(%d)" % len(instancias), instancias
    c = instancias[0].get("config", {})
    if c.get("parallel") == 1 and c.get("context_length") == 16384:
        return True, "ya-cargado-config-correcta", instancias
    return False, "cargado-config-vieja(parallel=%s)" % c.get("parallel"), instancias


def esperar_servidor(segundos_max):
    """Espera hasta que el servidor responda /api/v1/models."""
    inicio = time.time()
    while time.time() - inicio < segundos_max:
        ok, estado, _ = estado_carga()
        if estado != "servidor-no-disponible":
            return True
        time.sleep(5)
    return False


def limpiar_todas():
    """Descarga TODAS las instancias del modelo. Cada una tiene un id unico
    (p.ej. "qwen/qwen2.5-vl-7b:2"); el unload exige ese id exacto.
    Devuelve True solo si al final quedan 0 instancias."""
    for _ in range(10):
        ok, estado, instancias = estado_carga()
        if len(instancias) == 0:
            return True
        descargadas = 0
        for inst in instancias:
            iid = inst.get("id") or MODELO
            try:
                _post("/api/v1/models/unload", {"instance_id": iid}, timeout=60)
                print("[..] unload %s OK" % iid)
                descargadas += 1
            except Exception as e:
                print("[..] unload %s fallo: %s" % (iid, e))
        time.sleep(3 if descargadas else 5)
    return len(estado_carga()[2]) == 0


def recargar():
    """Deja el modelo con EXACTAMENTE una instancia con la config optima."""
    ok, estado, _ = estado_carga()
    if ok:
        print("[OK] %s: %s" % (MODELO, estado))
        return 0
    print("[..] Estado: %s" % estado)

    if not limpiar_todas():
        print("[ERROR] No se pudo dejar el modelo descargado; no se carga encima.")
        return 1

    cuerpo = {"model": MODELO}
    cuerpo.update(CONFIG)
    r = _post("/api/v1/models/load", cuerpo)
    print("[OK] Cargado en %.1fs (status: %s)" % (r.get("load_time_seconds", -1), r.get("status")))

    ok, estado, _ = estado_carga()
    if ok:
        print("[OK] Verificado: %s" % estado)
        return 0
    print("[ERROR] La verificacion post-carga fallo: %s" % estado)
    return 1


def main():
    espera_max = 300
    if "--espera" in sys.argv:
        try:
            espera_max = int(sys.argv[sys.argv.index("--espera") + 1])
        except (IndexError, ValueError):
            pass

    print("Esperando a LM Studio en %s (max %ds)..." % (URL_BASE, espera_max))
    if not esperar_servidor(espera_max):
        print("[ERROR] Timeout esperando al servidor de LM Studio.")
        return 1
    print("[..] Servidor disponible.")
    return recargar()


if __name__ == "__main__":
    sys.exit(main())
