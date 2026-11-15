import { ChevronDown } from "lucide-react";

import type { ReaderTheme } from "../../hooks/useReaderTheme";

export interface ChapterOption {
  value: string;
  label: string;
}

interface ChapterSelectorProps {
  id: string;
  label: string;
  value: string;
  options: ChapterOption[];
  theme: ReaderTheme;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function ChapterSelector({
  id,
  label,
  value,
  options,
  theme,
  disabled = false,
  onChange,
}: ChapterSelectorProps) {
  return (
    <div className="relative min-w-0">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 max-w-44 appearance-none rounded-xl border py-2 pl-3 pr-9 text-xs font-semibold shadow-sm outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-64 sm:text-sm ${
          theme === "night"
            ? "border-violet-200/15 bg-gradient-to-b from-[#292d40] to-[#1b1f30] text-slate-100 shadow-black/20 hover:border-violet-200/30 focus:border-violet-200/50 focus:ring-violet-300/10"
            : "border-stone-300 bg-white text-stone-800 hover:border-violet-400 focus:border-violet-500 focus:ring-violet-500/15"
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={14}
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${
          theme === "night" ? "text-violet-200" : "text-violet-700"
        }`}
      />
    </div>
  );
}
