import { supabase } from '../supabaseClient';

const BUCKET = 'payslips_archive';

export interface VerifyLogEntry {
    run_at: string;
    status: 'success' | 'warning' | 'error';
    discrepancy_count: number;
}

export interface PayslipRecord {
    id: string;
    owner_id: string;
    worker_id: string;
    storage_path: string;
    filename: string;
    year: number;
    month: string;
    uploaded_at: string;
    extracted_data: any;
    verify_history?: VerifyLogEntry[];
}

export function usePayslipArchive() {

    const addPayslip = async (
        workerId: string,
        file: File,
        year: number,
        month: string,
        monthIndex: number,
        extractedData: any
    ): Promise<void> => {
        console.log('[Archive] addPayslip chiamato per:', file.name, year, month);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) {
            console.error('[Archive] Errore auth.getUser():', authError);
            return;
        }
        if (!user) {
            console.error('[Archive] Nessun utente autenticato — archivio saltato.');
            return;
        }
        console.log('[Archive] Utente autenticato:', user.id);

        const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const paddedMonth = String(monthIndex).padStart(2, '0');
        const storagePath = `${user.id}/${workerId}/${year}_${paddedMonth}_${safeFilename}`;
        console.log('[Archive] Storage path:', storagePath);

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, file, { upsert: true });

        if (uploadError) {
            console.error('[Archive] Upload Storage fallito:', uploadError);
            return;
        }
        console.log('[Archive] Upload Storage OK');

        const payload = {
            owner_id: user.id,
            worker_id: workerId,
            storage_path: storagePath,
            filename: file.name,
            year,
            month,
            extracted_data: extractedData,
        };
        console.log('[Archive] Insert payload:', payload);

        const { error: insertError } = await supabase
            .from('payslip_metadata')
            .insert(payload);

        if (insertError) {
            console.error('[Archive] Insert metadati fallito:', insertError);
            await supabase.storage.from(BUCKET).remove([storagePath]);
            return;
        }
        console.log('[Archive] Insert metadati OK — busta paga archiviata.');
    };

    const getPayslipsByWorker = async (workerId: string): Promise<PayslipRecord[]> => {
        const { data, error } = await supabase
            .from('payslip_metadata')
            .select('*')
            .eq('worker_id', workerId)
            .order('year', { ascending: false })
            .order('uploaded_at', { ascending: false });

        if (error) {
            console.error('[Archive] Lettura fallita:', error.message);
            return [];
        }
        return (data as PayslipRecord[]) || [];
    };

    const deletePayslip = async (id: string, storagePath: string): Promise<void> => {
        const { error: storageError } = await supabase.storage
            .from(BUCKET)
            .remove([storagePath]);

        if (storageError) {
            console.error('[Archive] Eliminazione file fallita:', storageError.message);
        }

        const { error: dbError } = await supabase
            .from('payslip_metadata')
            .delete()
            .eq('id', id);

        if (dbError) {
            console.error('[Archive] Eliminazione metadati fallita:', dbError.message);
        }
    };

    const getSignedUrl = async (storagePath: string): Promise<string | null> => {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(storagePath, 3600); // URL valido 1 ora

        if (error || !data) return null;
        return data.signedUrl;
    };

    const addVerifyLog = async (id: string, entry: VerifyLogEntry): Promise<void> => {
        const { data } = await supabase
            .from('payslip_metadata')
            .select('verify_history')
            .eq('id', id)
            .single();
        const current: VerifyLogEntry[] = Array.isArray(data?.verify_history) ? data.verify_history : [];
        const { error } = await supabase
            .from('payslip_metadata')
            .update({ verify_history: [...current, entry] })
            .eq('id', id);
        if (error) console.error('[Archive] addVerifyLog fallito:', error.message);
    };

    const updateExtractedData = async (id: string, extractedData: any): Promise<void> => {
        const { error } = await supabase
            .from('payslip_metadata')
            .update({ extracted_data: extractedData })
            .eq('id', id);

        if (error) console.error('[Archive] Update extracted_data fallito:', error);
    };

    return { addPayslip, getPayslipsByWorker, deletePayslip, getSignedUrl, updateExtractedData, addVerifyLog };
}
