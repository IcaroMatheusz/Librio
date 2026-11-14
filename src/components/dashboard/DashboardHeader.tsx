import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Library,
  LogOut,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/useAuth";
import {
  getProfile,
  getProfilePhotoUrl,
  type Profile,
} from "../../services/profileService";

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const accountLabel =
    profile?.username ||
    (typeof user?.user_metadata.username === "string"
      ? user.user_metadata.username
      : "Minha conta");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!user) return;
      try {
        const currentProfile = await getProfile(user.id);
        const photoUrl = await getProfilePhotoUrl(currentProfile.avatar_url);
        if (active) {
          setProfile(currentProfile);
          setAvatarUrl(photoUrl);
          setProfileError(null);
        }
      } catch (caughtError) {
        if (!active) return;
        setProfile(null);
        setAvatarUrl(null);
        setProfileError(
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível carregar os dados do perfil.",
        );
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [user]);

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);

    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível encerrar sua sessão.",
      );
      setSigningOut(false);
    }
  }

  return (
    <header className="relative z-20 border-b border-white/10 bg-[#171A27]/95">
      <nav
        aria-label="Navegação principal"
        className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4 lg:px-12"
      >
        <Link
          to="/dashboard"
          aria-label="Librio, painel inicial"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 sm:gap-3"
        >
          <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-200">
            <BookOpen aria-hidden="true" size={21} />
          </span>
          <span className="text-xl font-extrabold tracking-tight">
            Librio<span className="text-violet-300">.</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/library"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-semibold text-slate-100 transition hover:border-violet-300/40 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 sm:h-14 sm:px-4"
          >
            <Library aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Biblioteca</span>
          </Link>

          <div className="relative flex items-center gap-3">
            <span className="max-w-28 truncate text-right text-sm font-semibold text-slate-100 sm:max-w-40 sm:text-base">
              {accountLabel}
            </span>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label={`Abrir menu da conta de ${accountLabel}`}
              onClick={() => setMenuOpen((open) => !open)}
              className="group relative flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-300 via-violet-400 to-indigo-500 p-[2px] shadow-[0_0_22px_rgba(167,139,250,0.3)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(196,181,253,0.55)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 sm:size-14"
            >
              <span className="flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-[#171A27] bg-[#211d32] text-violet-100">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound aria-hidden="true" size={25} />
                )}
              </span>
              <ChevronDown
                aria-hidden="true"
                size={15}
                className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#171A27] bg-[#31264a] text-violet-100 transition-transform ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {menuOpen && (
              <section
                aria-label="Opções da conta"
                className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#222638] p-1.5 shadow-xl shadow-black/30 sm:w-56"
              >
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-violet-200"
                >
                  <UserRound
                    aria-hidden="true"
                    size={17}
                    className="text-violet-200"
                  />
                  Editar perfil
                </Link>
                {profileError && (
                  <p
                    role="alert"
                    className="border-t border-white/10 px-3 py-2 text-xs leading-5 text-amber-200"
                  >
                    {profileError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-200 transition hover:bg-rose-400/10 focus-visible:outline-2 focus-visible:outline-rose-200 disabled:cursor-wait disabled:opacity-60"
                >
                  <LogOut aria-hidden="true" size={17} />
                  {signingOut ? "Saindo..." : "Sair"}
                </button>
                {error && (
                  <p
                    role="alert"
                    className="border-t border-white/10 px-3 py-2 text-xs leading-5 text-rose-200"
                  >
                    {error}
                  </p>
                )}
              </section>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
