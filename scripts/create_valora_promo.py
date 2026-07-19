#!/usr/bin/env python3
"""Genera il kit promozionale ValOra: PDF A4 multipagina e schede PDF singole."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MANUAL_ASSETS = ROOT / "output" / "manual" / "assets"
FONT_DIR = ROOT / "scripts" / "assets" / "fonts"
COMPANY_LOGOS = ROOT / "scripts" / "assets" / "company_logos"
OUT_DIR = ROOT / "output" / "pdf"
SHEETS_DIR = OUT_DIR / "schede"
MASTER_PDF = OUT_DIR / "valora-kit-schede-informative.pdf"

PAGE_W, PAGE_H = A4
M = 42
CONTENT_W = PAGE_W - 2 * M

NAVY = HexColor("#071626")
NAVY_2 = HexColor("#0D2742")
INK = HexColor("#10243A")
SLATE = HexColor("#4D6378")
MUTED = HexColor("#6E8192")
PAPER = HexColor("#F4F8F8")
WHITE = white
TEAL = HexColor("#10A389")
TEAL_DARK = HexColor("#087A6A")
MINT = HexColor("#74D7AE")
CYAN = HexColor("#25C5C7")
INDIGO = HexColor("#6C47C7")
VIOLET = HexColor("#9A52D1")
COPPER = HexColor("#C56D2D")
AMBER = HexColor("#E7A13A")
RED = HexColor("#C94C5C")
LINE = HexColor("#D8E4E5")
CONTACT_MAILTO = "mailto:francescopiomirizzi@gmail.com?subject=Richiesta%20valutazione%20vertenza"


def register_fonts() -> None:
    font_dir = Path("/System/Library/Fonts/Supplemental")
    pdfmetrics.registerFont(TTFont("Valora", str(font_dir / "Arial.ttf")))
    pdfmetrics.registerFont(TTFont("Valora-Bold", str(font_dir / "Arial Bold.ttf")))
    pdfmetrics.registerFont(TTFont("Valora-Italic", str(font_dir / "Arial Italic.ttf")))
    pdfmetrics.registerFont(TTFont("Valora-Display", str(FONT_DIR / "Inter-SemiBold.ttf")))


def set_alpha(c: canvas.Canvas, fill: float | None = None, stroke: float | None = None) -> None:
    if fill is not None:
        c.setFillAlpha(fill)
    if stroke is not None:
        c.setStrokeAlpha(stroke)


def reset_alpha(c: canvas.Canvas) -> None:
    set_alpha(c, 1, 1)


def wrap_lines(text: str, font: str, size: float, max_width: float) -> list[str]:
    words = text.split()
    if not words:
        return []
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if pdfmetrics.stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def paragraph(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    font: str = "Valora",
    size: float = 10.5,
    leading: float | None = None,
    color=SLATE,
    max_lines: int | None = None,
) -> float:
    leading = leading or size * 1.42
    lines: list[str] = []
    for part in text.split("\n"):
        lines.extend(wrap_lines(part, font, size, width) or [""])
    if max_lines is not None:
        lines = lines[:max_lines]
    c.setFillColor(color)
    c.setFont(font, size)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def label(c: canvas.Canvas, text: str, x: float, y: float, color=TEAL, size: float = 8.2) -> None:
    c.setFillColor(color)
    c.setFont("Valora-Bold", size)
    c.drawString(x, y, text.upper())


def pill(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    bg,
    fg,
    size: float = 8.3,
    pad_x: float = 10,
    height: float = 22,
) -> float:
    w = pdfmetrics.stringWidth(text, "Valora-Bold", size) + 2 * pad_x
    c.setFillColor(bg)
    c.roundRect(x, y, w, height, height / 2, stroke=0, fill=1)
    c.setFillColor(fg)
    c.setFont("Valora-Bold", size)
    c.drawCentredString(x + w / 2, y + (height - size) / 2 + 1.2, text)
    return w


def panel(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    fill=WHITE,
    radius: float = 18,
    stroke=None,
    shadow: bool = True,
) -> None:
    if shadow:
        c.setFillColor(NAVY)
        set_alpha(c, fill=0.09)
        c.roundRect(x + 2, y - 5, w, h, radius, stroke=0, fill=1)
        reset_alpha(c)
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(0.8)
        c.roundRect(x, y, w, h, radius, stroke=1, fill=1)
    else:
        c.roundRect(x, y, w, h, radius, stroke=0, fill=1)


def draw_image_contain(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float, alpha=1.0) -> None:
    with Image.open(path) as img:
        iw, ih = img.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    set_alpha(c, fill=alpha)
    c.drawImage(str(path), x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask="auto")
    reset_alpha(c)


def draw_image_cover(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float) -> None:
    """Ritaglia al centro un'immagine reale per riempire il riquadro assegnato."""
    with Image.open(path) as img:
        iw, ih = img.size
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x, y, w, h, 9)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(str(path), x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask="auto")
    c.restoreState()


