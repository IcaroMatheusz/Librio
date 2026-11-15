import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

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
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<string, HTMLDivElement>());
  const selectedOption = options.find((option) => option.value === value);
  const isNight = theme === "night";

  useEffect(() => {
    if (!isOpen) return;
    optionRefs.current.get(value)?.focus();

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen, value]);

  function selectOption(option: ChapterOption) {
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setIsOpen(true);
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
    if (event.key === "ArrowUp") {
      nextIndex = (index - 1 + options.length) % options.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = options.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      optionRefs.current.get(options[nextIndex].value)?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(options[index]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-options`}
        aria-labelledby={`${id}-label`}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
        className={`inline-flex h-10 max-w-44 min-w-36 items-center justify-between gap-3 rounded-xl border py-2 pl-3 pr-2.5 text-left text-xs font-semibold shadow-sm outline-none transition focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-64 sm:min-w-48 sm:text-sm ${
          isNight
            ? "border-violet-200/15 bg-[#202435] text-slate-100 shadow-black/20 hover:border-violet-200/35 hover:bg-[#272c40] focus:border-violet-200/50 focus-visible:ring-violet-300/10"
            : "border-stone-300 bg-white text-stone-800 hover:border-violet-400 focus:border-violet-500 focus-visible:ring-violet-500/15"
        }`}
      >
        <span className="truncate">{selectedOption?.label ?? label}</span>
        <ChevronDown
          aria-hidden="true"
          size={15}
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          } ${isNight ? "text-violet-200" : "text-violet-700"}`}
        />
      </button>

      {isOpen && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className={`chapter-menu-enter absolute right-0 z-50 mt-2 max-h-[min(65vh,28rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border p-1.5 shadow-2xl backdrop-blur-xl ${
            isNight
              ? "border-white/10 bg-[#1b1f30]/[0.98] text-slate-200 shadow-black/50"
              : "border-stone-200 bg-white/[0.98] text-stone-800 shadow-stone-900/20"
          }`}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                ref={(element) => {
                  if (element) optionRefs.current.set(option.value, element);
                  else optionRefs.current.delete(option.value);
                }}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onClick={() => selectOption(option)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm outline-none transition-colors ${
                  isSelected
                    ? isNight
                      ? "bg-violet-300/15 font-semibold text-violet-100"
                      : "bg-violet-100 font-semibold text-violet-900"
                    : isNight
                      ? "text-slate-300 hover:bg-white/[0.07] hover:text-white focus:bg-white/[0.07] focus:text-white"
                      : "text-stone-700 hover:bg-stone-100 hover:text-stone-950 focus:bg-stone-100 focus:text-stone-950"
                }`}
              >
                <span className="min-w-0 break-words">{option.label}</span>
                {isSelected && (
                  <Check
                    aria-hidden="true"
                    size={16}
                    className={`shrink-0 ${
                      isNight ? "text-violet-200" : "text-violet-700"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
