-- Data di assunzione (inserita a mano dalla busta): promossa da localStorage
-- a campo cloud, così sopravvive a browser/dispositivi diversi ed è visibile
-- anche al viewer in sola lettura.
-- Applicata sul progetto live via MCP il 2026-06-11.
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS data_assunzione text;
