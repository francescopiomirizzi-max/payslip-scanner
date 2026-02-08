import React, { useState } from 'react';
import { Plus, User, ArrowLeft, Trash2, Edit2 } from 'lucide-react';

// --- 1. DATI INIZIALI CORRETTI CON ID ANCHE NEGLI ANNI ---
const inizializzaLavoratori = () => [
  {
    id: 1,
    nome: "Mario",
    cognome: "Rossi",
    anni: [
      {
        id: 101, // ID univoco per l'anno
        anno: 2023,
        totaleVociAccessorie: 5000.00,
        divisoreAnnuo: 312,
        giornateFerieFruite: 20
      },
      {
        id: 102,
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
        id: 201,
        anno: 2023,
        totaleVociAccessorie: 4800.00,
        divisoreAnnuo: 312,
        giornateFerieFruite: 18
      }
    ]
  }
];

// Funzioni di calcolo (Invariate)
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
function SchedaLavoratore({ lavoratore, onClick }: any) {
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

  // --- 2. MODIFICA: AGGIUNTA ID UNIVOCO PER NUOVI ANNI ---
  const aggiungiAnno = () => {
    const nuovoAnno = {
      id: Date.now(), // Genera ID univoco basato sul tempo
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
                      onChange={(e) => setDatiModifica({ ...datiModifica, nome: e.target.value })}
                      className="border border-gray-300 rounded px-3 py-2"
                      placeholder="Nome"
                    />
                    <input
                      type="text"
                      value={datiModifica.cognome}
                      onChange={(e) => setDatiModifica({ ...datiModifica, cognome: e.target.value })}
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
                  /* --- 3. MODIFICA: USO DI KEY UNICA AL POSTO DELL'INDEX --- */
                  <tr key={anno.id || index} className="hover:bg-gray-50">
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

  // --- 4. MODIFICA: GENERAZIONE ID PIÙ ROBUSTA ---
  const handleAggiungiLavoratore = () => {
    // Usiamo Date.now() per garantire un ID sempre univoco
    const nuovoLavoratore = {
      id: Date.now(),
      nome: "Nuovo",
      cognome: "Lavoratore",
      anni: []
    };

    // Aggiorniamo lo stato in modo sicuro
    setLavoratori(prevLavoratori => [...prevLavoratori, nuovoLavoratore]);
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