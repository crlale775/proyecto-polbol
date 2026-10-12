# -*- coding: utf-8 -*-
"""
Genera 2 memorandums de designación con el formato REAL de la Policía Boliviana
(Centro de Orientación Femenina de "Obrajes") según las fotos del usuario:
membrete institucional, bloque "Al Señor(a): ... Presente.-", REF.- DESIGNACIÓN,
firma manuscrita sobre el nombre impreso de la Directora y sello circular morado.

  memo_designa_alejandro.pdf  → designado: Sgt. 2do. ALEJANDRO QUISPE MAMANI
  memo_designa_estela.pdf     → designado: Sgt. 2do. ESTELA SANTUSA HUALLPA MAMANI

Requiere: pymupdf
"""
import os
import random

import pymupdf as fitz

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)))


def dibujar_firma(pag, x, y, semilla=7):
    """Rúbrica manuscrita suave (tipo bolígrafo) sobre el nombre impreso."""
    import math
    rnd = random.Random(semilla)
    tinta = (0.02, 0.05, 0.35)

    # trazo principal: onda suave con pequeñas oscilaciones
    puntos = []
    for px in range(x, x + 170, 2):
        t = (px - x) / 170.0
        py = y - 2 - 10 * math.sin(t * math.pi * 1.6 + 0.6) + 3 * math.sin(t * 17 + rnd.uniform(0, 6))
        puntos.append((px, py))
    pag.draw_polyline(puntos, color=tinta, width=2.4, closePath=False)

    # bucle inicial ascendente (como la "L" o garabato de inicio)
    pag.draw_bezier(
        (x - 6, y + 8), (x + 18, y - 26), (x + 34, y + 10), (x + 16, y + 4),
        color=tinta, width=2.2,
    )
    # segundo bucle pequeño al final
    pag.draw_bezier(
        (x + 150, y - 4), (x + 186, y - 22), (x + 204, y + 4), (x + 178, y + 8),
        color=tinta, width=2.2,
    )
    # rasgo descendente que cruza sobre el nombre impreso (típico)
    pag.draw_polyline(
        [(x + 168, y - 8), (x + 224, y + 16), (x + 236, y + 24)],
        color=tinta, width=2.0, closePath=False,
    )
    # subrayado
    pag.draw_polyline(
        [(x - 4, y + 12), (x + 120, y + 8)],
        color=tinta, width=1.6, closePath=False,
    )


def dibujar_sello(pag, cx, cy, radio=66):
    """Sello circular institucional de tinta morada, con texto en el borde."""
    import math
    morado = (0.5, 0.12, 0.55)
    rnd = random.Random(3)
    # anillo exterior grueso + anillo interior
    pag.draw_circle((cx, cy), radio, color=morado, width=3.6)
    pag.draw_circle((cx, cy), radio - 10, color=morado, width=1.6)
    # franja interior: texto del sello en dos líneas altas
    pag.insert_text((cx - 52, cy - 34), "DIRECCIÓN NACIONAL", fontsize=7.2, color=morado, fontname="hebo")
    pag.insert_text((cx - 56, cy - 25), "DE RÉGIMEN", fontsize=7.2, color=morado, fontname="hebo")
    pag.insert_text((cx - 56, cy - 14), "PENITENCIARIO", fontsize=7.2, color=morado, fontname="hebo")
    # centro: escudo estilizado + texto
    pag.draw_circle((cx, cy), 8, color=morado, width=1.3)
    pag.draw_line((cx - 8, cy), (cx + 8, cy), color=morado, width=1.0)
    pag.draw_line((cx, cy - 8), (cx, cy + 8), color=morado, width=1.0)
    pag.insert_text((cx - 33, cy + 20), "CENTRO DE ORIENTACIÓN", fontsize=6.2, color=morado)
    pag.insert_text((cx - 26, cy + 29), "FEMENINA \"OBRAJES\"", fontsize=6.4, color=morado)
    pag.insert_text((cx - 18, cy + 38), "LA PAZ · BOLIVIA", fontsize=6.0, color=morado)
    # dientes del borde (marca de goma)
    for ang in range(0, 360, 8):
        a = math.radians(ang + rnd.uniform(-1.5, 1.5))
        x1 = cx + (radio + 4) * math.cos(a)
        y1 = cy + (radio + 4) * math.sin(a)
        x2 = cx + (radio + 9) * math.cos(a)
        y2 = cy + (radio + 9) * math.sin(a)
        pag.draw_line((x1, y1), (x2, y2), color=morado, width=2.0)


