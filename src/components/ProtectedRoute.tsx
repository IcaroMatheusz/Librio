import { Link, Navigate, Outlet } from "react-router-dom";

import { Loading } from "./Loading";
import { useAuth } from "../contexts/useAuth";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, initializationError } = useAuth();

  if (isLoading) return <Loading />;

  if (initializationError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#171A27] px-4 py-12 text-white">
        <section className="max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-2xl font-bold">Não foi possível validar sua sessão</h1>
          <p role="alert" className="mt-3 text-sm leading-6 text-slate-300">
            {initializationError}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-500 px-5 py-3 font-semibold text-white transition hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            Voltar ao login
          </Link>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
