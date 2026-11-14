import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, BookOpen } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/useAuth";

const PHRASES = [
  "Seus livros.",
  "Seus quadrinhos.",
  "Seus mangás.",
  "Suas histórias.",
];

export default function LoginScreen() {
  const { signIn, initializationError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const backgroundImage =
    "https://wallpapers.com/images/featured/bakuman-b3xo0h0nws14tkcn.jpg";
  const mobileBackgroundImage =
    "https://i.pinimg.com/736x/06/d7/90/06d7904af054d44d74624cf2dcfd89cc.jpg";

  // Troca a frase do painel desktop a cada 3s (parado se o usuário pediu menos movimento)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, 3000);

    return () => clearInterval(id);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError("Preencha seu email e sua senha para continuar.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await signIn(email.trim().toLowerCase(), password);
      navigate("/dashboard", { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  // text-base (16px) nos inputs evita o zoom automático do Safari no iPhone
  const inputClass = `
    w-full rounded-xl border border-neutral-300/70
    bg-white px-4 py-3 text-base text-neutral-900 md:py-3.5
    placeholder:text-neutral-400
    outline-none transition-all duration-200
    focus:border-[#2F3447]
    focus:ring-4 focus:ring-[#2F3447]/10
  `;

  return (
    <main
      className="
      relative grid min-h-screen min-h-dvh
      overflow-hidden bg-[#2F3447]
      lg:grid-cols-[46%_54%]
    "
    >
      {/* FORMULÁRIO */}
      <section
        className="
        relative isolate flex min-h-screen min-h-dvh
        flex-col items-center justify-center
        overflow-hidden px-6 py-6 sm:px-8 sm:py-10 lg:px-8 xl:px-12
      "
      >
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
        <div
          className="
          absolute inset-0 -z-10 lg:hidden
          bg-gradient-to-b
          from-[#171A27]/55
          via-[#2F3447]/75
          to-[#2F3447]/95
        "
        />

        {/* BRILHOS DESKTOP (luz de palco atrás do card) */}
        <div
          aria-hidden
          className="
            pointer-events-none absolute -z-10 hidden lg:block
            left-[6%] top-[10%] h-72 w-72 rounded-full
            bg-indigo-500/25 blur-3xl anim-glow
          "
        />
        <div
          aria-hidden
          className="
            pointer-events-none absolute -z-10 hidden lg:block
            bottom-[6%] right-[4%] h-80 w-80 rounded-full
            bg-purple-500/20 blur-3xl anim-glow
          "
          style={{ animationDelay: "-3s" }}
        />

        {/* LOGO MOBILE / TABLET */}
        <div
          className="
          relative z-10 mb-5 flex items-center
          gap-3 text-white md:mb-8 lg:hidden
        "
        >
          <div
            className="
            flex h-10 w-10 items-center justify-center
            rounded-2xl border border-white/20
            bg-white/10 backdrop-blur-md
            md:h-14 md:w-14
          "
          >
            <BookOpen className="h-5 w-5 md:h-7 md:w-7" />
          </div>

          <span className="text-2xl font-extrabold tracking-tight md:text-4xl">
            Librio
          </span>
        </div>

        {/* CARD DE LOGIN */}
        <div
          className="
          anim-fade-up relative z-10 w-full
          max-w-sm sm:max-w-md md:max-w-lg lg:max-w-md
          rounded-3xl border border-white/60 md:rounded-[28px]
          bg-gradient-to-br from-[#FAF8FF] to-[#E9E1F5]
          p-5 ring-1 ring-black/5
          shadow-[0_30px_70px_-15px_rgba(10,8,25,0.65)]
          sm:p-8 md:p-10 lg:p-9 xl:p-11
        "
        >
          {/* CABEÇALHO */}
          <header className="mb-4 md:mb-5">
            <h1
              className="
              text-3xl font-extrabold tracking-tight
              text-[#202330] sm:text-4xl md:text-5xl
              lg:text-4xl xl:text-5xl
            "
            >
              Bem-vindo!
            </h1>
          </header>

          {/* FORMULÁRIO */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 md:gap-5"
          >
            {/* EMAIL */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="text-sm font-bold text-[#292D3C]"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                placeholder="seuemail@exemplo.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-14`}
                />

                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                  className="
                    absolute inset-y-0 right-0
                    flex w-12 items-center justify-center
                    text-neutral-500 transition
                    hover:text-[#2F3447]
                  "
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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
            {(error || initializationError) && (
              <p
                role="alert"
                className="
                  rounded-xl border border-red-200
                  bg-red-50 px-4 py-3
                  text-sm font-medium text-red-700
                "
              >
                {error || initializationError}
              </p>
            )}

            {/* BOTÃO DE LOGIN */}
            <button
              type="submit"
              disabled={loading}
              className="
                mt-1 flex w-full items-center md:mt-2
                justify-center rounded-xl
                bg-[#2F3447] px-6 py-3.5 md:py-4
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
          <div
            className="
            mt-6 border-t border-[#2F3447]/10
            pt-5 text-center md:mt-8 md:pt-6
          "
          >
            <p className="text-sm text-neutral-600">
              Ainda não tem uma conta?{" "}
              <Link
                to="/register"
                className="
                  font-bold text-[#2F3447]
                  underline underline-offset-4
                  transition hover:text-[#59617F]
                "
              >
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>

        {/* RODAPÉ */}
        <p
          className="
          relative z-10 mt-6 text-center text-xs
          tracking-wide text-white/70 md:mt-8 md:text-sm
        "
        >
          Librio © 2026 — Sua próxima leitura começa aqui.
        </p>
      </section>

      {/* PAINEL DESKTOP */}
      <aside className="relative hidden overflow-hidden lg:flex">
        {/* IMAGEM COM ZOOM LENTO (div própria: só a imagem se move) */}
        <div
          className="absolute inset-0 bg-cover bg-center anim-kenburns"
          style={{
            backgroundImage: `url("${backgroundImage}")`,
          }}
        />

        {/* OVERLAY DESKTOP */}
        <div
          className="
          absolute inset-0
          bg-gradient-to-r
          from-[#171A27]/80
          via-[#171A27]/50
          to-[#171A27]/20
        "
        />

        {/* CONTEÚDO DESKTOP */}
        <div
          className="
          relative z-10 flex w-full flex-col
          justify-end p-10 text-white
          xl:p-20
        "
        >
          {/* ÍCONE FLUTUANTE */}
          <div className="anim-fade-up" style={{ animationDelay: "150ms" }}>
            <div className="relative mb-5 w-fit anim-float">
              <div
                aria-hidden
                className="absolute -inset-5 rounded-full bg-indigo-400/40 blur-2xl anim-glow"
              />
              <div
                className="
                relative flex h-16 w-16 items-center
                justify-center rounded-2xl
                border border-white/20
                bg-white/10 backdrop-blur-md
              "
              >
                <BookOpen size={34} />
              </div>
            </div>
          </div>

          <h2
            className="
              anim-fade-up max-w-xl text-6xl font-extrabold
              tracking-tight xl:text-7xl
            "
            style={{ animationDelay: "300ms" }}
          >
            Librio<span className="text-indigo-300">.</span>
          </h2>

          {/* FRASE ROTATIVA */}
          <div
            className="anim-fade-up mt-4 max-w-md"
            style={{ animationDelay: "450ms" }}
          >
            {/* Versão estática para leitores de tela */}
            <p className="sr-only">
              Seus livros, seus quadrinhos, suas histórias. Tudo em um só lugar.
            </p>

            <p
              aria-hidden
              className="text-3xl font-bold leading-snug xl:text-4xl"
            >
              {/* key muda -> React recria o span -> animação reinicia */}
              <span
                key={PHRASES[phraseIndex]}
                className="anim-word inline-block text-indigo-300"
              >
                {PHRASES[phraseIndex]}
              </span>
            </p>

            <p aria-hidden className="mt-1 text-lg text-white/85 xl:text-xl">
              Tudo em um só lugar.
            </p>
          </div>

          <div
            className="anim-bar mt-10 h-1 w-20 rounded-full bg-indigo-300"
            style={{ animationDelay: "700ms" }}
          />
        </div>
      </aside>
    </main>
  );
}
