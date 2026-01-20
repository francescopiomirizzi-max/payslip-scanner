Parte A: Il Comando

"Antigravity, agisci come Senior Web Developer. Devi unire la logica di calcolo e i dati dei lavoratori che ti fornisco qui sotto all'interno dei file UI che ho già in questa cartella (App.tsx e TableComponent.tsx)."

Parte B: I Dati (Copia dal tuo file indennita-feriale-app.tsx)

Dati Lavoratori:import React, { useState } from 'react';
import { Plus, User, ArrowLeft, Trash2, Edit2 } from 'lucide-react';

// Struttura dati principale
const inizializzaLavoratori = () => [
  {
    id: 1,
    nome: "Mario",
    cognome: "Rossi",
    anni: [
      {
        anno: 2023,
        totaleVociAccessorie: 5000.00,
        divisoreAnnuo: 312,
        giornateFerieFruite: 20
      },
      {
        anno: 2024,
        totaleVociAccessorie: 5500.00,
        divisoreAnnuo: 312,
        giornateFerieFruite: 22
      }
    ]
  },
  {
    id: 2,
    nome: "Laura",
    cognome: "Bianchi",
    anni: [
      {
        anno: 2023,
        totaleVociAccessorie: 4800.00,
        divisoreAnnuo: 312,
        giornateFerieFruite: 18
      }
    ]
  }
];

// Funzioni di calcolo
function calcolaIncidenzaGiornaliera(totaleVoci, divisore) {
  if (divisore === 0) return 0;
  return totaleVoci / divisore;
}

function calcolaIncidenzaTotaleAnno(incidenzaGiornaliera, giornateFerie) {
  return incidenzaGiornaliera * giornateFerie;
}

function processaAnno(datiAnno) {
  const incidenzaGiornaliera = calcolaIncidenzaGiornaliera(
    datiAnno.totaleVociAccessorie,
    datiAnno.divisoreAnnuo
  );
  
  const incidenzaTotaleAnno = calcolaIncidenzaTotaleAnno(
    incidenzaGiornaliera,
    datiAnno.giornateFerieFruite
  );
  
  return {
    ...datiAnno,
    incidenzaGiornaliera: parseFloat(incidenzaGiornaliera.toFixed(2)),
    incidenzaTotaleAnno: parseFloat(incidenzaTotaleAnno.toFixed(2))
  };
}

function calcolaTotaleDovuto(anni) {
  if (!anni || anni.length === 0) return 0;
  
  const risultatiAnni = anni.map(anno => processaAnno(anno));
  const totale = risultatiAnni.reduce(
    (acc, curr) => acc + curr.incidenzaTotaleAnno,
    0
  );
  
  return parseFloat(totale.toFixed(2));
}

