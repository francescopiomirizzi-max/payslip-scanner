import { createClient } from '@supabase/supabase-js';

// 1. IL TUO PROJECT URL (Già inserito corretto dalle tue foto)
const supabaseUrl = 'https://bpnkjfboijfhnqovymwg.supabase.co';

// 2. LA TUA CHIAVE PUBBLICA
// Incolla qui sotto la chiave che hai copiato cliccando sui foglietti accanto a "Publishable key" / "default"
const supabaseKey = 'sb_publishable_6U9ZrZTfUraZJQldwhfBHQ_n440rZWf';

export const supabase = createClient(supabaseUrl, supabaseKey);