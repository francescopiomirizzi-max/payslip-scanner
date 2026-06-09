// @vitest-environment jsdom
//
// Strategia B (assenze retribuite nel divisore): la preferenza vive su
// localStorage `paidLeave_<id>` perché NON esiste una colonna DB. resolveIncludePaidLeave
// è l'unica fonte di verità consultata da tutte le viste aggregate (card "Credito Stimato
// Totale", ordinamento, WorkerCard, relazione). Questi test bloccano la precedenza
// campo → localStorage → default, così la dashboard non torna a calcolare i distaccati
// (Cataneo) in Strategia A mostrando crediti gonfiati.
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveIncludePaidLeave } from '../types';

describe('resolveIncludePaidLeave — precedenza Strategia B', () => {
  beforeEach(() => localStorage.clear());

  it('1. il campo esplicito vince su tutto', () => {
    localStorage.setItem('paidLeave_w1', 'false');
    expect(resolveIncludePaidLeave({ id: 'w1', profilo: 'RFI', includePaidLeave: true })).toBe(true);
    localStorage.setItem('paidLeave_w2', 'true');
    expect(resolveIncludePaidLeave({ id: 'w2', profilo: 'RFI', includePaidLeave: false })).toBe(false);
  });

  it('2. senza campo, legge localStorage paidLeave_<id> (il caso Cataneo)', () => {
    localStorage.setItem('paidLeave_cataneo', 'true');
    // Questo è il bug storico: la card dashboard ignorava localStorage e tornava al default.
    expect(resolveIncludePaidLeave({ id: 'cataneo', profilo: 'RFI' })).toBe(true);
  });

  it('2b. localStorage = false → Strategia A esplicita', () => {
    localStorage.setItem('paidLeave_w3', 'false');
    expect(resolveIncludePaidLeave({ id: 'w3', profilo: 'RFI' })).toBe(false);
  });

  it('3. senza campo né localStorage → default profilo (oggi vuoto → A per tutti)', () => {
    expect(resolveIncludePaidLeave({ id: 'w4', profilo: 'RFI' })).toBe(false);
    expect(resolveIncludePaidLeave({ id: 'w5', profilo: 'TRENITALIA' })).toBe(false);
  });

  it('robustezza: valore corrotto in localStorage → default, niente eccezioni', () => {
    localStorage.setItem('paidLeave_w6', '{non-json');
    expect(() => resolveIncludePaidLeave({ id: 'w6', profilo: 'RFI' })).not.toThrow();
    expect(resolveIncludePaidLeave({ id: 'w6', profilo: 'RFI' })).toBe(false);
  });

  it('worker nullo o senza id → default, senza toccare localStorage', () => {
    expect(resolveIncludePaidLeave(null)).toBe(false);
    expect(resolveIncludePaidLeave({ profilo: 'RFI' })).toBe(false);
  });
});
