import { Minus, Plus, Type } from "lucide-react";

import type { ReaderTheme } from "../../hooks/useReaderTheme";

interface ReaderTextSizeControlsProps {
  fontSize: number;
  theme: ReaderTheme;
  onChange: (fontSize: number) => void;
}

export function ReaderTextSizeControls({
  fontSize,
  theme,
  onChange,
}: ReaderTextSizeControlsProps) {
  const buttonClass =
    theme === "night"
      ? "text-slate-200 hover:bg-white/10 focus-visible:outline-violet-200"
      : "text-stone-700 hover:bg-stone-200 focus-visible:outline-violet-700";

  return (
    <div role="group" aria-label="Tamanho do texto" className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(14, fontSize - 2))}
        disabled={fontSize <= 14}
        aria-label="Diminuir tamanho do texto"
        className={`inline-flex size-10 items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-40 ${buttonClass}`}
      >
        <Minus aria-hidden="true" size={16} />
        <Type aria-hidden="true" size={14} />
      </button>
      <span
        aria-live="polite"
        aria-label={`Texto em ${fontSize} pixels`}
        className={`min-w-10 text-center text-xs tabular-nums ${
          theme === "night" ? "text-slate-300" : "text-stone-600"
        }`}
      >
        {fontSize}px
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(28, fontSize + 2))}
        disabled={fontSize >= 28}
        aria-label="Aumentar tamanho do texto"
        className={`inline-flex size-10 items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-40 ${buttonClass}`}
      >
        <Type aria-hidden="true" size={14} />
        <Plus aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
