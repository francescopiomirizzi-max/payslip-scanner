#!/bin/bash
# Doppio click su questo file per sostituire i vecchi "Riepilogo_somme_richieste_*.pdf"
# nelle cartelle conteggi con quelli generati dal tasto "Stampa" (salvati nei Download).
# Funziona sia dalla cartella helper/ sia copiato altrove (es. sul Desktop).
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/sostituisci-riepilogo.mjs"
if [ ! -f "$SCRIPT" ]; then
  # Fallback: copiato fuori dal repo → usa il percorso noto del progetto.
  SCRIPT="$HOME/Documents/GitHub/payslip-scanner/helper/sostituisci-riepilogo.mjs"
fi
if [ ! -f "$SCRIPT" ]; then
  echo "Non trovo sostituisci-riepilogo.mjs. Tieni questo file accanto allo script, oppure"
  echo "controlla che il progetto sia in ~/Documents/GitHub/payslip-scanner/helper/."
  read -n 1 -s -r -p "Premi un tasto per chiudere..."
  exit 1
fi

if command -v node >/dev/null 2>&1; then
  NODE="$(command -v node)"
elif [ -x /usr/local/bin/node ]; then
  NODE="/usr/local/bin/node"
elif [ -x /opt/homebrew/bin/node ]; then
  NODE="/opt/homebrew/bin/node"
else
  echo "Node non trovato. Installa Node.js da https://nodejs.org e riprova."
  read -n 1 -s -r -p "Premi un tasto per chiudere..."
  exit 1
fi

"$NODE" "$SCRIPT"

echo ""
read -n 1 -s -r -p "Premi un tasto per chiudere questa finestra..."
echo ""
