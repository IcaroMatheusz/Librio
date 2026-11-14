
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, BookOpen } from "lucide-react";

type Credentials = {
  username: string;
  password: string;
};

type LoginScreenProps = {
  backgroundImage?: string;
  mobileBackgroundImage?: string;
  onSubmit?: (
    credentials: Credentials
  ) => Promise<void> | void;
};

export default function LoginScreen({
  backgroundImage = "https://wallpapers.com/images/featured/bakuman-b3xo0h0nws14tkcn.jpg",
  mobileBackgroundImage = "https://i.pinimg.com/1200x/bd/96/9e/bd969e7a3a7552a5740a73386f261c4a.jpg",
  onSubmit,
}: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!username.trim() || !password) {
      setError("Preencha seu email e sua senha para continuar.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await onSubmit?.({
        username: username.trim(),
        password,
      });
    } catch {
      setError("Email ou senha inválidos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = `
    w-full rounded-xl border border-neutral-300/70
    bg-white px-4 py-3.5 text-base text-neutral-900
    placeholder:text-neutral-400
    outline-none transition-all duration-200
    focus:border-[#2F3447]
    focus:ring-4 focus:ring-[#2F3447]/10
  `;

  return (
    <main className="
      relative grid min-h-screen min-h-dvh
      overflow-hidden bg-[#2F3447]
      lg:grid-cols-[46%_54%]
    ">

      {/* FORMULÁRIO */}
      <section className="
        relative isolate flex min-h-screen min-h-dvh
        flex-col items-center justify-center
        overflow-hidden px-5 py-8 sm:px-8 lg:px-12
      ">

        {/* BACKGROUND MOBILE */}
        <div
          className="
            absolute inset-0 -z-20
            bg-cover bg-center bg-no-repeat
            lg:hidden
          "
          style={{
            backgroundImage: `url("${mobileBackgroundImage}")`,
          }}
        />

        {/* OVERLAY MOBILE */}
        <div className="
          absolute inset-0 -z-10 lg:hidden
          bg-gradient-to-b
          from-[#171A27]/55
          via-[#2F3447]/75
          to-[#2F3447]/95
        "/>

        {/* LOGO MOBILE */}
        <div className="
          relative z-10 mb-8 flex items-center
          gap-3 text-white lg:hidden
        ">
          <div className="
            flex h-12 w-12 items-center justify-center
            rounded-2xl border border-white/20
            bg-white/10 backdrop-blur-md
          ">
            <BookOpen size={26} />
          </div>

          <span className="text-3xl font-extrabold tracking-tight">
            Librio
          </span>
        </div>

        {/* CARD DE LOGIN */}
        <div className="
          relative z-10 w-full max-w-md
          rounded-[28px] border border-white/40
          bg-[#F4F4F5] p-6 shadow-2xl
          sm:p-10 lg:p-11
        ">

          {/* CABEÇALHO */}
          <header className="mb-3">
            <h1 className="
              text-4xl font-extrabold tracking-tight
              text-[#202330] sm:text-5xl
            ">
              Bem-vindo!
            </h1>
          </header>

          {/* FORMULÁRIO */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-5"
          >

            {/* EMAIL */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="username"
                className="text-sm font-bold text-[#292D3C]"
              >
                Email
              </label>

              <input
                id="username"
                type="email"
                placeholder="seuemail@exemplo.com"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* SENHA */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="password"
                className="text-sm font-bold text-[#292D3C]"
              >
                Senha
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-14`}
                />

                <button
                  type="button"
                  aria-label={
                    showPassword ? "Ocultar senha" : "Mostrar senha"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                  className="
                    absolute inset-y-0 right-0
                    flex w-12 items-center justify-center
                    text-neutral-500 transition
                    hover:text-[#2F3447]
                  "
                >
                  {showPassword
                    ? <EyeOff size={20} />
                    : <Eye size={20} />
                  }
                </button>
              </div>

              {/* RECUPERAR SENHA */}
              <a
                href="/forgot-password"
                className="
                  mt-1 w-fit text-sm font-semibold
                  text-[#41475F] transition
                  hover:text-[#222638] hover:underline
                "
              >
                Esqueceu sua senha?
              </a>
            </div>

            {/* ERRO */}
            {error && (
              <p
                role="alert"
                aria-live="polite"
                className="
                  rounded-xl border border-red-200
                  bg-red-50 px-4 py-3
                  text-sm font-medium text-red-700
                "
              >
                {error}
              </p>
            )}

            {/* BOTÃO DE LOGIN */}
            <button
              type="submit"
              disabled={loading}
              className="
                mt-2 flex w-full items-center
                justify-center rounded-xl
                bg-[#2F3447] px-6 py-4
                text-base font-bold text-white
                shadow-lg shadow-[#2F3447]/15
                transition-all duration-200
                hover:-translate-y-0.5 hover:bg-[#414963]
                hover:shadow-xl
                active:translate-y-0
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {loading ? "Entrando..." : "Entrar na minha conta"}
            </button>

          </form>

          {/* CADASTRO */}
          <div className="
            mt-8 border-t border-neutral-200
            pt-6 text-center
          ">
            <p className="text-sm text-neutral-600">
              Ainda não tem uma conta?{" "}

              <a
                href="/register"
                className="
                  font-bold text-[#2F3447]
                  underline underline-offset-4
                  transition hover:text-[#59617F]
                "
              >
                Cadastre-se
              </a>
            </p>
          </div>

        </div>

        {/* RODAPÉ */}
        <p className="
          relative z-10 mt-8 text-center text-xs
          tracking-wide text-white/70
        ">
          Librio © 2026 — Sua próxima leitura começa aqui.
        </p>

      </section>

      {/* PAINEL DESKTOP */}
      <aside
        className="
          relative hidden overflow-hidden
          bg-cover bg-center lg:flex
        "
        style={{
          backgroundImage: `url("${backgroundImage}")`,
        }}
      >

        {/* OVERLAY DESKTOP */}
        <div className="
          absolute inset-0
          bg-gradient-to-r
          from-[#171A27]/80
          via-[#171A27]/50
          to-[#171A27]/20
        "/>

        {/* CONTEÚDO DESKTOP */}
        <div className="
          relative z-10 flex w-full flex-col
          justify-end p-12 text-white
          xl:p-20
        ">

          <div className="
            mb-5 flex h-16 w-16 items-center
            justify-center rounded-2xl
            border border-white/20
            bg-white/10 backdrop-blur-md
          ">
            <BookOpen size={34} />
          </div>

          <h2 className="
            max-w-xl text-6xl font-extrabold
            tracking-tight xl:text-7xl
          ">
            Librio<span className="text-indigo-300">.</span>
          </h2>

          <p className="
            mt-4 max-w-md text-lg leading-relaxed
            text-white/85 xl:text-xl
          ">
            Seus livros, seus quadrinhos,
            suas histórias. Tudo em um só lugar.
          </p>

          <div className="
            mt-10 h-1 w-20 rounded-full
            bg-indigo-300
          "/>

        </div>
      </aside>

    </main>
  );
}
