-- 019_optimize_rls_initplan.sql
-- Avvolge auth.uid() in (select auth.uid()) per evitare la rivalutazione per-riga
-- delle policy RLS (advisor Supabase: auth_rls_initplan).
-- Le definizioni sono IDENTICHE alle precedenti: cambia solo (select ...).
-- UUID hardcoded preservati: viewer sola-lettura 34967593..., owner app_settings 7fec036e...
-- Applicata sul DB remoto via MCP il 2026-06-18; questo file tiene il repo allineato.

-- worker_profiles (role public)
drop policy if exists "workers: select own" on public.worker_profiles;
create policy "workers: select own" on public.worker_profiles
  for select to public
  using (((owner_id = (select auth.uid())) or ((select auth.uid()) = '34967593-6447-45fd-a303-13ec842c7b9e'::uuid)));

drop policy if exists "workers: insert own" on public.worker_profiles;
create policy "workers: insert own" on public.worker_profiles
  for insert to public
  with check (((owner_id = (select auth.uid())) and ((select auth.uid()) <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid)));

drop policy if exists "workers: update own" on public.worker_profiles;
create policy "workers: update own" on public.worker_profiles
  for update to public
  using (((owner_id = (select auth.uid())) and ((select auth.uid()) <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid)))
  with check (((owner_id = (select auth.uid())) and ((select auth.uid()) <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid)));

drop policy if exists "workers: delete own" on public.worker_profiles;
create policy "workers: delete own" on public.worker_profiles
  for delete to public
  using (((owner_id = (select auth.uid())) and ((select auth.uid()) <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid)));

-- payslip_metadata (role public)
drop policy if exists "payslips: select own" on public.payslip_metadata;
create policy "payslips: select own" on public.payslip_metadata
  for select to public
  using ((((select auth.uid()) = owner_id) or ((select auth.uid()) = '34967593-6447-45fd-a303-13ec842c7b9e'::uuid)));

drop policy if exists "payslips: insert own" on public.payslip_metadata;
create policy "payslips: insert own" on public.payslip_metadata
  for insert to public
  with check ((((select auth.uid()) = owner_id) and ((select auth.uid()) <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid)));

drop policy if exists "payslips: delete own" on public.payslip_metadata;
create policy "payslips: delete own" on public.payslip_metadata
  for delete to public
  using ((((select auth.uid()) = owner_id) and ((select auth.uid()) <> '34967593-6447-45fd-a303-13ec842c7b9e'::uuid)));

-- user_settings (role public, ALL)
drop policy if exists "Users manage own settings" on public.user_settings;
create policy "Users manage own settings" on public.user_settings
  for all to public
  using (((select auth.uid()) = owner_id))
  with check (((select auth.uid()) = owner_id));

-- legal_queries (role authenticated)
drop policy if exists "user_own_queries_select" on public.legal_queries;
create policy "user_own_queries_select" on public.legal_queries
  for select to authenticated
  using (((select auth.uid()) = user_id));

drop policy if exists "user_own_queries_insert" on public.legal_queries;
create policy "user_own_queries_insert" on public.legal_queries
  for insert to authenticated
  with check (((select auth.uid()) = user_id));

drop policy if exists "user_own_queries_update" on public.legal_queries;
create policy "user_own_queries_update" on public.legal_queries
  for update to authenticated
  using (((select auth.uid()) = user_id))
  with check (((select auth.uid()) = user_id));

drop policy if exists "user_own_queries_delete" on public.legal_queries;
create policy "user_own_queries_delete" on public.legal_queries
  for delete to authenticated
  using (((select auth.uid()) = user_id));

-- scan_sessions (role authenticated) -- NON tocco scan_sessions_update_any (usa expires_at)
drop policy if exists "scan_sessions_select_owner" on public.scan_sessions;
create policy "scan_sessions_select_owner" on public.scan_sessions
  for select to authenticated
  using ((owner_id = (select auth.uid())));

drop policy if exists "scan_sessions_insert_owner" on public.scan_sessions;
create policy "scan_sessions_insert_owner" on public.scan_sessions
  for insert to authenticated
  with check ((owner_id = (select auth.uid())));

drop policy if exists "scan_sessions_delete_owner" on public.scan_sessions;
create policy "scan_sessions_delete_owner" on public.scan_sessions
  for delete to authenticated
  using ((owner_id = (select auth.uid())));

-- scan_results (role authenticated) -- NON tocco le policy anon basate su is_active_scan_session()
drop policy if exists "scan_results_select_owner" on public.scan_results;
create policy "scan_results_select_owner" on public.scan_results
  for select to authenticated
  using ((exists ( select 1 from scan_sessions s
    where ((s.id = scan_results.session_id) and (s.owner_id = (select auth.uid()))))));

drop policy if exists "scan_results_delete_cascade" on public.scan_results;
create policy "scan_results_delete_cascade" on public.scan_results
  for delete to authenticated
  using ((exists ( select 1 from scan_sessions s
    where ((s.id = scan_results.session_id) and (s.owner_id = (select auth.uid()))))));

-- pratiche_riposi (role authenticated)
drop policy if exists "pratiche_riposi_select_owner" on public.pratiche_riposi;
create policy "pratiche_riposi_select_owner" on public.pratiche_riposi
  for select to authenticated
  using ((owner_id = (select auth.uid())));

drop policy if exists "pratiche_riposi_insert_owner" on public.pratiche_riposi;
create policy "pratiche_riposi_insert_owner" on public.pratiche_riposi
  for insert to authenticated
  with check ((owner_id = (select auth.uid())));

drop policy if exists "pratiche_riposi_update_owner" on public.pratiche_riposi;
create policy "pratiche_riposi_update_owner" on public.pratiche_riposi
  for update to authenticated
  using ((owner_id = (select auth.uid())))
  with check ((owner_id = (select auth.uid())));

drop policy if exists "pratiche_riposi_delete_owner" on public.pratiche_riposi;
create policy "pratiche_riposi_delete_owner" on public.pratiche_riposi
  for delete to authenticated
  using ((owner_id = (select auth.uid())));

-- app_settings (role authenticated) -- NON tocco app_settings_select_all (USING true volontario)
drop policy if exists "app_settings_update_owner" on public.app_settings;
create policy "app_settings_update_owner" on public.app_settings
  for update to authenticated
  using (((select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid))
  with check (((select auth.uid()) = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70'::uuid));
