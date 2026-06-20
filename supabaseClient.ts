import { createClient } from '@supabase/supabase-js';
import { IS_DEMO } from './config/demo';

// Credenziali reali del progetto (chiave PUBBLICABILE, non segreta).
const REAL_URL = 'https://bpnkjfboijfhnqovymwg.supabase.co';
const REAL_KEY = 'sb_publishable_6U9ZrZTfUraZJQldwhfBHQ_n440rZWf';

// In DEMO il client punta a un host irraggiungibile (.invalid non risolve mai):
// la vetrina non può FISICAMENTE raggiungere il database reale — sicurezza by
// design, vedi config/demo.ts. In modalità normale il comportamento è identico
// a prima (stesse credenziali hardcoded di sempre).
const supabaseUrl = IS_DEMO ? 'http://demo.invalid' : REAL_URL;
const supabaseKey = IS_DEMO ? 'demo-anon-key' : REAL_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
