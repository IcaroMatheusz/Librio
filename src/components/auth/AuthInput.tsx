import type { ChangeEventHandler, InputHTMLAttributes } from "react";

interface AuthInputProps {
  id: string;
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  type?: InputHTMLAttributes<HTMLInputElement>["type"];
  placeholder: string;
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}

const inputClass =
  "w-full rounded-xl border border-neutral-300/70 bg-white px-4 py-3 text-base text-neutral-900 outline-none transition-all duration-200 placeholder:text-neutral-400 focus:border-[#2F3447] focus:ring-4 focus:ring-[#2F3447]/10 md:py-3.5";

export function AuthInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  minLength,
  maxLength,
  required = true,
}: AuthInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold text-[#292D3C]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        required={required}
        value={value}
        onChange={onChange}
        className={inputClass}
      />
    </div>
  );
}