def display_text(c: canvas.Canvas, text: str, x: float, y: float, size: float, color, tracking: float = -0.35) -> None:
    """Titolo display Inter con spaziatura appena più serrata."""
    t = c.beginText(x, y)
    t.setFont("Valora-Display", size)
    t.setFillColor(color)
    t.setCharSpace(tracking)
    t.textLine(text)
    c.drawText(t)


def draw_company_strip(c: canvas.Canvas) -> None:
    label(c, "Formati aziendali trattati", M, 112, MINT, size=7.2)
    logos = [
        COMPANY_LOGOS / "rfi.png",
        COMPANY_LOGOS / "trenitalia.png",
        COMPANY_LOGOS / "fse.png",
        COMPANY_LOGOS / "mercitalia.png",
        PUBLIC / "logos" / "elior.png",
    ]
    gap = 7
    box_w = (CONTENT_W - gap * (len(logos) - 1)) / len(logos)
    for i, logo in enumerate(logos):
        x = M + i * (box_w + gap)
        c.setFillColor(Color(1, 1, 1, alpha=0.94))
        c.roundRect(x, 59, box_w, 38, 8, stroke=0, fill=1)
        draw_image_contain(c, logo, x + 7, 66, box_w - 14, 24)


def brand(c: canvas.Canvas, x: float, y: float, inverse: bool = False, compact: bool = False) -> None:
    icon_h = 35 if compact else 43
    draw_image_contain(c, PUBLIC / "icon-512.png", x, y - icon_h + 8, icon_h * 1.2, icon_h)
    text_color = WHITE if inverse else INK
    c.setFillColor(text_color)
    c.setFont("Valora-Bold", 19 if compact else 22)
    c.drawString(x + icon_h * 1.22, y - 11, "ValOra")
    c.setFont("Valora-Bold", 6.6 if compact else 7.2)
    c.setFillColor(MINT if inverse else TEAL_DARK)
    c.drawString(x + icon_h * 1.22 + 1, y - 23, "UFFICIO VERTENZE")


def footer(c: canvas.Canvas, page_no: int, inverse: bool = False) -> None:
    fg = Color(1, 1, 1, alpha=0.72) if inverse else MUTED
    c.setStrokeColor(Color(1, 1, 1, alpha=0.16) if inverse else LINE)
    c.setLineWidth(0.7)
    c.line(M, 35, PAGE_W - M, 35)
    c.setFillColor(fg)
    c.setFont("Valora", 7.7)
    c.drawString(M, 20, "ValOra | LegalTech per vertenze di lavoro")
    c.drawRightString(PAGE_W - M, 20, f"Scheda {page_no} / 4")


def bullet(c: canvas.Canvas, x: float, y: float, text: str, width: float, color=TEAL, size=9.5) -> float:
    c.setFillColor(color)
    c.circle(x + 4, y + 3, 3.3, stroke=0, fill=1)
    c.setStrokeColor(WHITE)
    c.setLineWidth(1.1)
    c.line(x + 2.4, y + 3.0, x + 3.7, y + 1.7)
    c.line(x + 3.7, y + 1.7, x + 6.2, y + 5.0)
    return paragraph(c, text, x + 15, y + 7, width - 15, size=size, leading=size * 1.35, color=INK)


