import { Moon, Sun } from "lucide-react";

import type { ReaderTheme } from "../../hooks/useReaderTheme";

interface ReaderThemeToggleProps {
  theme: ReaderTheme;
  onChange: (theme: ReaderTheme) => void;
}

export function ReaderThemeToggle({
  theme,
  onChange,
}: ReaderThemeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Tema de leitura"
      className={`inline-flex items-center gap-1 rounded-xl border p-1 ${
        theme === "night"
          ? "border-white/10 bg-[#171A27]/70"
          : "border-stone-300 bg-white/80"
      }`}
    >
      <button
        type="button"
        aria-pressed={theme === "light"}
        onClick={() => onChange("light")}
        aria-label="Tema claro"
        title="Tema claro"
        className={`inline-flex size-9 items-center justify-center rounded-lg transition focus-visible:outline-2 ${
          theme === "night"
            ? "focus-visible:outline-violet-200"
            : "focus-visible:outline-violet-700"
        } ${
          theme === "light"
            ? "bg-amber-100 text-amber-800"
            : theme === "night"
              ? "text-slate-400 hover:text-white"
              : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        }`}
      >
        <Sun aria-hidden="true" size={16} />
      </button>
      <button
        type="button"
        aria-pressed={theme === "night"}
        onClick={() => onChange("night")}
        aria-label="Tema noturno"
        title="Tema noturno"
        className={`inline-flex size-9 items-center justify-center rounded-lg transition focus-visible:outline-2 ${
          theme === "night"
            ? "focus-visible:outline-violet-200"
            : "focus-visible:outline-violet-700"
        } ${
          theme === "night"
            ? "bg-violet-300/15 text-violet-100"
            : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        }`}
      >
        <Moon aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
