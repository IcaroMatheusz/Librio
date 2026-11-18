import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Library,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
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
import { formatBytes } from "../../utils/formatBytes";

const inputWithIconClass =
  "w-full rounded-xl border border-white/10 bg-[#151824] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-4 focus:ring-violet-300/10 sm:text-base";

function formatMemberSince(isoDate: string | undefined): string | null {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function ProfilePage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [email, setEmail] = useState(user?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  function handleDiscardStagedPhoto() {
    setPhoto(null);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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

  const displayedPhoto = photoPreviewUrl ?? avatarUrl;
  const memberSince = formatMemberSince(profile?.created_at);
  const hasProfileChanges =
    Boolean(photo) ||
    (profile !== null && username.trim() !== profile.username);
  const emailChanged =
    Boolean(user?.email) &&
    email.trim().toLowerCase() !== "" &&
    email.trim().toLowerCase() !== user?.email?.toLowerCase();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#171A27] text-white">
      {/* Ambient background lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-36 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-violet-600/12 blur-3xl"
      />

      <header className="relative z-10 border-b border-white/[0.08] bg-[#171A27]/85 backdrop-blur-md">
        <nav
          aria-label="Navegação do perfil"
          className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8"
        >
          <Link
            to="/dashboard"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Voltar ao painel
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/library"
              className="hidden min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-violet-300/30 hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 sm:inline-flex"
            >
              <Library aria-hidden="true" size={15} className="text-violet-200" />
              Biblioteca
            </Link>
            <Link
              to="/dashboard"
              aria-label="Librio, painel inicial"
              className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
            >
              <BookOpen aria-hidden="true" className="text-violet-300" size={20} />
              Librio<span className="text-violet-300">.</span>
            </Link>
          </div>
        </nav>
      </header>

      <div className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 py-8 sm:space-y-8 sm:px-8 sm:py-10">
        {loading ? (
          <div role="status" className="space-y-6">
            <span className="sr-only">Carregando perfil...</span>
            <div className="h-44 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
              <div className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
            </div>
          </div>
        ) : error && !profile ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-5 text-sm text-rose-100"
          >
            <AlertCircle
              aria-hidden="true"
              size={20}
              className="mt-0.5 shrink-0 text-rose-300"
            />
            <div>
              <p className="font-bold">Não foi possível carregar seu perfil</p>
              <p className="mt-1 text-rose-200/90">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Profile Identity Hero Banner */}
            <section
              aria-labelledby="profile-page-title"
              className="relative isolate overflow-hidden rounded-[2rem] border border-violet-200/15 bg-gradient-to-br from-[#262042] via-[#1F1C34] to-[#1A1C2C] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_60px_-32px_rgba(124,58,237,0.55)] sm:p-8"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 opacity-20"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(221,214,254,0.45) 1px, transparent 1.5px)",
                  backgroundSize: "18px 18px",
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-fuchsia-500/15 blur-3xl"
              />

              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                  {/* Signature Gradient-Ring Avatar */}
                  <div className="relative shrink-0">
                    <div className="flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-300 via-violet-400 to-indigo-500 p-[3px] shadow-[0_0_28px_rgba(167,139,250,0.35)] sm:size-28">
                      <div className="flex size-full items-center justify-center overflow-hidden rounded-full border-[3px] border-[#1F1C34] bg-[#181629] text-violet-200">
                        {displayedPhoto ? (
                          <img
                            src={displayedPhoto}
                            alt="Prévia da foto de perfil"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <UserRound aria-hidden="true" size={40} />
                        )}
                      </div>
                    </div>

                    <label
                      htmlFor="profile-photo"
                      title="Alterar foto de perfil"
                      className="absolute -bottom-1 -right-1 flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-[#1F1C34] bg-violet-300 text-[#1D1632] shadow-lg transition hover:scale-105 hover:bg-violet-200 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white"
                    >
                      <Camera aria-hidden="true" size={16} />
                      <span className="sr-only">Escolher nova foto de perfil</span>
                    </label>
                  </div>

                  {/* Identity Text & Badges */}
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/20 bg-[#151225]/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-200">
                      <Sparkles aria-hidden="true" size={12} />
                      Configurações da conta
                    </span>

                    <h1
                      id="profile-page-title"
                      className="mt-2.5 truncate text-2xl font-black tracking-tight text-white sm:text-3xl"
                    >
                      {username.trim() || profile?.username || "Editar perfil"}
                    </h1>

                    <p className="mt-1 truncate text-sm text-slate-300">
                      {user?.email ?? "Personalize sua identidade e dados de acesso."}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {memberSince && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-medium text-slate-300">
                          <CalendarDays
                            aria-hidden="true"
                            size={13}
                            className="text-violet-300"
                          />
                          No Librio desde {memberSince}
                        </span>
                      )}

                      {hasProfileChanges && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                          Alterações pendentes no perfil
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Two-Column Forms Grid */}
            <div className="grid items-start gap-6 lg:grid-cols-12">
              {/* Public Profile Section */}
              <section
                aria-labelledby="public-profile-heading"
                className="rounded-3xl border border-white/10 bg-[#1E2233]/90 p-6 shadow-xl shadow-black/20 sm:p-8 lg:col-span-6"
              >
                <header className="mb-6 flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/10 text-violet-200"
                  >
                    <UserRound size={20} />
                  </span>
                  <div>
                    <h2
                      id="public-profile-heading"
                      className="text-lg font-bold text-white"
                    >
                      Perfil público
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-400">
                      Nome e foto exibidos no cabeçalho e na sua conta.
                    </p>
                  </div>
                </header>

                <form onSubmit={handleProfileSubmit} className="space-y-5">
                  {/* Photo Upload Panel */}
                  <div className="rounded-2xl border border-white/10 bg-[#151824]/80 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-violet-300/10 text-violet-200">
                          {displayedPhoto ? (
                            <img
                              src={displayedPhoto}
                              alt=""
                              aria-hidden="true"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserRound aria-hidden="true" size={24} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">
                            {photo
                              ? photo.name
                              : avatarUrl
                                ? "Foto de perfil atual"
                                : "Nenhuma foto enviada"}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {photo
                              ? `${formatBytes(photo.size)} · pronta para salvar`
                              : "PNG, JPG, WEBP ou GIF até 5 MB"}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <label
                          htmlFor="profile-photo"
                          className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-xs font-bold text-slate-100 transition hover:border-violet-300/35 hover:bg-white/10 focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-violet-200 sm:text-sm"
                        >
                          <ImagePlus aria-hidden="true" size={16} className="text-violet-200" />
                          {displayedPhoto ? "Trocar foto" : "Escolher foto"}
                        </label>
                        {photo && (
                          <button
                            type="button"
                            onClick={handleDiscardStagedPhoto}
                            aria-label="Descartar foto selecionada"
                            title="Descartar seleção"
                            className="inline-flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200"
                          >
                            <X aria-hidden="true" size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
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
                  </div>

                  {/* Username Input */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="profile-username"
                        className="text-sm font-semibold text-slate-200"
                      >
                        Nome de usuário
                      </label>
                      <span className="text-xs tabular-nums text-slate-400">
                        {username.length}/40
                      </span>
                    </div>
                    <div className="relative mt-2">
                      <UserRound
                        aria-hidden="true"
                        size={18}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        id="profile-username"
                        type="text"
                        autoComplete="nickname"
                        minLength={3}
                        maxLength={40}
                        required
                        placeholder="Como quer ser chamado"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        className={inputWithIconClass}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Entre 3 e 40 caracteres. Deve ser único no Librio.
                    </p>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
                    >
                      <AlertCircle
                        aria-hidden="true"
                        size={17}
                        className="mt-0.5 shrink-0 text-rose-300"
                      />
                      <span>{error}</span>
                    </div>
                  )}
                  {success && (
                    <div
                      role="status"
                      className="flex items-start gap-2.5 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
                    >
                      <CheckCircle2
                        aria-hidden="true"
                        size={17}
                        className="mt-0.5 shrink-0 text-emerald-300"
                      />
                      <span>{success}</span>
                    </div>
                  )}

                  <footer className="flex items-center justify-end border-t border-white/10 pt-5">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-300 px-5 py-3 text-sm font-extrabold text-[#1D1632] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
                    >
                      {savingProfile ? (
                        <>
                          <Loader2
                            aria-hidden="true"
                            size={16}
                            className="animate-spin"
                          />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Check aria-hidden="true" size={16} />
                          Salvar perfil
                        </>
                      )}
                    </button>
                  </footer>
                </form>
              </section>

              {/* Account Credentials & Security Section */}
              <section
                aria-labelledby="account-security-heading"
                className="rounded-3xl border border-white/10 bg-[#1E2233]/90 p-6 shadow-xl shadow-black/20 sm:p-8 lg:col-span-6"
              >
                <header className="mb-6 flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-300/10 text-violet-200"
                  >
                    <ShieldCheck size={20} />
                  </span>
                  <div>
                    <h2
                      id="account-security-heading"
                      className="text-lg font-bold text-white"
                    >
                      Dados de acesso
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-400">
                      Atualize o e-mail de login ou defina uma nova senha.
                    </p>
                  </div>
                </header>

                <form onSubmit={handleAccountSubmit} className="space-y-5">
                  {/* Email Field */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="account-email"
                        className="text-sm font-semibold text-slate-200"
                      >
                        E-mail
                      </label>
                      {emailChanged && (
                        <span className="text-xs font-semibold text-amber-200">
                          Requer confirmação
                        </span>
                      )}
                    </div>
                    <div className="relative mt-2">
                      <Mail
                        aria-hidden="true"
                        size={18}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        id="account-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className={inputWithIconClass}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Ao alterar o endereço, enviaremos um link de confirmação
                      para o novo e-mail.
                    </p>
                  </div>

                  {/* Password Field with Visibility Toggle */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="account-password"
                        className="text-sm font-semibold text-slate-200"
                      >
                        Nova senha
                      </label>
                      {newPassword.length > 0 && (
                        <span
                          className={`text-xs font-semibold ${
                            newPassword.length >= 8
                              ? "text-emerald-300"
                              : "text-amber-200"
                          }`}
                        >
                          {newPassword.length >= 8
                            ? "Tamanho válido"
                            : `${newPassword.length}/8 caracteres`}
                        </span>
                      )}
                    </div>
                    <div className="relative mt-2">
                      <KeyRound
                        aria-hidden="true"
                        size={18}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        id="account-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={8}
                        placeholder="Deixe em branco para manter a atual"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className={`${inputWithIconClass} pr-12`}
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Ocultar nova senha" : "Mostrar nova senha"
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-white focus-visible:outline-2 focus-visible:outline-violet-200"
                      >
                        {showPassword ? (
                          <EyeOff aria-hidden="true" size={18} />
                        ) : (
                          <Eye aria-hidden="true" size={18} />
                        )}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Use pelo menos 8 caracteres caso deseje redefinir sua senha.
                    </p>
                  </div>

                  {accountError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
                    >
                      <AlertCircle
                        aria-hidden="true"
                        size={17}
                        className="mt-0.5 shrink-0 text-rose-300"
                      />
                      <span>{accountError}</span>
                    </div>
                  )}
                  {accountSuccess && (
                    <div
                      role="status"
                      className="flex items-start gap-2.5 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
                    >
                      <CheckCircle2
                        aria-hidden="true"
                        size={17}
                        className="mt-0.5 shrink-0 text-emerald-300"
                      />
                      <span>{accountSuccess}</span>
                    </div>
                  )}

                  <footer className="flex items-center justify-end border-t border-white/10 pt-5">
                    <button
                      type="submit"
                      disabled={savingAccount}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-300 px-5 py-3 text-sm font-extrabold text-[#1D1632] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
                    >
                      {savingAccount ? (
                        <>
                          <Loader2
                            aria-hidden="true"
                            size={16}
                            className="animate-spin"
                          />
                          Atualizando...
                        </>
                      ) : (
                        <>
                          <ShieldCheck aria-hidden="true" size={16} />
                          Atualizar acesso
                        </>
                      )}
                    </button>
                  </footer>
                </form>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
