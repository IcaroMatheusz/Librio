import { ArrowDown, BookOpen, Languages } from "lucide-react";

import type { ReaderTheme } from "../../hooks/useReaderTheme";

export type ReadingMode = "page" | "manga" | "vertical";

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
  const isNight = theme === "night";

  return (
    <div
      role="group"
      aria-label="Modo de leitura"
      className={`inline-flex items-center gap-1 rounded-xl border p-1 ${
        isNight
          ? "border-white/10 bg-[#171A27]/70"
          : "border-stone-300 bg-white/80"
      }`}
    >
      <button
        type="button"
        aria-pressed={mode === "page"}
        title="Páginas: leitura padrão ocidental (esquerda para a direita)"
        onClick={() => onChange("page")}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition focus-visible:outline-2 ${
          isNight
            ? "focus-visible:outline-violet-200"
            : "focus-visible:outline-violet-700"
        } ${
          mode === "page"
            ? isNight
              ? "bg-violet-300/15 text-violet-100"
              : "bg-violet-100 text-violet-900"
            : isNight
              ? "text-slate-400 hover:text-white"
              : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        }`}
      >
        <BookOpen aria-hidden="true" size={14} />
        Páginas
      </button>

      <button
        type="button"
        aria-pressed={mode === "manga"}
        title="Mangá: leitura oriental da direita para a esquerda (RTL)"
        onClick={() => onChange("manga")}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition focus-visible:outline-2 ${
          isNight
            ? "focus-visible:outline-violet-200"
            : "focus-visible:outline-violet-700"
        } ${
          mode === "manga"
            ? isNight
              ? "bg-violet-300/15 text-violet-100"
              : "bg-violet-100 text-violet-900"
            : isNight
              ? "text-slate-400 hover:text-white"
              : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        }`}
      >
        <Languages aria-hidden="true" size={14} />
        Mangá (RTL)
      </button>

      <button
        type="button"
        aria-pressed={mode === "vertical"}
        title="Rolagem: leitura vertical contínua (Webtoon / Manhwa)"
        onClick={() => onChange("vertical")}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition focus-visible:outline-2 ${
          isNight
            ? "focus-visible:outline-violet-200"
            : "focus-visible:outline-violet-700"
        } ${
          mode === "vertical"
            ? isNight
              ? "bg-violet-300/15 text-violet-100"
              : "bg-violet-100 text-violet-900"
            : isNight
              ? "text-slate-400 hover:text-white"
              : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
        }`}
      >
        <ArrowDown aria-hidden="true" size={14} />
        Rolagem
      </button>
    </div>
  );
}
