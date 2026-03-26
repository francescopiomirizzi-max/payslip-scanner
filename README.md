# 🚀 RailFlow

## Panoramica
Un'applicazione web di livello Enterprise progettata per la gestione avanzata dei dati dei lavoratori, l'elaborazione dei cedolini e il calcolo delle indennità (TFR, rivalutazioni ISTAT). 

Questo progetto dimostra come una visione tecnica rigorosa possa trasformare processi originariamente frammentati e basati su fogli di calcolo disorganizzati in un'architettura centralizzata, reattiva e scalabile. La spinta verso un livello di definizione estremo e curato al singolo pixel ha guidato ogni scelta ingegneristica e di design, garantendo un'esperienza utente senza compromessi.

## ✨ Funzionalità Principali (Core Features)
* **Motore di Calcolo Avanzato:** Elaborazione in tempo reale di dati finanziari complessi, indennità e scorporo mesi, con ottimizzazione aggressiva dei re-render tramite `useMemo`.
* **Data Entry Fulmineo (Excel-Like):** Griglia dati interattiva con navigazione nativa da tastiera (Frecce, Tab, Enter), highlight visivo profondo della riga attiva e focus management per un inserimento dati ad altissima velocità.
* **Integrazione Hardware/Software:** Scanner QR in tempo reale ed elaborazione OCR integrata per l'acquisizione automatizzata e massiva dei documenti.
* **UI/UX Premium:** Interfaccia utente basata su principi di Glassmorphism, con una Dark Mode nativa calibrata per il massimo comfort visivo (contrast ratio ottimizzato) e animazioni fluide a 60fps.
* **Gestione Dinamica degli Stati (Smart UI):** Rendering condizionale intelligente (Empty States animati) basato sull'effettivo carico di dati matematici, per guidare l'utente nei flussi di lavoro a freddo.

## 🛠️ Stack Tecnologico
* **Core:** React (Single Page Application)
* **Styling & Design System:** Tailwind CSS v4 (sfruttando il nuovo standard semantico e le utility per alleggerire il DOM).
* **Animazioni:** Framer Motion (curve di transizione fisiche `spring` standardizzate per transizioni burrose).
* **Iconografia:** Lucide React.
* **Architettura Dati:** Gestione eventi ottimizzata con rigoroso memory leak prevention e listener globali per shortcut da tastiera.

## ⚙️ Architettura e Performance
L'applicazione è ingegnerizzata per garantire stabilità strutturale e reattività anche sotto stress:
* Estrazione di utility functions pure per la formattazione e i calcoli matematici, mantenendo i componenti UI leggeri.
* Prevenzione attiva dei memory leak tramite la gestione chirurgica dei cicli di vita (`clearInterval`, `removeEventListener` al momento dell'unmount).
* Risoluzione strutturale di *stale closures* per garantire la perfetta sincronizzazione dello stato asincrono tra componenti padre e figlio.

## 💻 Installazione e Sviluppo Locale (Local Setup)
Per avviare l'ambiente di sviluppo locale, segui questi passaggi:

**Prerequisiti:** Node.js installato sulla macchina.

1. **Installa le dipendenze:**
   ```bash
   npm install

👨‍💻 Tech Lead & Sviluppo
Progettato, sviluppato e manutenuto da Francesco Pio Mirizzi.