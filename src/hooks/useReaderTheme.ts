import { useCallback, useState } from "react";

export type ReaderTheme = "night" | "light";

const STORAGE_KEY = "librio-reader-theme";

function getStoredTheme(): ReaderTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "light"
      ? "light"
      : window.localStorage.getItem(STORAGE_KEY) === "night"
        ? "night"
        : "light";
  } catch {
    return "light";
  }
}

export function useReaderTheme() {
  const [theme, setThemeState] = useState<ReaderTheme>(getStoredTheme);
  const setTheme = useCallback((nextTheme: ReaderTheme) => {
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch (error) {
      console.warn("Não foi possível salvar o tema do leitor.", error);
    }
  }, []);

  return { theme, setTheme };
}
