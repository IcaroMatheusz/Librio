import { ArrowDown, BookOpen } from "lucide-react";

export type ReadingMode = "page" | "vertical";

interface ReaderModeToggleProps {
  mode: ReadingMode;
  onChange: (mode: ReadingMode) => void;
}

export function ReaderModeToggle({ mode, onChange }: ReaderModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Modo de leitura"
      className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#171A27]/70 p-1"
    >
      <button
        type="button"
        aria-pressed={mode === "page"}
        onClick={() => onChange("page")}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-violet-200 ${
          mode === "page"
            ? "bg-violet-300/15 text-violet-100"
            : "text-slate-400 hover:text-white"
        }`}
      >
        <BookOpen aria-hidden="true" size={15} />
        Páginas
      </button>
      <button
        type="button"
        aria-pressed={mode === "vertical"}
        onClick={() => onChange("vertical")}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-violet-200 ${
          mode === "vertical"
            ? "bg-violet-300/15 text-violet-100"
            : "text-slate-400 hover:text-white"
        }`}
      >
        <ArrowDown aria-hidden="true" size={15} />
        Manhwa
      </button>
    </div>
  );
}
