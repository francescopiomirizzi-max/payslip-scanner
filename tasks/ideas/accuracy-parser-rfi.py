#!/usr/bin/env python3
"""
Parser deterministico di VERITÀ per buste RFI (seme della feature "prova d'accuratezza").
Estrae, da un PDF busta RFI (testuale, pdftotext -layout), la somma per codice voce
dalla colonna COMPETENZE, sommando le voci a righe multiple (es. 0AA1 Trasferta).

Uso:  python3 accuracy-parser-rfi.py "percorso/busta.PDF" [debug]
Gestisce i due layout RFI: vecchio (codici indentati) e nuovo 2021+ (codici a col 0),
header "Cod.Voce"/"Cod. Voce", e la doppia colonna Trattenute|Competenze.
Validato su 4 mesi (Nov2012, Mar2019, Gen2022, Lug2020) contro il PDF grezzo.
"""
import subprocess, re, sys

TRACKED = ['0152','0421','0423','0457','0470','0482','0496','0687','0AA1','0576',
           '0584','0919','0920','0932','0933','0995','0996']
NUM  = re.compile(r'\d{1,3}(?:\.\d{3})*,\d{2}')
CODE = re.compile(r'^(\s*)([0-9/][0-9A-Z]{3})\s')
def num(s): return float(s.replace('.','').replace(',','.'))

def parse(path, debug=False):
    txt = subprocess.run(["pdftotext","-layout",path,"-"],capture_output=True,text=True).stdout
    lines = txt.splitlines()
    # colonna Competenze dagli header della tabella voci (non dal "Totale Competenze")
    cc = [l.index("Competenze") for l in lines
          if "Competenze" in l and "Trattenute" in l and "Descrizione" in l]
    if not cc: return None
    idx = min(cc); totals = {}
    for l in lines:
        m = CODE.match(l)
        if not m: continue
        cv = None
        for mm in NUM.finditer(l):
            if mm.end() >= idx:          # numero nella colonna Competenze (più a destra)
                cv = num(mm.group())
        if cv is not None:
            totals[m.group(2)] = round(totals.get(m.group(2),0.0)+cv, 2)
            if debug: print(f"   {m.group(2):5} {cv:>10.2f}")
    return totals

if __name__ == "__main__":
    t = parse(sys.argv[1], debug=(len(sys.argv)>2)) or {}
    for c in TRACKED:
        if c in t: print(f"{c:6} {t[c]:>10.2f}")