def crear_memo(ruta, designado_nombre, designado_cargo, numero, fecha):
    doc = fitz.open()
    pag = doc.new_page(width=842, height=595)  # A4 apaisado (como los reales)
    negro = (0.12, 0.12, 0.12)
    azul = (0.05, 0.1, 0.45)

    # fondo levemente "escaneado"
    pag.draw_rect(fitz.Rect(0, 0, 842, 595), color=None, fill=(0.985, 0.977, 0.955))

    # ---- Membrete superior ----
    pag.insert_text((52, 40), "ESTADO PLURINACIONAL DE BOLIVIA", fontsize=9, color=azul, fontname="hebo")
    pag.insert_text((52, 54), "BICENTENARIO DE BOLIVIA", fontsize=9, color=azul, fontname="hebo")
    pag.draw_circle((36, 66), 12, color=azul, width=1.4)
    pag.insert_text((28, 64), "★", fontsize=11, color=azul)
    pag.insert_text((560, 34), "DIRECCIÓN: Av. Arce esq. Belisario Salinas Nº 2409", fontsize=7.5, color=negro)
    pag.insert_text((560, 46), "Teléfonos: 2120002 · 2120003 · Fax: 2442225", fontsize=7.5, color=negro)
    pag.insert_text((560, 58), "Ministerio de Gobierno · Estado Plurinacional de Bolivia", fontsize=7.5, color=negro)
    pag.insert_text((560, 70), "\"2025 BICENTENARIO DE BOLIVIA\"", fontsize=8, color=negro)

    # ---- Título central ----
    pag.insert_text((360, 62), "MEMORANDUM", fontsize=24, color=negro, fontname="hebo")

    # ---- Bloque izquierdo: origen ----
    pag.insert_text((52, 108), "CENTRO DE ORIENTACIÓN", fontsize=10, color=negro, fontname="hebo")
    pag.insert_text((52, 120), "FEMENINA DE \"OBRAJES\"", fontsize=10, color=negro, fontname="hebo")
    pag.insert_text((52, 142), f"Sec. Gral. Seg. Nº {numero}/2025", fontsize=9, color=negro)
    pag.insert_text((52, 156), f"La Paz, {fecha} de 2025", fontsize=9, color=negro)

    # ---- Bloque derecho: DESTINATARIO (clave para la IA) ----
    yy = 132
    pag.insert_text((430, yy), "Al Señor (a):", fontsize=10, color=negro, fontname="hebo")
    yy += 14
    pag.insert_text((430, yy), designado_nombre, fontsize=10.5, color=negro, fontname="hebo")
    yy += 14
    for parte in designado_cargo.split("\n"):
        pag.insert_text((430, yy), parte, fontsize=8.5, color=negro)
        yy += 11
    pag.insert_text((430, yy + 2), "Presente.-", fontsize=10, color=negro, fontname="hebo")

    # ---- REF ----
    pag.insert_text((52, 192), "REF.- DESIGNACIÓN", fontsize=10, color=negro, fontname="hebo")

    # ---- Cuerpo ----
    cuerpo = (
        "Por disposición de esta Dirección, en la fecha Usted, es designada como "
        "ENCARGADA DE CUSTODIOS, de este Centro de Orientación Femenina de Obrajes, "
        "exhortándole asumir sus funciones en el día encomendadas observando lo "
        "establecido en los Arts. 68, 70, 71 y 72 de la Ley Nº 2298, Ley de Ejecución "
        "Penal y Supervisión, así como el Manual de Organización y Funciones de la "
        "Dirección Nacional de Seguridad Penitenciaria y Dirección de Establecimientos "
        "Penitenciarios; todo trabajo será en coordinación con esta Dirección."
    )
    pag.insert_textbox(
        fitz.Rect(52, 212, 790, 300), cuerpo, fontsize=10, color=negro, fontname="helv",
        align=0, lineheight=1.35,
    )

    cuerpo2 = (
        "El incumplimiento al presente Memorándum dará lugar a tomar medidas "
        "disciplinarias conforme establece la Ley Nº 101 de Régimen Disciplinario de "
        "la Policía Boliviana, en actual vigencia."
    )
    pag.insert_textbox(
        fitz.Rect(52, 300, 790, 340), cuerpo2, fontsize=10, color=negro, fontname="helv",
        align=0, lineheight=1.35,
    )

    # ---- Despedida y lema ----
    pag.insert_text((52, 372), "Con este motivo, saludo a usted muy atentamente.", fontsize=10, color=negro)
    pag.insert_text((52, 560), "\"DISCIPLINA, VALOR Y VOCACIÓN DE SERVICIO\"", fontsize=9.5, color=azul, fontname="hebo")

    # ---- Firma de la autoridad ----
    fx, fy = 490, 452
    pag.insert_text((fx, fy), "Cnl. Msc. CAD. Lupe Justina Maldonado Torrez", fontsize=10.5, color=negro, fontname="hebo")
    pag.insert_text((fx, fy + 16), "DIRECTORA DEL CENTRO DE ORIENTACIÓN", fontsize=8.6, color=negro)
    pag.insert_text((fx, fy + 28), "FEMENINA DE \"OBRAJES\"", fontsize=8.6, color=negro)
    dibujar_firma(pag, fx + 8, fy - 12, semilla=11)

    # ---- Sello morado sobre el texto (como el real) ----
    dibujar_sello(pag, 380, 420, radio=64)

    doc.save(ruta)
    doc.close()
    print("OK", ruta)


if __name__ == "__main__":
    crear_memo(
        os.path.join(OUT, "memo_designa_alejandro.pdf"),
        "Sgt. 2do. Alejandro Quispe Mamani",
        "SUBOFICIAL DE SEGURIDAD INTERNA DEL\nCENTRO DE ORIENTACIÓN FEMENINA DE \"OBRAJES\"",
        "148", "26 de agosto",
    )
    crear_memo(
        os.path.join(OUT, "memo_designa_estela.pdf"),
        "Sgt. 2do. Estela Santusa Huallpa Mamani",
        "SUBOFICIAL DE SEGURIDAD INTERNA DEL\nCENTRO DE ORIENTACIÓN FEMENINA DE \"OBRAJES\"",
        "151", "26 de agosto",
    )
