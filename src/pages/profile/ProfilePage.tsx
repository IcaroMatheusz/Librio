import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, BookOpen, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../../contexts/useAuth";
import {
  getProfile,
  updateProfile,
  type Profile,
} from "../../services/profileService";

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#171A27] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-4 focus:ring-violet-300/10";

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        if (!user) return;
        const result = await getProfile(user.id);
        if (!active) return;

        setProfile(result);
        setUsername(result.username);
        setAvatarUrl(result.avatar_url ?? "");
      } catch (caughtError) {
        if (!active) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível carregar o perfil.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      await updateProfile(
        user.id,
        username.trim(),
        avatarUrl.trim() || null,
      );
      setSuccess("Seu perfil foi atualizado.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível salvar o perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#171A27] text-white">
      <header className="border-b border-white/10">
        <nav
          aria-label="Navegação do perfil"
          className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-8"
        >
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-200 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Voltar ao painel
          </Link>
          <Link
            to="/dashboard"
            aria-label="Librio, painel inicial"
            className="inline-flex items-center gap-2 text-lg font-extrabold"
          >
            <BookOpen aria-hidden="true" className="text-violet-200" size={20} />
            Librio<span className="text-violet-300">.</span>
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
        <header className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">
            Sua conta
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Editar perfil
          </h1>
          <p className="mt-2 text-slate-400">
            Atualize como seu perfil aparece no Librio.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          {loading ? (
            <p role="status" className="text-sm text-slate-300">
              Carregando perfil...
            </p>
          ) : error && !profile ? (
            <div>
              <p role="alert" className="text-sm text-rose-200">
                {error}
              </p>
              <Link
                to="/dashboard"
                className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
              >
                Voltar ao painel
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7 flex items-center gap-4">
                <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-violet-300/10 text-violet-200">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound aria-hidden="true" size={26} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {username || "Leitor"}
                  </p>
                  <p className="truncate text-sm text-slate-400">{user?.email}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="profile-username"
                    className="text-sm font-semibold text-slate-200"
                  >
                    Nome de usuário
                  </label>
                  <input
                    id="profile-username"
                    type="text"
                    autoComplete="nickname"
                    minLength={3}
                    maxLength={40}
                    required
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-avatar"
                    className="text-sm font-semibold text-slate-200"
                  >
                    URL da foto de perfil
                  </label>
                  <input
                    id="profile-avatar"
                    type="url"
                    placeholder="https://exemplo.com/foto.jpg"
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    className={inputClass}
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-rose-200">
                    {error}
                  </p>
                )}
                {success && (
                  <p role="status" className="text-sm text-emerald-200">
                    {success}
                  </p>
                )}

                <footer className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                  <Link
                    to="/dashboard"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
                  >
                    Cancelar
                  </Link>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </button>
                </footer>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