// Componente Scheda Lavoratore
function SchedaLavoratore({ lavoratore, onClick }) {
  const totaleDovuto = calcolaTotaleDovuto(lavoratore.anni);
  
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-xl transition-shadow border-2 border-transparent hover:border-blue-500"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <User className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {lavoratore.nome} {lavoratore.cognome}
          </h3>
          <p className="text-sm text-gray-500">
            {lavoratore.anni.length} {lavoratore.anni.length === 1 ? 'anno' : 'anni'}
          </p>
        </div>
      </div>
      
      <div className="pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600 mb-1">Totale Dovuto</p>
        <p className="text-2xl font-bold text-green-600">
          € {totaleDovuto.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}

// Componente Home Page
function HomePage({ lavoratori, onSelezionaLavoratore, onAggiungiLavoratore }) {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestione Indennità Feriale</h1>
            <p className="text-gray-600 mt-2">Gestisci i calcoli delle indennità per i lavoratori</p>
          </div>
          
          <button
            onClick={onAggiungiLavoratore}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus className="w-5 h-5" />
            Aggiungi Lavoratore
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lavoratori.map(lavoratore => (
            <SchedaLavoratore
              key={lavoratore.id}
              lavoratore={lavoratore}
              onClick={() => onSelezionaLavoratore(lavoratore)}
            />
          ))}
        </div>
        
        {lavoratori.length === 0 && (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nessun lavoratore presente</p>
            <p className="text-gray-400">Clicca su "Aggiungi Lavoratore" per iniziare</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente Dettaglio Lavoratore
function DettaglioLavoratore({ lavoratore, onIndietro, onAggiorna, onElimina }) {
  const [datiModifica, setDatiModifica] = useState(lavoratore);
  const [modalitaModifica, setModalitaModifica] = useState(false);
  
  const risultatiAnni = datiModifica.anni.map(anno => processaAnno(anno));
  const totaleDovuto = risultatiAnni.reduce(
    (acc, curr) => acc + curr.incidenzaTotaleAnno,
    0
  );
  
  const aggiungiAnno = () => {
    const nuovoAnno = {
      anno: new Date().getFullYear(),
      totaleVociAccessorie: 0,
      divisoreAnnuo: 312,
      giornateFerieFruite: 0
    };
    setDatiModifica({
      ...datiModifica,
      anni: [...datiModifica.anni, nuovoAnno]
    });
  };
  
  const rimuoviAnno = (index) => {
    const nuoviAnni = datiModifica.anni.filter((_, i) => i !== index);
    setDatiModifica({
      ...datiModifica,
      anni: nuoviAnni
    });
  };
  
  const aggiornaAnno = (index, campo, valore) => {
    const nuoviAnni = [...datiModifica.anni];
    nuoviAnni[index] = {
      ...nuoviAnni[index],
      [campo]: campo === 'anno' ? parseInt(valore) || 0 : parseFloat(valore) || 0
    };
    setDatiModifica({
      ...datiModifica,
      anni: nuoviAnni
    });
  };
  
  const salvaModifiche = () => {
    onAggiorna(datiModifica);
    setModalitaModifica(false);
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={onIndietro}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Torna alla Home
          </button>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                {modalitaModifica ? (
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={datiModifica.nome}
                      onChange={(e) => setDatiModifica({...datiModifica, nome: e.target.value})}
                      className="border border-gray-300 rounded px-3 py-2"
                      placeholder="Nome"
                    />
                    <input
                      type="text"
                      value={datiModifica.cognome}
                      onChange={(e) => setDatiModifica({...datiModifica, cognome: e.target.value})}
                      className="border border-gray-300 rounded px-3 py-2"
                      placeholder="Cognome"
                    />
                  </div>
                ) : (
                  <h1 className="text-3xl font-bold text-gray-900">
                    {datiModifica.nome} {datiModifica.cognome}
                  </h1>
                )}
              </div>
              
              <div className="flex gap-2">
                {modalitaModifica ? (
                  <>
                    <button
                      onClick={salvaModifiche}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      Salva
                    </button>
                    <button
                      onClick={() => {
                        setDatiModifica(lavoratore);
                        setModalitaModifica(false);
                      }}
                      className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                    >
                      Annulla
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setModalitaModifica(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Modifica
                  </button>
                )}
                <button
                  onClick={onElimina}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina
                </button>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 mt-4">
              <p className="text-sm text-gray-600 mb-1">Totale Dovuto Complessivo</p>
              <p className="text-3xl font-bold text-green-600">
                € {totaleDovuto.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Tabella Analitica</h2>
            {modalitaModifica && (
              <button
                onClick={aggiungiAnno}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Aggiungi Anno
              </button>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Anno</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Voci Accessorie</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Divisore</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Gg. Ferie</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Inc. Giornaliera</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Totale Anno</th>
                  {modalitaModifica && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {risultatiAnni.map((anno, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {modalitaModifica ? (
                        <input
                          type="number"
                          value={datiModifica.anni[index].anno}
                          onChange={(e) => aggiornaAnno(index, 'anno', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-24"
                        />
                      ) : (
                        <span className="font-medium">{anno.anno}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {modalitaModifica ? (
                        <input
                          type="number"
                          step="0.01"
                          value={datiModifica.anni[index].totaleVociAccessorie}
                          onChange={(e) => aggiornaAnno(index, 'totaleVociAccessorie', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-32 text-right"
                        />
                      ) : (
                        `€ ${anno.totaleVociAccessorie.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {modalitaModifica ? (
                        <input
                          type="number"
                          value={datiModifica.anni[index].divisoreAnnuo}
                          onChange={(e) => aggiornaAnno(index, 'divisoreAnnuo', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-20 text-right"
                        />
                      ) : (
                        anno.divisoreAnnuo
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {modalitaModifica ? (
                        <input
                          type="number"
                          value={datiModifica.anni[index].giornateFerieFruite}
                          onChange={(e) => aggiornaAnno(index, 'giornateFerieFruite', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 w-20 text-right"
                        />
                      ) : (
                        anno.giornateFerieFruite
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">
                      € {anno.incidenzaGiornaliera.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 font-bold">
                      € {anno.incidenzaTotaleAnno.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    {modalitaModifica && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => rimuoviAnno(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-bold">
                <tr>
                  <td colSpan={modalitaModifica ? "5" : "5"} className="px-4 py-3 text-right">
                    TOTALE COMPLESSIVO
                  </td>
                  <td className="px-4 py-3 text-right text-green-700 text-lg">
                    € {totaleDovuto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </td>
                  {modalitaModifica && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente Principale
export default function App() {
  const [lavoratori, setLavoratori] = useState(inizializzaLavoratori());
  const [vistaCorrente, setVistaCorrente] = useState('home');
  const [lavoratoreSelezionato, setLavoratoreSelezionato] = useState(null);
  
  const handleSelezionaLavoratore = (lavoratore) => {
    setLavoratoreSelezionato(lavoratore);
    setVistaCorrente('dettaglio');
  };
  
  const handleAggiungiLavoratore = () => {
    const nuovoId = Math.max(...lavoratori.map(l => l.id), 0) + 1;
    const nuovoLavoratore = {
      id: nuovoId,
      nome: "Nuovo",
      cognome: "Lavoratore",
      anni: []
    };
    setLavoratori([...lavoratori, nuovoLavoratore]);
    handleSelezionaLavoratore(nuovoLavoratore);
  };
  
  const handleTornaHome = () => {
    setVistaCorrente('home');
    setLavoratoreSelezionato(null);
  };
  
  const handleAggiornaLavoratore = (lavoratoreAggiornato) => {
    const nuoviLavoratori = lavoratori.map(l => 
      l.id === lavoratoreAggiornato.id ? lavoratoreAggiornato : l
    );
    setLavoratori(nuoviLavoratori);
    setLavoratoreSelezionato(lavoratoreAggiornato);
  };
  
  const handleEliminaLavoratore = () => {
    if (window.confirm(`Sei sicuro di voler eliminare ${lavoratoreSelezionato.nome} ${lavoratoreSelezionato.cognome}?`)) {
      const nuoviLavoratori = lavoratori.filter(l => l.id !== lavoratoreSelezionato.id);
      setLavoratori(nuoviLavoratori);
      handleTornaHome();
    }
  };
  
  return vistaCorrente === 'home' ? (
    <HomePage
      lavoratori={lavoratori}
      onSelezionaLavoratore={handleSelezionaLavoratore}
      onAggiungiLavoratore={handleAggiungiLavoratore}
    />
  ) : (
    <DettaglioLavoratore
      lavoratore={lavoratoreSelezionato}
      onIndietro={handleTornaHome}
      onAggiorna={handleAggiornaLavoratore}
      onElimina={handleEliminaLavoratore}
    />
  );
}



Parte C: La Logica (Copia dal tuo file Nuovo documento di testo.txt)

Logica di Calcolo:Integrazione Logica e Design
Contesto: Ho già i file della UI creati con Google AI Studio in questa cartella (vedi App.tsx, TableComponent.tsx, ecc.).

Obiettivo: Devi integrare la logica di calcolo che ho ottenuto da Claude all'interno di questi file esistenti.

Logica da integrare (da Claude):// Funzione per calcolare l'incidenza giornaliera
function calcolaIncidenzaGiornaliera(totaleVoci, divisore) {
  if (divisore === 0) {
    throw new Error("Il divisore non può essere zero");
  }
  return totaleVoci / divisore;
}

// Funzione per calcolare l'incidenza totale anno
function calcolaIncidenzaTotaleAnno(incidenzaGiornaliera, giornateFerie) {
  return incidenzaGiornaliera * giornateFerie;
}

// Funzione per processare un singolo anno
function processaAnno(datiAnno) {
  const incidenzaGiornaliera = calcolaIncidenzaGiornaliera(
    datiAnno.totaleVociAccessorie,
    datiAnno.divisoreAnnuo
  );
  
  const incidenzaTotaleAnno = calcolaIncidenzaTotaleAnno(
    incidenzaGiornaliera,
    datiAnno.giornateFerieFruite
  );
  
  return {
    anno: datiAnno.anno,
    incidenzaGiornaliera: parseFloat(incidenzaGiornaliera.toFixed(2)),
    incidenzaTotaleAnno: parseFloat(incidenzaTotaleAnno.toFixed(2))
  };
}

// Funzione per calcolare il totale complessivo
function calcolaTotaleComplessivo(dati) {
  const risultatiAnni = dati.anni.map(anno => processaAnno(anno));
  
  const totaleComplessivo = risultatiAnni.reduce(
    (acc, curr) => acc + curr.incidenzaTotaleAnno,
    0
  );
  
  return {
    risultatiAnni: risultatiAnni,
    totaleComplessivo: parseFloat(totaleComplessivo.toFixed(2))
  };
}

// Esempio di utilizzo
const datiEsempio = {
  "anni": [
    {
      "anno": 2023,
      "totaleVociAccessorie": 5000.00,
      "divisoreAnnuo": 312,
      "giornateFerieFruite": 20
    },
    {
      "anno": 2024,
      "totaleVociAccessorie": 5500.00,
      "divisoreAnnuo": 312,
      "giornateFerieFruite": 22
    }
  ]
};

const risultato = calcolaTotaleComplessivo(datiEsempio);
console.log(risultato);

/*
Output esempio:
{
  risultatiAnni: [
    {
      anno: 2023,
      incidenzaGiornaliera: 16.03,
      incidenzaTotaleAnno: 320.51
    },
    {
      anno: 2024,
      incidenzaGiornaliera: 17.63,
      incidenzaTotaleAnno: 387.82
    }
  ],
  totaleComplessivo: 708.33
}
*/





# REVISIONE TOTALE APP - ISTRUZIONI DEFINITIVE

## OBIETTIVO
Trasformare l'app in uno strumento professionale per la gestione delle indennità feriali, con inserimento dati controllato, modifica completa delle tabelle e calcoli dinamici.

---

## 1. MODIFICHE ALLA DASHBOARD (App.tsx)

### A. Inserimento Nuovo Lavoratore (Pop-up)
1.  Sostituisci il comportamento attuale del tasto "+ Nuovo Lavoratore".
2.  Quando cliccato, deve aprire una **Finestra Modale (Pop-up)** al centro dello schermo.
3.  Il pop-up deve contenere:
    * Campo Input: **Nome**
    * Campo Input: **Cognome**
    * Campo Input: **Ruolo/Qualifica**
    * Tasto **"Conferma Creazione"** (attivo solo se i campi sono compilati) e tasto **"Annulla"**.
4.  Solo dopo la conferma, crea la nuova card con i dati inseriti e un avatar generico (es. iniziali o icona neutra).

### B. Gestione Card Esistenti
1.  Su ogni card lavoratore, aggiungi due icone piccole in alto a destra:
    * **Icona Matita (Edit):** Apre lo stesso pop-up per modificare nome/ruolo.
    * **Icona Cestino (Delete):** Chiede conferma ("Sei sicuro di voler eliminare la pratica di [Nome]?") e poi rimuove definitivamente il lavoratore e i suoi dati dal localStorage.

---

## 2. MODIFICHE ALLA TABELLA (TableComponent.tsx)

### A. Intestazione Dinamica
1.  Nella parte alta della pagina della tabella, assicurati che il titolo mostri chiaramente il nome del lavoratore selezionato (es. **"Dettaglio Pratica: Mario Rossi - Software Engineer"**).

### B. Totale Generale Dinamico
1.  Il riquadro in alto a destra "Totale da Percepire" deve mostrare la **somma in tempo reale** di tutti i valori presenti nella colonna "Incidenza Totale Anno". Non deve mai mostrare 0,00 se ci sono dati calcolati nella tabella.

### C. Celle Editabili (Input)
Trasforma le seguenti celle della tabella (dal 2008 al 2025) in campi di input numerici scrivibili dall'utente:
1.  **Divisore Annuo:** (Non più fisso, l'utente deve poterlo cambiare).
2.  **Totale Voci Retributive Accessorie** (Già fatto, mantieni).
3.  **Giornate Ferie Fruite per Anno** (Già fatto, mantieni).
4.  **Indennità percepita x GG di ferie** (Nuovo input).
5.  **Totale indennità da percepire x GG di ferie** (Nuovo input).
6.  **Indennità pasto/ticket restaurant** (Nuovo input).

### D. Logica di Calcolo (Fondamentale)
1.  La colonna **"Incidenza Totale Anno (A/B)*C"** deve ricalcolarsi istantaneamente ogni volta che l'utente modifica i campi "Totale Voci", "Divisore Annuo" o "Giornate Ferie".
2.  La formula è: `(Totale Voci Accessorie / Divisore Annuo) * Giornate Ferie`.

### E. Salvataggio
1.  Assicurati che OGNI modifica (ai dati del lavoratore o a qualsiasi cella della tabella) venga salvata immediatamente nel `localStorage` per non perdere il lavoro.