def metric_card(c: canvas.Canvas, x: float, y: float, w: float, value: str, title: str, accent=TEAL) -> None:
    panel(c, x, y, w, 66, fill=Color(1, 1, 1, alpha=0.10), radius=14, shadow=False)
    c.setFillColor(accent)
    c.roundRect(x + 12, y + 12, 4, 42, 2, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Valora-Bold", 19)
    c.drawString(x + 27, y + 34, value)
    c.setFillColor(Color(1, 1, 1, alpha=0.72))
    c.setFont("Valora", 7.8)
    c.drawString(x + 27, y + 20, title)


def feature_tile(c: canvas.Canvas, x: float, y: float, w: float, h: float, n: str, title: str, body: str, accent=TEAL) -> None:
    panel(c, x, y, w, h, fill=WHITE, radius=16, stroke=LINE, shadow=False)
    c.setFillColor(accent)
    c.circle(x + 24, y + h - 25, 13, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Valora-Bold", 9)
    c.drawCentredString(x + 24, y + h - 28, n)
    c.setFillColor(INK)
    c.setFont("Valora-Bold", 11)
    c.drawString(x + 44, y + h - 29, title)
    paragraph(c, body, x + 16, y + h - 54, w - 32, size=8.6, leading=11.6, color=SLATE)


def page_one(c: canvas.Canvas) -> None:
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.linearGradient(0, PAGE_H, PAGE_W, 0, [NAVY, NAVY_2, HexColor("#0B3B43")], [0, 0.55, 1])
    set_alpha(c, fill=0.13)
    c.setFillColor(CYAN)
    c.circle(PAGE_W - 50, PAGE_H - 30, 155, stroke=0, fill=1)
    c.setFillColor(INDIGO)
    c.circle(-40, 335, 125, stroke=0, fill=1)
    reset_alpha(c)

    brand(c, M, PAGE_H - 43, inverse=True)
    pill(c, "LEGALTECH NATO DA CASI REALI", M, 715, Color(0.15, 0.83, 0.72, alpha=0.14), MINT)

    display_text(c, "Documenti complessi.", M, 670, 34, WHITE)
    display_text(c, "Pratiche chiare.", M, 629, 34, MINT)
    paragraph(
        c,
        "ValOra è il motore LegalTech proprietario che trasforma cedolini, turni e dati retributivi in conteggi verificabili. Ogni lavorazione resta visibile dall'acquisizione all'esito, mentre l'operatore continua a lavorare sulla pratica.",
        M,
        593,
        470,
        size=11.5,
        leading=16.5,
        color=Color(0.86, 0.94, 0.96, alpha=0.88),
    )

    gap = 10
    mw = (CONTENT_W - 2 * gap) / 3
    metric_card(c, M, 480, mw, "7.300+", "cedolini nell'archivio operativo", MINT)
    metric_card(c, M + mw + gap, 480, mw, "3", "aree di analisi specialistiche", CYAN)
    metric_card(c, M + 2 * (mw + gap), 480, mw, "6", "profili di estrazione per azienda", HexColor("#BDA3FF"))
    c.setFillColor(Color(1, 1, 1, alpha=0.52))
    c.setFont("Valora", 6.8)
    c.drawRightString(PAGE_W - M, 468, "Dato archivio operativo verificato al 16 luglio 2026")

    panel(c, M, 222, CONTENT_W, 218, fill=Color(1, 1, 1, alpha=0.96), radius=22, shadow=True)
    label(c, "La piattaforma dietro il servizio", M + 22, 410, TEAL_DARK)
    c.setFillColor(INK)
    c.setFont("Valora-Bold", 19)
    c.drawString(M + 22, 379, "Dal documento alla decisione tecnica")

    col_gap = 14
    col_w = (CONTENT_W - 44 - 2 * col_gap) / 3
    items = [
        ("01", "Acquisisce", "PDF testuali e scansioni diventano dati strutturati, ordinati per mese e lavoratore.", TEAL),
        ("02", "Verifica", "Quadrature, controlli e scarti visibili: i dubbi vengono segnalati, non nascosti.", INDIGO),
        ("03", "Consegna", "Conteggi, relazione tecnica e fogli di calcolo restano leggibili e controllabili.", COPPER),
    ]
    for i, item in enumerate(items):
        x = M + 22 + i * (col_w + col_gap)
        feature_tile(c, x, 245, col_w, 112, *item)

    c.setFillColor(WHITE)
    c.setFont("Valora-Bold", 16)
    c.drawString(M, 176, "Per studi legali, sindacati e patronati")
    paragraph(c, "Tecnologia al servizio della prova: l'avanzamento resta visibile dal documento all'esito, senza bloccare la pratica.", M, 154, 345, size=9.5, color=Color(0.82, 0.92, 0.94, alpha=0.85))
    cta_x, cta_y, cta_h = PAGE_W - M - 119, 143, 27
    cta_w = pill(c, "VALUTA UN CASO", cta_x, cta_y, TEAL, WHITE, size=8.4, pad_x=15, height=cta_h)
    c.linkURL(CONTACT_MAILTO, (cta_x, cta_y, cta_x + cta_w, cta_y + cta_h), relative=0, thickness=0)
    draw_company_strip(c)
    footer(c, 1, inverse=True)


def page_two(c: canvas.Canvas) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    set_alpha(c, fill=0.08)
    c.setFillColor(TEAL)
    c.circle(PAGE_W + 35, PAGE_H - 30, 145, stroke=0, fill=1)
    reset_alpha(c)
    brand(c, M, PAGE_H - 40)
    pill(c, "CEDOLINI E DIFFERENZE RETRIBUTIVE", M, 714, HexColor("#DDF5EF"), TEAL_DARK)
    display_text(c, "Dal cedolino al dato", M, 670, 29, INK)
    display_text(c, "verificabile.", M, 635, 29, TEAL_DARK)
    paragraph(c, "ValOra acquisisce PDF e immagini con un motore AI specializzato per azienda e conserva il collegamento tra dato estratto, mese e file originale.", M, 604, 480, size=10.8, leading=15.3)

    panel(c, M, 330, CONTENT_W, 236, fill=WHITE, radius=20, stroke=LINE)
    label(c, "Verifica reale nell'app", M + 18, 541, TEAL_DARK)
    draw_image_cover(c, MANUAL_ASSETS / "12-griglia-scudo-verifica.png", M + 18, 361, CONTENT_W - 36, 164)
    c.setFillColor(INK)
    c.setFont("Valora-Bold", 8.8)
    c.drawString(M + 19, 346, "Lo scudo apre il confronto locale tra PDF e dati estratti.")
    c.setFillColor(MUTED)
    c.setFont("Valora", 7.2)
    c.drawRightString(PAGE_W - M - 18, 346, "Schermata reale · demo ValOra")

    label(c, "Un metodo ibrido, non una scatola nera", M, 293, TEAL_DARK)
    c.setFillColor(INK)
    c.setFont("Valora-Bold", 18)
    c.drawString(M, 264, "La tecnologia giusta per ogni documento")

    bw = (CONTENT_W - 14) / 2
    bullet(c, M, 225, "Verifica deterministica locale sui PDF testuali supportati, separata dall'estrazione AI.", bw, TEAL)
    bullet(c, M, 180, "OCR e AI per scansioni e documenti cartacei, con campi ambigui segnalati.", bw, TEAL)
    bullet(c, M + bw + 14, 225, "Confronto riga per riga, quadrature dove disponibili e correzioni tracciabili.", bw, INDIGO)
    bullet(c, M + bw + 14, 180, "Archivio ordinato per lavoratore, anno e mese, sempre collegato alla pratica.", bw, INDIGO)

    panel(c, M, 58, CONTENT_W, 76, fill=WHITE, radius=14, stroke=LINE, shadow=False)
    label(c, "Tracciabilità del controllo", M + 16, 117, TEAL_DARK)
    proof_steps = ["PDF originale", "Parser locale", "Differenze", "Conferma"]
    step_gap = 10
    step_w = (CONTENT_W - 32 - step_gap * 3) / 4
    step_y = 75
    for i, step in enumerate(proof_steps):
        x = M + 16 + i * (step_w + step_gap)
        if i:
            c.setStrokeColor(LINE)
            c.setLineWidth(1.2)
            c.line(x - step_gap + 2, step_y + 14, x - 2, step_y + 14)
        c.setFillColor(HexColor("#E8F6F3") if i in (0, 3) else HexColor("#F0EBFC"))
        c.roundRect(x, step_y, step_w, 28, 10, stroke=0, fill=1)
        c.setFillColor(TEAL_DARK if i in (0, 3) else INDIGO)
        c.setFont("Valora-Bold", 7.8)
        c.drawCentredString(x + step_w / 2, step_y + 10, step)
    footer(c, 2)


def page_three(c: canvas.Canvas) -> None:
    c.setFillColor(HexColor("#130C2C"))
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.linearGradient(0, PAGE_H, PAGE_W, 0, [HexColor("#171035"), HexColor("#2A1450"), HexColor("#151D42")], [0, 0.56, 1])
    set_alpha(c, fill=0.13)
    c.setFillColor(VIOLET)
    c.circle(PAGE_W - 10, 585, 170, stroke=0, fill=1)
    c.setFillColor(CYAN)
    c.circle(-65, 160, 115, stroke=0, fill=1)
    reset_alpha(c)
    brand(c, M, PAGE_H - 40, inverse=True)
    pill(c, "TURNI E MANCATI RIPOSI", M, 714, Color(0.60, 0.32, 0.82, alpha=0.18), HexColor("#D9BCFF"))
    display_text(c, "Ricostruire prima.", M, 670, 29, WHITE)
    display_text(c, "Calcolare dopo.", M, 635, 29, HexColor("#D4B5FF"))
    paragraph(c, "ValOra ricompone la cronologia dei turni, classifica i riposi e separa le ipotesi giuridiche dai dati documentali.", M, 604, 467, size=10.8, leading=15.3, color=Color(0.88, 0.88, 0.97, alpha=0.84))

    panel(c, M, 350, CONTENT_W, 207, fill=Color(1, 1, 1, alpha=0.08), radius=22, shadow=False)
    c.setFillColor(WHITE)
    c.setFont("Valora-Bold", 13)
    c.drawString(M + 20, 523, "Il modulo disegna la storia")
    paragraph(c, "Giornaliere e settimanali restano distinte. Un clic sull'anno filtra le violazioni e porta al dettaglio.", M + 20, 499, 172, size=8.6, leading=12.2, color=Color(0.88, 0.88, 0.97, alpha=0.84))
    pill(c, "2011 → 2024", M + 20, 375, Color(0.55, 0.28, 0.77, alpha=0.30), HexColor("#E3CFFF"), size=7.4, height=20)
    draw_image_contain(c, MANUAL_ASSETS / "13-turni-riposi-timeline.png", M + 212, 392, 285, 150)
    c.setFillColor(Color(0.88, 0.88, 0.97, alpha=0.55))
    c.setFont("Valora", 7.2)
    c.drawRightString(M + 497, 372, "Schermata reale · demo ValOra")

    label(c, "Il percorso di analisi", M, 317, HexColor("#D4B5FF"))
    c.setFillColor(WHITE)
    c.setFont("Valora-Bold", 18)
    c.drawString(M, 288, "Quattro passaggi, una traccia leggibile")

    steps = [
        ("1", "Import", "Turni e documenti vengono ordinati per giorno e periodo."),
        ("2", "Motore", "Le finestre di riposo sono ricostruite e classificate."),
        ("3", "Confronto", "Serie e criteri alternativi restano distinti e verificabili."),
        ("4", "Relazione", "Metodo, risultati e limiti confluiscono nel fascicolo tecnico."),
    ]
    sw = (CONTENT_W - 3 * 10) / 4
    for i, (n, title, body) in enumerate(steps):
        x = M + i * (sw + 10)
        panel(c, x, 138, sw, 124, fill=Color(1, 1, 1, alpha=0.09), radius=15, shadow=False)
        c.setFillColor(INDIGO if i % 2 == 0 else CYAN)
        c.circle(x + 20, 238, 11, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont("Valora-Bold", 8.5)
        c.drawCentredString(x + 20, 235, n)
        c.setFillColor(WHITE)
        c.setFont("Valora-Bold", 10)
        c.drawString(x + 14, 208, title)
        paragraph(c, body, x + 14, 189, sw - 28, size=7.8, leading=10.8, color=Color(0.87, 0.88, 0.96, alpha=0.75))

    c.setFillColor(WHITE)
    c.setFont("Valora-Bold", 14)
    c.drawString(M, 96, "Il risultato non è solo un totale.")
    paragraph(c, "È una ricostruzione difendibile: fonti, regole, calcolo e conclusioni restano leggibili anche da chi non ha costruito il modello.", M, 75, 485, size=9.2, leading=13.3, color=Color(0.86, 0.88, 0.95, alpha=0.78))
    footer(c, 3, inverse=True)


def draw_qr(c: canvas.Canvas, value: str, x: float, y: float, size: float) -> None:
    drawing = createBarcodeDrawing(
        "QR",
        value=value,
        barWidth=size,
        barHeight=size,
        humanReadable=False,
    )
    renderPDF.draw(drawing, c, x, y)


def page_four(c: canvas.Canvas) -> None:
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(HexColor("#ECF7F4"))
    c.roundRect(-45, 635, PAGE_W + 90, 255, 50, stroke=0, fill=1)
    set_alpha(c, fill=0.09)
    c.setFillColor(TEAL)
    c.circle(PAGE_W - 35, PAGE_H - 20, 140, stroke=0, fill=1)
    reset_alpha(c)
    brand(c, M, PAGE_H - 40)
    pill(c, "IL SERVIZIO", M, 714, HexColor("#D9F2EB"), TEAL_DARK)
    display_text(c, "La piattaforma lavora.", M, 670, 29, INK)
    display_text(c, "Tu ricevi la pratica.", M, 635, 29, TEAL_DARK)
    paragraph(c, "Un flusso tecnico pensato per ridurre il lavoro ripetitivo. Avanzamento ed esiti restano sempre visibili mentre sindacato e legale continuano a operare sulla pratica.", M, 604, 470, size=10.8, leading=15.2)

    label(c, "Come funziona", M, 546, TEAL_DARK)
    steps = [
        ("01", "Invio documenti", "Cedolini e turni vengono acquisiti; l'avanzamento è visibile in tempo reale."),
        ("02", "Analisi tecnica", "Estrazione, controlli, calcoli e verifica delle anomalie."),
        ("03", "Consegna", "Fascicolo coerente, pronto per revisione e utilizzo professionale."),
    ]
    card_gap = 12
    cw = (CONTENT_W - 2 * card_gap) / 3
    for i, (n, title, body) in enumerate(steps):
        x = M + i * (cw + card_gap)
        feature_tile(c, x, 404, cw, 117, n, title, body, [TEAL, INDIGO, COPPER][i])

    label(c, "Cosa consegno", M, 369, TEAL_DARK)
    c.setFillColor(INK)
    c.setFont("Valora-Bold", 18)
    c.drawString(M, 340, "Tre documenti, una sola storia dei numeri")
    items = [
        ("CONTEGGIO PDF", "Dettaglio analitico delle differenze o delle violazioni."),
        ("RELAZIONE DOCX", "Metodo, riferimenti, ipotesi e conclusioni in formato editabile."),
        ("EXCEL VIVO", "Per i mancati riposi: formule trasparenti che reagiscono ai parametri."),
    ]
    for i, (title, body) in enumerate(items):
        y = 288 - i * 61
        c.setFillColor([TEAL, INDIGO, COPPER][i])
        c.roundRect(M, y, 5, 45, 2.5, stroke=0, fill=1)
        c.setFillColor(INK)
        c.setFont("Valora-Bold", 10.2)
        c.drawString(M + 18, y + 28, title)
        paragraph(c, body, M + 18, y + 13, 315, size=8.6, leading=11.7, color=SLATE)

    panel(c, 356, 158, 197, 175, fill=NAVY_2, radius=20, shadow=True)
    c.setFillColor(MINT)
    c.setFont("Valora-Bold", 7.8)
    c.drawString(374, 306, "PARLIAMO DELLA PRATICA")
    c.setFillColor(WHITE)
    c.setFont("Valora-Bold", 13)
    c.drawString(374, 282, "Francesco Pio Mirizzi")
    c.setFillColor(Color(1, 1, 1, alpha=0.70))
    c.setFont("Valora", 7.6)
    c.drawString(374, 265, "Consulenza tecnica per vertenze")
    c.setFillColor(WHITE)
    c.roundRect(372, 171, 76, 76, 7, stroke=0, fill=1)
    draw_qr(c, "mailto:francescopiomirizzi@gmail.com?subject=Richiesta%20valutazione%20vertenza", 376, 175, 68)
    c.setFillColor(WHITE)
    c.setFont("Valora-Bold", 7.3)
    c.drawString(458, 232, "Scansiona")
    c.drawString(458, 220, "per scrivere")
    c.setFillColor(Color(1, 1, 1, alpha=0.68))
    c.setFont("Valora", 7.3)
    c.drawString(458, 198, "+39 320 192 9240")
    c.setFont("Valora", 6.3)
    c.drawString(372, 163, "francescopiomirizzi@gmail.com")
    c.linkURL(CONTACT_MAILTO, (370, 159, 542, 250), relative=0, thickness=0)

    c.setFillColor(HexColor("#EEF5F4"))
    c.roundRect(M, 62, CONTENT_W, 68, 14, stroke=0, fill=1)
    c.setFillColor(TEAL_DARK)
    c.setFont("Valora-Bold", 9.8)
    c.drawString(M + 16, 108, "TRASPARENZA PRIMA DI TUTTO")
    paragraph(c, "Ogni risultato dipende dalla completezza e qualità dei documenti. Le anomalie vengono dichiarate e sottoposte a verifica, non compensate con ipotesi nascoste. I documenti restano su archivi riservati con accessi controllati; i link di consultazione sono temporanei e non vengono diffusi.", M + 16, 91, CONTENT_W - 32, size=7.8, leading=10.5, color=SLATE)
    footer(c, 4)


def split_pdf(master: Path, names: Sequence[str]) -> None:
    reader = PdfReader(str(master))
    if len(reader.pages) != len(names):
        raise RuntimeError(f"Attese {len(names)} pagine, trovate {len(reader.pages)}")
    SHEETS_DIR.mkdir(parents=True, exist_ok=True)
    for page, name in zip(reader.pages, names):
        writer = PdfWriter()
        writer.add_page(page)
        writer.add_metadata({"/Title": name.replace("-", " ").title(), "/Author": "ValOra"})
        with (SHEETS_DIR / f"{name}.pdf").open("wb") as fh:
            writer.write(fh)


def main() -> None:
    register_fonts()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(MASTER_PDF), pagesize=A4, pageCompression=1)
    c.setTitle("ValOra - Kit schede informative")
    c.setAuthor("ValOra - Francesco Pio Mirizzi")
    c.setCreator("ValOra · generatore editoriale")
    c.setSubject("Materiale promozionale LegalTech per vertenze di lavoro")
    c.setKeywords("ValOra, LegalTech, buste paga, parser deterministico, Turni e Riposi")
    for page_fn in (page_one, page_two, page_three, page_four):
        page_fn(c)
        c.showPage()
    c.save()
    split_pdf(
        MASTER_PDF,
        [
            "valora-01-panoramica",
            "valora-02-cedolini-ai",
            "valora-03-turni-riposi",
            "valora-04-servizio-consegne",
        ],
    )
    print(MASTER_PDF)


if __name__ == "__main__":
    main()
