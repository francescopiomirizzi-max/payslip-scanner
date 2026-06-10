#!/usr/bin/env python3
"""
Parser deterministico del PDF "Mancati riposi" (caso Viterbo) → seed GiornataInput[].

Il PDF è testo nativo (tabella ASCII, una pagina per mese): niente OCR/AI.
Alcune pagine hanno il content stream duplicato (es. pag. 4 ripetuta ~14×),
quindi si deduplica per data; righe duplicate con contenuto diverso = errore.

Verifiche incorporate prima di scrivere il seed:
  - copertura giorni completa tra prima e ultima data (zero buchi);
  - somma delle indennità giornaliere == totale mensile stampato, per ogni mese;
  - somma dei mesi == "Totale complessivo" stampato nel PDF.

Uso:
  python3 scripts/parse-mancati-riposi-pdf.py "<pdf>" [public/viterbo-seed.json]

Richiede pypdf (`pip install pypdf`). Il seed resta gitignored (dati personali).
"""
import json
import re
import sys
from collections import defaultdict
from datetime import date, timedelta

try:
    from pypdf import PdfReader
except ImportError:
    sys.exit("pypdf mancante: python3 -m pip install pypdf")

ROW_RE = re.compile(
    r'^\|(?P<gset>[^|]*)\|(?P<data>\d{2}/\d{2}/\d{4})\|(?P<tipo>[^|]*)\|(?P<serv>[^|]*)'
    r'\|(?P<ini>[^|]*)\|(?P<ter>[^|]*)\|(?P<ripg>[^|]*)\|(?P<rips>[^|]*)'
    r'\|(?P<mrg>[^|]*)\|(?P<mrs>[^|]*)\|(?P<ind>[^|]*)\|(?P<mens>[^|]*)\|'
)
TOT_RE = re.compile(r'Totale complessivo\s*\|\s*([\d.,]+)\s*\|')


def num(s):
    s = s.strip()
    if not s:
        return None
    try:
        return float(s.replace(',', '.'))
    except ValueError:
        return None


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pdf_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else 'public/viterbo-seed.json'

    byday = {}            # iso -> dict campi riga
    monthly_printed = {}  # (anno, mese) -> totale mensile stampato
    grand_total = None

    for page in PdfReader(pdf_path).pages:
        text = page.extract_text() or ''
        m = TOT_RE.search(text)
        if m:
            grand_total = float(m.group(1).replace(',', '.'))
        for line in text.splitlines():
            m = ROW_RE.match(line.strip())
            if not m:
                continue
            d = {k: v.strip() for k, v in m.groupdict().items()}
            gg, mm, aa = d['data'].split('/')
            iso = f'{aa}-{mm}-{gg}'
            if iso in byday:
                if byday[iso] != d:
                    sys.exit(f'ERRORE: riga duplicata con contenuto diverso per {d["data"]}')
                continue
            byday[iso] = d
            mens = num(d['mens'])
            if mens is not None:
                monthly_printed[(int(aa), int(mm))] = mens

    if not byday:
        sys.exit('ERRORE: nessuna riga estratta — formato PDF diverso dall atteso')

    # verifica copertura giorni
    isos = sorted(byday)
    d0 = date.fromisoformat(isos[0])
    d1 = date.fromisoformat(isos[-1])
    cur, missing = d0, []
    while cur <= d1:
        if cur.isoformat() not in byday:
            missing.append(cur.isoformat())
        cur += timedelta(days=1)
    if missing:
        sys.exit(f'ERRORE: {len(missing)} giorni mancanti, primi: {missing[:5]}')

    # verifica quadratura mensile e totale
    calc = defaultdict(float)
    for iso, d in byday.items():
        v = num(d['ind'])
        if v is not None:
            calc[(int(iso[:4]), int(iso[5:7]))] += v
    bad = [k for k, p in monthly_printed.items() if abs(round(calc.get(k, 0), 2) - p) > 0.011]
    if bad:
        sys.exit(f'ERRORE: {len(bad)} mesi non quadrano coi totali stampati: {sorted(bad)[:5]}')
    tot = round(sum(monthly_printed.values()), 2)
    if grand_total is not None and abs(tot - grand_total) > 0.011:
        sys.exit(f'ERRORE: somma mesi {tot} != Totale complessivo stampato {grand_total}')

    # seed GiornataInput[]: solo i campi del tipo, omessi se vuoti
    seed = []
    for iso in isos:
        d = byday[iso]
        g = {'data': d['data']}
        for key, src in (('gset', 'gset'), ('tipo', 'tipo'), ('servizio', 'serv'),
                         ('inizio', 'ini'), ('termine', 'ter')):
            if d[src]:
                g[key] = d[src]
        seed.append(g)

    with open(out_path, 'w') as f:
        json.dump(seed, f, ensure_ascii=False)

    print(f'OK: {len(seed)} giornate {d0} → {d1}, {len(monthly_printed)} mesi quadrati, '
          f'totale PDF €{tot:.2f}' + (f' == Totale complessivo stampato' if grand_total else ''))
    print(f'seed scritto in {out_path}')


if __name__ == '__main__':
    main()
