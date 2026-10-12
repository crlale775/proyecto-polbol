# -*- coding: utf-8 -*-
"""Sonda directa a LM Studio (qwen2-vl-2b) con distintos conjuntos de recortes."""
import base64
import json
import sys
import urllib.request

URL = "http://127.0.0.1:1234/api/v1/chat"
MODEL = "qwen2-vl-2b-instruct"


def preguntar(texto, imgs):
    input_ = [{"type": "text", "content": texto}]
    for p in imgs:
        with open(p, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        ext = "png"
        input_.append({"type": "image", "data_url": f"data:image/{ext};base64,{b64}"})
    body = json.dumps({"model": MODEL, "temperature": 0, "input": input_}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        out = json.load(r)
    contenido = ""
    for bloque in out.get("output", []):
        if bloque.get("type") == "message":
            contenido += bloque.get("content", "")
    return contenido.strip()


if __name__ == "__main__":
    base = sys.argv[1] if len(sys.argv) > 1 else ".test_tmp/out/pagina_1"
    full = base + ".png"
    c11, c12, c21, c22 = base + "_c1_1.png", base + "_c1_2.png", base + "_c2_1.png", base + "_c2_2.png"

    caso = sys.argv[2] if len(sys.argv) > 2 else "nombres"
    if caso == "nombres":
        print("==> NOMBRES con [c1_1, c1_2]")
        print(preguntar(
            "Imagen de un memorándum institucional. Identifica la persona DESIGNADA, "
            "que aparece después de 'Al Señor(a):' y antes de 'Presente.-' (ignora grados "
            "como Sgt. y cargos; ignora también el nombre de la autoridad que firma abajo). "
            'Responde SOLO con JSON válido: {"destinatario": "Nombre Completo" o null, '
            '"autoridad": "Nombre de quien firma" o null}. Sin texto adicional.',
            [c11, c12],
        ))
    elif caso == "firma":
        print("==> FIRMA/SELLO con [c2_1, c2_2]")
        print(preguntar(
            "Recortes ampliados de la parte inferior de un memorándum firmado. "
            'Responde SOLO con JSON válido: {"firma": true/false (hay rúbrica manuscrita '
            'sobre el nombre impreso), "sello": true/false (hay timbre institucional circular '
            'de tinta morada/azul)}. Sin texto adicional.',
            [c21, c22],
        ))
    else:
        print("==> TODO con [full, c11, c12, c21, c22]")
        print(preguntar(
            "Memorándum: dime la persona DESIGNADA tras 'Al Señor(a):', quien firma, y si hay "
            "firma manuscrita y sello. Responde SOLO con JSON: {\"destinatario\": ..., "
            '"autoridad": ..., "firma": bool, "sello": bool}. Sin texto adicional.',
            [full, c11, c12, c21, c22],
        ))
