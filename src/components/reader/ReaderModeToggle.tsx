import { ArrowDown, BookOpen } from "lucide-react";

import type { ReaderTheme } from "../../hooks/useReaderTheme";

export type ReadingMode = "page" | "vertical";

interface ReaderModeToggleProps {
  mode: ReadingMode;
  onChange: (mode: ReadingMode) => void;
  theme: ReaderTheme;
}

export function ReaderModeToggle({
  mode,
  onChange,
  theme,
}: ReaderModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Modo de leitura"
      className={`inline-flex items-center gap-1 rounded-xl border p-1 ${
        theme === "night"
          ? "border-white/10 bg-[#171A27]/70"
          : "border-stone-300 bg-white/80"
      }`}
    >
      <button
        type="button"
        aria-pressed={mode === "page"}
        onClick={() => onChange("page")}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition focus-visible:outline-2 ${
          theme === "night"
            ? "focus-visible:outline-violet-200"
            : "focus-visible:outline-violet-700"
        } ${
          mode === "page"
            ? theme === "night"
              ? "bg-violet-300/15 text-violet-100"
              : "bg-violet-100 text-violet-900"
            : theme === "night"
              ? "text-slate-400 hover:text-white"
              : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        }`}
      >
        <BookOpen aria-hidden="true" size={15} />
        Páginas
      </button>
      <button
        type="button"
        aria-pressed={mode === "vertical"}
        onClick={() => onChange("vertical")}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition focus-visible:outline-2 ${
          theme === "night"
            ? "focus-visible:outline-violet-200"
            : "focus-visible:outline-violet-700"
        } ${
          mode === "vertical"
            ? theme === "night"
              ? "bg-violet-300/15 text-violet-100"
              : "bg-violet-100 text-violet-900"
            : theme === "night"
              ? "text-slate-400 hover:text-white"
              : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        }`}
      >
        <ArrowDown aria-hidden="true" size={15} />
        Manhwa
      </button>
    </div>
  );
}
