'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Palette = 'sherbet' | 'mintfog';
export type Mode = 'day' | 'night';

const ThemeContext = createContext<{
  palette: Palette;
  mode: Mode;
  setPalette: (p: Palette) => void;
  toggleMode: () => void;
} | null>(null);

const PALETTE_KEY = 'biddrift:palette';
const MODE_KEY = 'biddrift:mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>('mintfog');
  const [mode, setModeState] = useState<Mode>('day');

  useEffect(() => {
    const storedPalette = localStorage.getItem(PALETTE_KEY);
    const storedMode = localStorage.getItem(MODE_KEY);
    if (storedPalette === 'sherbet' || storedPalette === 'mintfog') setPaletteState(storedPalette);
    if (storedMode === 'day' || storedMode === 'night') setModeState(storedMode);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    localStorage.setItem(PALETTE_KEY, palette);
  }, [palette]);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  const setPalette = (p: Palette) => setPaletteState(p);
  const toggleMode = () => setModeState((m) => (m === 'day' ? 'night' : 'day'));

  return (
    <ThemeContext.Provider value={{ palette, mode, setPalette, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
