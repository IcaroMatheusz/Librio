import { Minus, Plus } from "lucide-react";

import type { ReaderTheme } from "../../hooks/useReaderTheme";

interface ReaderZoomControlsProps {
  zoom: number;
  theme: ReaderTheme;
  onChange: (zoom: number) => void;
}

export function ReaderZoomControls({
  zoom,
  theme,
  onChange,
}: ReaderZoomControlsProps) {
  const buttonClass =
    theme === "night"
      ? "text-slate-200 hover:bg-white/10 focus-visible:outline-violet-200"
      : "text-stone-700 hover:bg-stone-200 focus-visible:outline-violet-700";

  function changeZoom(delta: number) {
    onChange(Math.min(3, Math.max(0.5, Math.round((zoom + delta) * 10) / 10)));
  }

  return (
    <div role="group" aria-label="Zoom da página" className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => changeZoom(-0.1)}
        disabled={zoom <= 0.5}
        aria-label="Diminuir zoom"
        aria-keyshortcuts="-"
        className={`inline-flex size-10 items-center justify-center rounded-lg transition focus-visible:outline-2 disabled:opacity-40 ${buttonClass}`}
      >
        <Minus aria-hidden="true" size={18} />
      </button>
      <button
        type="button"
        onClick={() => onChange(1)}
        aria-label="Ajustar página à tela"
        aria-keyshortcuts="0"
        title="Ajustar página à tela"
        className={`min-w-12 rounded-lg px-1 py-2 text-center text-xs tabular-nums transition focus-visible:outline-2 ${buttonClass}`}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={() => changeZoom(0.1)}
        disabled={zoom >= 3}
        aria-label="Aumentar zoom"
        aria-keyshortcuts="+"
        className={`inline-flex size-10 items-center justify-center rounded-lg transition focus-visible:outline-2 disabled:opacity-40 ${buttonClass}`}
      >
        <Plus aria-hidden="true" size={18} />
      </button>
    </div>
  );
}
