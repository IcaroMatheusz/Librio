import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface AuthPasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
}

export function AuthPasswordField({
  value,
  onChange,
  autoComplete,
  minLength,
}: AuthPasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="password" className="text-sm font-bold text-[#292D3C]">
        Senha
      </label>
      <div className="relative">
        <input
          id="password"
          type={isVisible ? "text" : "password"}
          placeholder="Digite sua senha"
          autoComplete={autoComplete}
          minLength={minLength}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-neutral-300/70 bg-white px-4 py-3 pr-14 text-base text-neutral-900 outline-none transition-all duration-200 placeholder:text-neutral-400 focus:border-[#2F3447] focus:ring-4 focus:ring-[#2F3447]/10 md:py-3.5"
        />
        <button
          type="button"
          aria-label={isVisible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((visible) => !visible)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-neutral-500 transition hover:text-[#2F3447] focus-visible:outline-2 focus-visible:outline-[#2F3447]"
        >
          {isVisible ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
        </button>
      </div>
    </div>
  );
}
