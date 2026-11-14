import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthCard } from "../../components/AuthCard";
import { AuthInput } from "../../components/auth/AuthInput";
import { AuthPageLayout } from "../../components/auth/AuthPageLayout";
import { AuthPasswordField } from "../../components/auth/AuthPasswordField";
import { useAuth } from "../../contexts/useAuth";

export default function RegisterPage() {
  const { signUp, initializationError } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await signUp(
        username.trim(),
        email.trim().toLowerCase(),
        password,
      );

      if (result.requiresEmailConfirmation) {
        setSuccess(
          "Sua conta foi criada. Confira sua caixa de entrada e confirme o e-mail para entrar.",
        );
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível criar sua conta. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageLayout
      backgroundImage="https://images4.alphacoders.com/990/990502.jpg"
      mobileBackgroundImage="https://i.pinimg.com/736x/8a/4d/87/8a4d87e966c81336893c3acb825f2a11.jpg"
    >
      <AuthCard
        title="Crie sua conta"
        footer={
          <p className="text-sm text-neutral-600">
            Já tem uma conta?{" "}
            <Link
              to="/"
              className="font-bold text-[#2F3447] underline underline-offset-4 transition hover:text-[#59617F]"
            >
              Faça login
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:gap-5">
          <AuthInput
            id="username"
            label="Nome de usuário"
            placeholder="Digite seu nome de usuário"
            autoComplete="nickname"
            minLength={3}
            maxLength={40}
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setSuccess(null);
            }}
          />

          <AuthInput
            id="email"
            label="E-mail"
            type="email"
            placeholder="seuemail@exemplo.com"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSuccess(null);
            }}
          />

          <AuthPasswordField
            value={password}
            onChange={(value) => {
              setPassword(value);
              setSuccess(null);
            }}
            autoComplete="new-password"
            minLength={8}
          />

          {success && (
            <p
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
            >
              {success}
            </p>
          )}

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
            disabled={loading || Boolean(success)}
            className="mt-1 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#2F3447] px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-[#2F3447]/15 transition hover:-translate-y-0.5 hover:bg-[#414963] hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2F3447] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {success
              ? "Cadastro concluído"
              : loading
                ? "Registrando..."
                : "Criar minha conta"}
          </button>
        </form>
      </AuthCard>
    </AuthPageLayout>
  );
}
