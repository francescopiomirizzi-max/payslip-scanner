import { supabase } from '../supabaseClient';

const MIGRATION_LOCK_KEY = 'workers_migration_in_progress';

/**
 * One-time migration: reads workers from localStorage and pushes them to Supabase.
 * Runs only if Supabase is empty for this user AND localStorage has data.
 * Returns true if migration happened, false otherwise.
 */
export async function migrateLocalToCloud(ownerId: string): Promise<boolean> {
    // Guard against concurrent calls within the same tab (e.g. double auth event)
    if (sessionStorage.getItem(MIGRATION_LOCK_KEY)) return false;
    sessionStorage.setItem(MIGRATION_LOCK_KEY, '1');

    try {
        return await _doMigrate(ownerId);
    } finally {
        sessionStorage.removeItem(MIGRATION_LOCK_KEY);
    }
}

async function _doMigrate(ownerId: string): Promise<boolean> {
    // 1. If Supabase already has workers for this user, skip
    const { data: existing, error: checkError } = await supabase
        .from('worker_profiles')
        .select('id')
        .eq('owner_id', ownerId)
        .limit(1);

    if (checkError) {
        console.error('[Migration] Check failed:', checkError);
        return false;
    }
    if (existing && existing.length > 0) return false;

    // 2. Read from localStorage
    const raw = localStorage.getItem('workers_data');
    if (!raw) return false;

    let localWorkers: any[];
    try {
        localWorkers = JSON.parse(raw);
    } catch {
        return false;
    }
    if (!Array.isArray(localWorkers) || localWorkers.length === 0) return false;

    // 3. Map to DB format with fresh UUIDs
    const rows = localWorkers.map((w: any) => ({
        id: crypto.randomUUID(),
        owner_id: ownerId,
        nome: w.nome ?? '',
        cognome: w.cognome ?? '',
        ruolo: w.ruolo ?? '',
        profilo: w.profilo ?? 'RFI',
        elior_type: w.eliorType ?? null,
        status: w.status ?? null,
        accent_color: w.accentColor ?? 'blue',
        avatar_url: w.avatarUrl ?? null,
        notes: w.notes ?? null,
        tfr_pregresso: w.tfr_pregresso ?? null,
        tfr_pregresso_anno: w.tfr_pregresso_anno ?? null,
        anni: w.anni ?? [],
    }));

    const { error: insertError } = await supabase
        .from('worker_profiles')
        .insert(rows);

    if (insertError) {
        console.error('[Migration] Insert failed:', insertError);
        return false;
    }

    // 4. Backup and clear localStorage (settings keys like startYear_ stay intact)
    localStorage.setItem('workers_data_local_backup', raw);
    localStorage.removeItem('workers_data');

    console.log(`[Migration] Migrated ${rows.length} workers to Supabase.`);
    return true;
}
