import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, BookOpen, ImagePlus, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../../contexts/useAuth";
import {
  deleteProfilePhoto,
  getProfile,
  getProfilePhotoUrl,
  updateAuthAccount,
  updateProfile,
  uploadProfilePhoto,
  type Profile,
} from "../../services/profileService";

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#171A27] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-4 focus:ring-violet-300/10";

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [email, setEmail] = useState(user?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        if (!user) return;
        const result = await getProfile(user.id);
        const photoUrl = await getProfilePhotoUrl(result.avatar_url);
        if (!active) return;

        setProfile(result);
        setUsername(result.username);
        setAvatarUrl(photoUrl);
        setEmail(user.email ?? "");
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

  useEffect(
    () => () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    },
    [photoPreviewUrl],
  );

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !profile) return;

    setError(null);
    setSuccess(null);
    setSavingProfile(true);
    let uploadedPath: string | null = null;

    try {
      let nextAvatarPath = profile.avatar_url;
      if (photo) {
        uploadedPath = await uploadProfilePhoto(user.id, photo);
        nextAvatarPath = uploadedPath;
      }

      try {
        await updateProfile(user.id, username.trim(), nextAvatarPath);
      } catch (caughtError) {
        if (uploadedPath) {
          try {
            await deleteProfilePhoto(uploadedPath);
          } catch (cleanupError) {
            const cleanupMessage =
              cleanupError instanceof Error
                ? cleanupError.message
                : "Não foi possível remover a foto enviada.";
            const saveMessage =
              caughtError instanceof Error
                ? caughtError.message
                : "Não foi possível salvar o perfil.";
            setError(`${saveMessage} ${cleanupMessage}`);
            return;
          }
        }
        throw caughtError;
      }

      const updatedProfile = {
        ...profile,
        username: username.trim(),
        avatar_url: nextAvatarPath,
      };
      setProfile(updatedProfile);
      setPhoto(null);
      setPhotoPreviewUrl(null);
      setSuccess("Seu nome e sua foto de perfil foram atualizados.");
      try {
        setAvatarUrl(await getProfilePhotoUrl(nextAvatarPath));
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Perfil atualizado, mas ${caughtError.message.toLowerCase()}`
            : "Perfil atualizado, mas não foi possível carregar a foto.",
        );
      }

      if (
        profile.avatar_url &&
        profile.avatar_url !== nextAvatarPath &&
        !profile.avatar_url.startsWith("http://") &&
        !profile.avatar_url.startsWith("https://")
      ) {
        try {
          await deleteProfilePhoto(profile.avatar_url);
        } catch (cleanupError) {
          setError(
            cleanupError instanceof Error
              ? `Perfil atualizado, mas ${cleanupError.message.toLowerCase()}`
              : "Perfil atualizado, mas não foi possível remover a foto anterior.",
          );
        }
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível salvar seu perfil.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const nextEmail = email.trim().toLowerCase();
    const changes: { email?: string; password?: string } = {};
    if (nextEmail && nextEmail !== user.email) changes.email = nextEmail;
    if (newPassword) changes.password = newPassword;

    if (!changes.email && !changes.password) {
      setAccountError("Informe um novo e-mail ou uma nova senha.");
      return;
    }
    if (changes.password && changes.password.length < 8) {
      setAccountError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setAccountError(null);
    setAccountSuccess(null);
    setSavingAccount(true);

    try {
      const result = await updateAuthAccount(changes);
      setNewPassword("");
      setAccountSuccess(
        result.emailConfirmationRequired
          ? "Alteração solicitada. Confirme o novo e-mail pelo link enviado para sua caixa de entrada."
          : "Os dados da sua conta foram atualizados.",
      );
    } catch (caughtError) {
      setAccountError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível atualizar sua conta.",
      );
    } finally {
      setSavingAccount(false);
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

      <div className="mx-auto max-w-3xl space-y-7 px-4 py-10 sm:px-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">
            Sua conta
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Editar perfil
          </h1>
          <p className="mt-2 text-slate-400">
            Atualize suas informações pessoais e de acesso.
          </p>
        </header>

        {loading ? (
          <p role="status" className="text-sm text-slate-300">
            Carregando perfil...
          </p>
        ) : error && !profile ? (
          <p role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-5 text-sm text-rose-200">
            {error}
          </p>
        ) : (
          <>
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <header className="mb-6">
                <h2 className="text-lg font-bold">Perfil público</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Nome e foto exibidos na sua conta.
                </p>
              </header>

              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-violet-300/10 text-violet-200">
                    {photoPreviewUrl || avatarUrl ? (
                      <img
                        src={photoPreviewUrl ?? avatarUrl ?? ""}
                        alt="Prévia da foto de perfil"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserRound aria-hidden="true" size={28} />
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="profile-photo"
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/5 focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-violet-200"
                    >
                      <ImagePlus aria-hidden="true" size={17} />
                      Escolher foto
                    </label>
                    <input
                      id="profile-photo"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="sr-only"
                      onChange={(event) => {
                        const selectedPhoto = event.target.files?.[0] ?? null;
                        setPhoto(selectedPhoto);
                        setPhotoPreviewUrl(
                          selectedPhoto
                            ? URL.createObjectURL(selectedPhoto)
                            : null,
                        );
                      }}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      PNG, JPG, WEBP ou GIF. Até 5 MB.
                    </p>
                  </div>
                </div>

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

                <footer className="flex justify-end border-t border-white/10 pt-5">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {savingProfile ? "Salvando..." : "Salvar perfil"}
                  </button>
                </footer>
              </form>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <header className="mb-6">
                <h2 className="text-lg font-bold">Dados de acesso</h2>
                <p className="mt-1 text-sm text-slate-400">
                  E-mail e senha da sua conta.
                </p>
              </header>

              <form onSubmit={handleAccountSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="account-email"
                    className="text-sm font-semibold text-slate-200"
                  >
                    E-mail
                  </label>
                  <input
                    id="account-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    A alteração pode exigir confirmação pelo novo endereço.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="account-password"
                    className="text-sm font-semibold text-slate-200"
                  >
                    Nova senha
                  </label>
                  <input
                    id="account-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Deixe em branco para manter a senha atual"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className={inputClass}
                  />
                </div>

                {accountError && (
                  <p role="alert" className="text-sm text-rose-200">
                    {accountError}
                  </p>
                )}
                {accountSuccess && (
                  <p role="status" className="text-sm text-emerald-200">
                    {accountSuccess}
                  </p>
                )}

                <footer className="flex justify-end border-t border-white/10 pt-5">
                  <button
                    type="submit"
                    disabled={savingAccount}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-400 px-5 py-3 text-sm font-bold text-[#1d1930] transition hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {savingAccount ? "Atualizando..." : "Atualizar acesso"}
                  </button>
                </footer>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
