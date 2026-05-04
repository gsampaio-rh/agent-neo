import { useCallback, useState } from 'react';

export interface Persona {
  name: string;
  avatarId: string;
}

const STORAGE_KEY = 'neo:persona';

function loadPersona(): Persona | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.name === 'string' && typeof parsed.avatarId === 'string') {
      return parsed as Persona;
    }
    return null;
  } catch {
    return null;
  }
}

function savePersona(persona: Persona) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persona));
  } catch { /* localStorage unavailable */ }
}

function removePersona() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* localStorage unavailable */ }
}

export interface PersonaActions {
  persona: Persona | null;
  setPersona: (p: Persona) => void;
  clearPersona: () => void;
}

export function usePersona(): PersonaActions {
  const [persona, setPersonaState] = useState<Persona | null>(loadPersona);

  const setPersona = useCallback((p: Persona) => {
    if (!p.name.trim() || !p.avatarId) return;
    const cleaned = { name: p.name.trim(), avatarId: p.avatarId };
    savePersona(cleaned);
    setPersonaState(cleaned);
  }, []);

  const clearPersona = useCallback(() => {
    removePersona();
    setPersonaState(null);
  }, []);

  return { persona, setPersona, clearPersona };
}
