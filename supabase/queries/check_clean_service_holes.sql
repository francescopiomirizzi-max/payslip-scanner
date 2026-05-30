-- Controllo qualità estrazione cedolini CLEAN_SERVICE
-- Scopo: intercettare le voci che l'estrazione AI tende a "perdere" in fondo
--        al cedolino (rate addizionali IRPEF + quota TFR), salvandole a 0.
--
-- Failure mode noto (vedi memory feedback-gemini-drops-trailing-addizionali):
--   su cedolini lunghi Gemini tronca le ultime righe -> 8191/9117/9119/7173 = 0
--   mentre sul cedolino il valore c'e'. aiWarning riporta "Nessuna anomalia" (falso negativo).
--
-- Euristica anti-falsi-positivi:
--   segnala un mese SOLO se il codice e' 0 ma esiste un mese SUCCESSIVO (stesso
--   lavoratore/anno) in cui lo stesso codice e' presente. Cosi' si becca il "buco"
--   in mezzo a una serie, non lo stop legittimo di fine anno.
--
-- Affidabilita' per codice:
--   8191 (quota TFR mese INPS) -> alta: dovrebbe esserci in OGNI mese lavorato
--   9117 / 9119 (rate addiz. regionale/comunale A.P.) -> alta: installment mensili regolari
--   7173 (acconto add. comunale A.P.) -> BASSA: spesso intermittente -> molti falsi positivi
--
-- Ogni riga e' un "da verificare sulla foto", NON una correzione automatica.

WITH cs AS (
  SELECT wp.id, wp.cognome, wp.nome,
         (m->>'year')::int                                   AS yr,
         (m->>'monthIndex')::int                             AS midx,
         m->>'month'                                         AS mese,
         COALESCE(NULLIF(m->>'daysWorked','')::numeric, 0)   AS dw,
         m                                                   AS md
  FROM worker_profiles wp
  CROSS JOIN LATERAL jsonb_array_elements(wp.anni) m
  WHERE wp.profilo = 'CLEAN_SERVICE'
),
ex AS (
  SELECT cs.*, c.code,
         COALESCE(NULLIF(cs.md->>c.code,'')::numeric, 0)     AS val
  FROM cs
  CROSS JOIN (VALUES ('8191'),('9117'),('9119'),('7173')) c(code)
),
agg AS (
  SELECT id, yr, code,
         MAX(val)                                  AS tipico,
         MAX(CASE WHEN val > 0 THEN midx END)      AS last_present_midx
  FROM ex
  GROUP BY id, yr, code
)
SELECT e.cognome, e.nome, e.yr AS anno, e.mese, e.code AS codice_a_zero,
       a.tipico AS valore_atteso_circa,
       CASE WHEN e.code = '7173' THEN 'bassa (intermittente)' ELSE 'alta' END AS confidenza
FROM ex e
JOIN agg a USING (id, yr, code)
WHERE e.val = 0
  AND e.dw  > 0
  AND a.last_present_midx IS NOT NULL
  AND e.midx < a.last_present_midx     -- buco prima dell'ultima presenza nell'anno
ORDER BY e.cognome, e.nome, e.yr, e.midx, e.code;
