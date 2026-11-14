import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthCard } from "../../components/AuthCard";
import { AuthInput } from "../../components/auth/AuthInput";
import { AuthPageLayout } from "../../components/auth/AuthPageLayout";
import { AuthPasswordField } from "../../components/auth/AuthPasswordField";
import { useAuth } from "../../contexts/useAuth";

export default function LoginPage() {
  const { signIn, initializationError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  return (
    <AuthPageLayout
      backgroundImage="https://wallpapers.com/images/featured/bakuman-b3xo0h0nws14tkcn.jpg"
      mobileBackgroundImage="https://i.pinimg.com/736x/06/d7/90/06d7904af054d44d74624cf2dcfd89cc.jpg"
    >
      <AuthCard
        title="Bem-vindo!"
        footer={
          <p className="text-sm text-neutral-600">
            Ainda não tem uma conta?{" "}
            <Link
              to="/register"
              className="font-bold text-[#2F3447] underline underline-offset-4 transition hover:text-[#59617F]"
            >
              Cadastre-se
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:gap-5">
          <AuthInput
            id="email"
            label="E-mail"
            type="email"
            placeholder="seuemail@exemplo.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <AuthPasswordField
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          <Link
            to="/forgot-password"
            className="w-fit text-sm font-semibold text-[#41475F] transition hover:text-[#222638] hover:underline"
          >
            Esqueceu sua senha?
          </Link>

          {(error || initializationError) && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {error || initializationError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#2F3447] px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-[#2F3447]/15 transition hover:-translate-y-0.5 hover:bg-[#414963] hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F3447] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar na minha conta"}
          </button>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}
