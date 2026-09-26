import { useCallback, useEffect, useState } from 'react';

const KEY = 'lapidare-theme';

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Tema claro (Marfim) / escuro (Oliva). Sem escolha salva, segue o sistema. */
export default function useTheme() {
  const [theme, setTheme] = useState(() => readStored() || systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* armazenamento indisponível: vale só nesta visita */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
