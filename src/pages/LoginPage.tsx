import { useState, type FormEvent } from "react";

type Credentials = {
  username: string;
  password: string;
};

type LoginScreenProps = {
  /** Caminho da imagem de fundo (coloque o arquivo em public/images/) */
  backgroundImage?: string;
  /** Quem usa a tela decide o que fazer com as credenciais. Lance um erro para exibir a mensagem. */
  onSubmit?: (credentials: Credentials) => Promise<void> | void;
};

const fontClass = "font-['Alegreya_Sans',ui-sans-serif,system-ui,sans-serif]";

const inputClass =
  "w-full rounded-xl bg-[#DADADA] px-4 py-3.5 text-lg text-neutral-900 " +
  "outline-none ring-2 ring-transparent transition " +
  "focus:bg-white focus:ring-[#2F3447]/60";

export default function LoginScreen({
  backgroundImage = "https://wallpapers.com/images/featured/bakuman-b3xo0h0nws14tkcn.jpg",
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
      setError("Fill in both fields to continue.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await onSubmit?.({ username: username.trim(), password });
    } catch {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className={`grid min-h-screen grid-cols-1 bg-[#2F3447] lg:grid-cols-[44%_1fr] ${fontClass}`}
    >
      {/* Lado A: formulário */}
      <section className="flex flex-col items-center justify-center gap-6 p-6">
        {/* Marca só no mobile, já que a arte some */}
        <p className="text-3xl font-extrabold tracking-wide text-white lg:hidden">
          Librio
        </p>

        <div className="w-full max-w-md rounded-[28px] bg-[#ECEDEF] p-10 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
          <h2 className="mb-6 text-6xl font-bold text-neutral-950">Login</h2>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-5"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-xl font-semibold text-neutral-900"
              >
                Email:
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xl font-semibold text-neutral-900"
              >
                Senha:
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 text-sm font-semibold text-neutral-600 hover:text-neutral-950"
                >
                  {showPassword ? "Esconder" : "Mostrar a Senha"}
                </button>
              </div>
              <a
                href="/forgot-password"
                className="w-fit text-sm font-semibold text-neutral-800 hover:underline"
              >
                Esqueceu a senha?
              </a>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mx-auto mt-1 rounded-xl bg-[#2F3447] px-12 py-3 text-xl font-bold text-white transition hover:bg-[#3C4260] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm font-semibold text-neutral-900">
            Não tem um login?{" "}
            <a
              href="/register"
              className="underline underline-offset-2 hover:text-[#2F3447]"
            >
              Venha aqui!
            </a>
          </p>
        </div>
      </section>

      {/* Lado B: arte */}
      <aside
        className="relative hidden items-center overflow-hidden bg-cover bg-center lg:flex"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        {/* "Óculos de sol" na imagem para o texto branco ficar legível */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />

        <div className="relative z-10 px-16 text-white drop-shadow-lg">
          <h1 className="flex items-baseline gap-4 font-extrabold leading-none">
            <span className="text-7xl tracking-tight xl:text-8xl">
              Librio
            </span>
          </h1>
          <p className="mt-2 text-lg font-semibold tracking-wide text-white/90">
            Upload and read your comics or books.
          </p>
        </div>
      </aside>
    </main>
  );
}
