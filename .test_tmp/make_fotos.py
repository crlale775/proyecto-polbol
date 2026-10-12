# -*- coding: utf-8 -*-
"""
Simula el caso REAL: el oficial fotografía su memo y lo sube.
Convierte los memos vectoriales en "fotos" (papel sobre fondo de escritorio,
ligeramente rotado) y los incrusta en PDF a resolución nativa.
"""
import os

import pymupdf as fitz
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
ANCHO_FOTO = 2350  # px de ancho del papel en la foto


def memo_a_foto(pdf_in, jpg_out):
    doc = fitz.open(pdf_in)
    escala = ANCHO_FOTO / 842.0
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(escala, escala))
    papel = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

    # fondo tipo escritorio
    margen = int(ANCHO_FOTO * 0.10)
    fondo = Image.new("RGB", (papel.width + 2 * margen, papel.height + 2 * margen), (185, 180, 172))
    papel = papel.rotate(1.1, resample=Image.BICUBIC, expand=False, fillcolor=(185, 180, 172))
    x0 = (fondo.width - papel.width) // 2
    y0 = (fondo.height - papel.height) // 2
    fondo.paste(papel, (x0, y0))
    fondo.save(jpg_out, quality=90)
    print("OK foto", jpg_out, fondo.size)


def foto_a_pdf(jpg_in, pdf_out):
    im = Image.open(jpg_in)
    w, h = im.size
    doc = fitz.open()
    page = doc.new_page(width=w, height=h)
    page.insert_image(fitz.Rect(0, 0, w, h), filename=jpg_in)
    doc.save(pdf_out)
    doc.close()
    print("OK pdf", pdf_out)


if __name__ == "__main__":
    for nombre in ["alejandro", "estela"]:
        jpg = os.path.join(BASE, f"foto_memo_{nombre}.jpg")
        pdf = os.path.join(BASE, f"memo_foto_{nombre}.pdf")
        memo_a_foto(os.path.join(BASE, f"memo_designa_{nombre}.pdf"), jpg)
        foto_a_pdf(jpg, pdf)
