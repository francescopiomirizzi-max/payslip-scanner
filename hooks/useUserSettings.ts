import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Cloud-synced user settings (per-account, not per-worker).
 * Supabase is the source of truth; localStorage is a fast-access cache.
 * On first use, migrates any existing localStorage data to the cloud.
 */
export function useUserSettings() {
    const [customCompanies, setCustomCompaniesState] = useState<Record<string, any>>(() => {
        try {
            const saved = localStorage.getItem('customCompanies');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('user_settings')
                .select('custom_companies')
                .eq('owner_id', user.id)
                .single();

            if (data?.custom_companies && Object.keys(data.custom_companies).length > 0) {
                // Cloud wins — sync down to cache
                setCustomCompaniesState(data.custom_companies);
                localStorage.setItem('customCompanies', JSON.stringify(data.custom_companies));
                window.dispatchEvent(new Event('storage'));
            } else {
                // First device: migrate existing localStorage data up to cloud
                const saved = localStorage.getItem('customCompanies');
                if (saved) {
                    try {
                        const companies = JSON.parse(saved);
                        if (Object.keys(companies).length > 0) {
                            await supabase.from('user_settings').upsert(
                                { owner_id: user.id, custom_companies: companies },
                                { onConflict: 'owner_id' }
                            );
                            setCustomCompaniesState(companies);
                        }
                    } catch {}
                }
            }
        })();
    }, []);

    const setCustomCompanies = useCallback(async (companies: Record<string, any>) => {
        setCustomCompaniesState(companies);
        localStorage.setItem('customCompanies', JSON.stringify(companies));
        window.dispatchEvent(new Event('storage'));

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from('user_settings').upsert(
            { owner_id: user.id, custom_companies: companies, updated_at: new Date().toISOString() },
            { onConflict: 'owner_id' }
        );
    }, []);

    return { customCompanies, setCustomCompanies };
}
