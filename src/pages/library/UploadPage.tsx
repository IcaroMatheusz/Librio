import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  BookOpen,
  BookUp,
  Check,
  Clipboard,
  ClipboardCheck,
  FileArchive,
  FileText,
  ImagePlus,
  LoaderCircle,
  SearchCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import sanjiSitting from "../../assets/sanjiwithchopper.png";
import { UploadResultModal } from "../../components/library/UploadResultModal";
import { useAuth } from "../../contexts/useAuth";
import { uploadBook } from "../../services/booksService";
import {
  getNativeBookFileInput,
  isNativeBookPickerPending,
  markNativeBookPickerBackgrounded,
  setNativeBookPickerPending,
  subscribeToNativeBookFilePicker,
  wasNativeBookPickerBackgrounded,
} from "../../services/nativeBookFilePicker";
import {
  createBookCoverPreview,
  prepareManualBookCover,
  type CoverPreviewProgress,
} from "../../services/coverPreviewService";

const inputClass =
  "mt-2 w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-[#171A27] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300 focus:ring-4 focus:ring-violet-300/10 disabled:cursor-not-allowed disabled:opacity-60";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

interface UploadResult {
  type: "success" | "error";
  message: string;
  coverUnavailable?: boolean;
  coverError?: string;
}

interface UploadDiagnostic {
  time: string;
  code: string;
  message: string;
  details?: string;
}

const UPLOAD_DIAGNOSTICS_KEY = "librio-upload-diagnostics-v1";
const MAX_UPLOAD_DIAGNOSTICS = 120;
const UPLOAD_DOCUMENT_INSTANCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function readUploadDiagnostics(): UploadDiagnostic[] {
  try {
    const saved = sessionStorage.getItem(UPLOAD_DIAGNOSTICS_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is UploadDiagnostic =>
            typeof item === "object" &&
            item !== null &&
            "time" in item &&
            typeof item.time === "string" &&
            "code" in item &&
            typeof item.code === "string" &&
            "message" in item &&
            typeof item.message === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function getFileDiagnostic(file: File) {
  return `extensão=${file.name.split(".").pop()?.toLowerCase() || "sem extensão"}; tamanho=${file.size} bytes; MIME=${file.type || "não informado"}`;
}

export default function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const bookFileInputRef = useRef<HTMLInputElement>(null);
  const diagnosticRecorderRef = useRef<(code: string, message: string, details?: string) => void>(() => {});
  const pickerPendingRef = useRef(false);
  const pickerBlurredRef = useRef(false);
  const pickerReturnTimerRef = useRef<number | null>(null);
  const currentStageRef = useRef("aguardando início");
  const uploadStartedAtRef = useRef(0);
  const uploadProgressRef = useRef<number | null>(null);
  const lastObservedProgressRef = useRef<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isBookFileDragging, setIsBookFileDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadElapsedSeconds, setUploadElapsedSeconds] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [coverPreparation, setCoverPreparation] = useState<{
    percent: number | null;
    stage: string;
  } | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [manualCoverFile, setManualCoverFile] = useState<File | null>(null);
  const [manualCoverUrl, setManualCoverUrl] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<UploadDiagnostic[]>(readUploadDiagnostics);
  const diagnosticsRef = useRef(diagnostics);
  const [pickerPending, setPickerPending] = useState(isNativeBookPickerPending);
  const [pickerStatus, setPickerStatus] = useState(() =>
    isNativeBookPickerPending() ? "Retomando o seletor de arquivos do dispositivo…" : "",
  );
  const [diagnosticCopyStatus, setDiagnosticCopyStatus] = useState("");

  const recordDiagnostic = useCallback((code: string, message: string, details?: string) => {
    const entry = { time: new Date().toISOString(), code, message, details };
    const next = [...diagnosticsRef.current, entry].slice(-MAX_UPLOAD_DIAGNOSTICS);
    diagnosticsRef.current = next;
    setDiagnostics(next);
    try {
      sessionStorage.setItem(UPLOAD_DIAGNOSTICS_KEY, JSON.stringify(next));
    } catch {
      // The upload remains usable when session storage is unavailable.
    }
  }, []);

  useEffect(() => {
    diagnosticRecorderRef.current = recordDiagnostic;
  }, [recordDiagnostic]);

  useEffect(() => {
    if (!uploading) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - uploadStartedAtRef.current) / 1000);
      setUploadElapsedSeconds(elapsed);
      if (uploadProgressRef.current === lastObservedProgressRef.current) {
        diagnosticRecorderRef.current(
          "UPLOAD_NO_PROGRESS",
          "A etapa atual continua sem mudança de progresso há pelo menos 15 segundos.",
          `etapa=${currentStageRef.current}; progresso=${uploadProgressRef.current ?? "indeterminado"}%; decorrido=${elapsed}s; online=${navigator.onLine}`,
        );
      }
      lastObservedProgressRef.current = uploadProgressRef.current;
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [uploading]);

  useEffect(() => {
    const browser = navigator as Navigator & {
      connection?: { effectiveType?: string };
      userAgentData?: { platform?: string };
    };
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    recordDiagnostic(
      "PAGE_READY",
      "Tela de envio pronta.",
      `documento=${UPLOAD_DOCUMENT_INSTANCE_ID}; navegação=${navigation?.type ?? "indisponível"}; online=${navigator.onLine}; conexão=${browser.connection?.effectiveType ?? "indisponível"}; plataforma=${browser.userAgentData?.platform ?? navigator.platform}; viewport=${window.innerWidth}x${window.innerHeight}; sessão=${user ? "ativa" : "ausente"}`,
    );
    // Log only safe browser metadata; never include tokens or signed URLs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handlePageHide = (event: PageTransitionEvent) => {
      recordDiagnostic("DOCUMENT_PAGEHIDE", "O navegador ocultou ou descarregou o documento.", `persisted=${event.persisted}; documento=${UPLOAD_DOCUMENT_INSTANCE_ID}`);
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      recordDiagnostic("DOCUMENT_PAGESHOW", "O navegador mostrou o documento.", `persisted=${event.persisted}; navegação=${navigation?.type ?? "indisponível"}; documento=${UPLOAD_DOCUMENT_INSTANCE_ID}`);
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [recordDiagnostic]);

  useEffect(() => {
    const browser = navigator as Navigator & {
      connection?: { effectiveType?: string };
    };
    const handleOnline = () => recordDiagnostic("NETWORK_ONLINE", "O navegador informou que voltou a ficar online.", `tipo=${browser.connection?.effectiveType ?? "indisponível"}`);
    const handleOffline = () => recordDiagnostic("NETWORK_OFFLINE", "O navegador informou que ficou offline.");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [recordDiagnostic]);

  useEffect(() => {
    if (!coverUrl) return;
    return () => URL.revokeObjectURL(coverUrl);
  }, [coverUrl]);

  useEffect(() => {
    if (!manualCoverUrl) return;
    return () => URL.revokeObjectURL(manualCoverUrl);
  }, [manualCoverUrl]);

  const handleFileChange = useCallback((selectedFile: File | null) => {
    if (!selectedFile) {
      recordDiagnostic(
        "FILE_EVENT_EMPTY",
        "O navegador notificou uma seleção sem entregar um arquivo.",
      );
      setPickerStatus("O navegador voltou sem entregar o arquivo. Tente novamente ou use outro app de arquivos.");
      setResult({
        type: "error",
        message:
          "O navegador não retornou o arquivo selecionado. Tente novamente e confirme a seleção no app de arquivos do dispositivo.",
      });
      return;
    }

    setResult(null);
    setCoverPreparation(null);
    setCoverUrl(null);
    setFile(null);
    setManualCoverFile(null);
    setManualCoverUrl(null);
    setPickerStatus("");

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    recordDiagnostic("FILE_RECEIVED", "Arquivo recebido pelo formulário.", getFileDiagnostic(selectedFile));
    if (!["pdf", "epub", "cbr", "cbz"].includes(extension ?? "")) {
      recordDiagnostic("VALIDATION_REJECTED_TYPE", "Arquivo recusado por formato não compatível.", getFileDiagnostic(selectedFile));
      setResult({
        type: "error",
        message:
          "Formato não compatível. Escolha um arquivo PDF, EPUB, CBR ou CBZ.",
      });
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      recordDiagnostic("VALIDATION_REJECTED_SIZE", "Arquivo recusado por exceder 100 MB.", getFileDiagnostic(selectedFile));
      setResult({
        type: "error",
        message: "O arquivo deve ter no máximo 100 MB.",
      });
      return;
    }
    if (selectedFile.size === 0) {
      recordDiagnostic("VALIDATION_REJECTED_EMPTY", "Arquivo recusado porque está vazio.", getFileDiagnostic(selectedFile));
      setResult({ type: "error", message: "O arquivo selecionado está vazio. Escolha outra cópia e tente novamente." });
      return;
    }

    setFile(selectedFile);
    recordDiagnostic("FILE_ACCEPTED", "Arquivo validado e pronto para envio.", getFileDiagnostic(selectedFile));
    setTitle((currentTitle) =>
      currentTitle || selectedFile.name.replace(/\.[^.]+$/, ""),
    );
  }, [recordDiagnostic]);

  useEffect(() => {
    // Keep the native input alive across UploadPage remounts while Android's
    // document picker is in the foreground.
    const input = getNativeBookFileInput();
    bookFileInputRef.current = input;
    const pendingAtMount = isNativeBookPickerPending();
    pickerPendingRef.current = pendingAtMount;
    pickerBlurredRef.current = pendingAtMount && wasNativeBookPickerBackgrounded();

    const handleNativePickerEvent = (event: {
      type: "input" | "change" | "cancel";
      file: File | null;
      filesCount: number;
    }) => {
      const eventCode = event.type === "input" ? "NATIVE_INPUT" : event.type === "change" ? "NATIVE_CHANGE" : "PICKER_CANCEL";
      const message = event.type === "cancel"
        ? "O seletor de arquivos foi cancelado pelo usuário."
        : event.type === "input"
          ? event.file
            ? "Evento input do seletor nativo entregou um arquivo."
            : "Evento input do seletor nativo sem arquivo."
          : event.file
            ? "Evento change do seletor nativo entregou um arquivo."
            : "Evento change do seletor nativo chegou sem arquivo.";
      diagnosticRecorderRef.current(
        eventCode,
        message,
        `files.length=${event.filesCount}${event.file ? `; ${getFileDiagnostic(event.file)}` : ""}`,
      );
      if (event.type === "input") return;

      pickerPendingRef.current = false;
      setPickerPending(false);
      setNativeBookPickerPending(false);
      pickerBlurredRef.current = false;
      if (pickerReturnTimerRef.current !== null) {
        window.clearTimeout(pickerReturnTimerRef.current);
        pickerReturnTimerRef.current = null;
      }
      if (event.type === "cancel") {
        setPickerStatus("Seleção cancelada. Nenhum arquivo foi enviado.");
        return;
      }
      if (!event.file) {
        setPickerStatus("O seletor voltou sem arquivo. Se você cancelou, pode escolher novamente quando quiser.");
        return;
      }
      setPickerStatus("");
      handleFileChange(event.file);
    };

    const handleWindowBlur = () => {
      if (isNativeBookPickerPending()) {
        pickerBlurredRef.current = true;
        markNativeBookPickerBackgrounded();
      }
    };
    const handleWindowFocus = () => {
      if (!isNativeBookPickerPending() || !pickerBlurredRef.current) return;
      pickerBlurredRef.current = false;
      if (pickerReturnTimerRef.current !== null) window.clearTimeout(pickerReturnTimerRef.current);
      pickerReturnTimerRef.current = window.setTimeout(() => {
        if (!isNativeBookPickerPending()) return;
        pickerPendingRef.current = false;
        setPickerPending(false);
        setNativeBookPickerPending(false);
        setPickerStatus("O seletor fechou sem retornar um arquivo. Tente novamente e aguarde a confirmação do app de arquivos.");
        diagnosticRecorderRef.current(
          "PICKER_RETURNED_EMPTY",
          "O navegador recuperou o foco, mas não recebeu arquivo nem evento change do seletor.",
          `online=${navigator.onLine}; visibility=${document.visibilityState}`,
        );
      }, 10_000);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isNativeBookPickerPending()) {
        pickerBlurredRef.current = true;
        markNativeBookPickerBackgrounded();
        diagnosticRecorderRef.current("PICKER_HIDDEN", "A página foi para segundo plano enquanto o seletor estava aberto.");
      } else if (document.visibilityState === "visible") {
        handleWindowFocus();
      }
    };

    const unsubscribeFromNativePicker = subscribeToNativeBookFilePicker(handleNativePickerEvent);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (pendingAtMount && wasNativeBookPickerBackgrounded() && document.visibilityState === "visible") {
      pickerBlurredRef.current = true;
      handleWindowFocus();
    } else if (pendingAtMount) {
      pickerReturnTimerRef.current = window.setTimeout(() => {
        if (!isNativeBookPickerPending()) return;
        const likelyBlocked = !pickerBlurredRef.current && document.visibilityState === "visible";
        setPickerStatus(
          likelyBlocked
            ? "O seletor ainda não respondeu. O navegador pode ter bloqueado a abertura; tente tocar novamente."
            : "O seletor ainda não retornou um arquivo. Aguarde ou cancele e tente novamente.",
        );
        diagnosticRecorderRef.current(
          "PICKER_TIMEOUT",
          "O seletor continuou pendente após a tela de envio ser retomada.",
          `visibility=${document.visibilityState}; online=${navigator.onLine}`,
        );
      }, 60_000);
    }
    recordDiagnostic(
      "UPLOAD_COMPONENT_MOUNT",
      "Tela de envio montada.",
      `documento=${UPLOAD_DOCUMENT_INSTANCE_ID}; seletorPendente=${pendingAtMount}; visibilidade=${document.visibilityState}`,
    );

    return () => {
      recordDiagnostic(
        "UPLOAD_COMPONENT_UNMOUNT",
        "Tela de envio desmontada.",
        `documento=${UPLOAD_DOCUMENT_INSTANCE_ID}; seletorPendente=${isNativeBookPickerPending()}; visibilidade=${document.visibilityState}`,
      );
      unsubscribeFromNativePicker();
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pickerReturnTimerRef.current !== null) window.clearTimeout(pickerReturnTimerRef.current);
      if (bookFileInputRef.current === input) bookFileInputRef.current = null;
    };
  }, [handleFileChange, recordDiagnostic]);

  function openBookFilePicker() {
    if (uploading) return;
    const input = bookFileInputRef.current;
    if (!input) {
      setResult({
        type: "error",
        message: "Não foi possível abrir o seletor. Recarregue a página e tente novamente.",
      });
      recordDiagnostic("PICKER_UNAVAILABLE", "O input nativo de arquivos não está disponível.");
      return;
    }
    if (pickerReturnTimerRef.current !== null) window.clearTimeout(pickerReturnTimerRef.current);
    input.value = "";
    pickerPendingRef.current = true;
    setNativeBookPickerPending(true);
    setPickerPending(true);
    pickerBlurredRef.current = false;
    setPickerStatus("Aguardando o seletor de arquivos do dispositivo…");
    setResult(null);
    recordDiagnostic(
      "PICKER_OPEN_REQUESTED",
      "Toque recebido; chamando o seletor nativo de arquivos.",
      `input conectado=${document.body.contains(input)}; protocolo=${location.protocol}`,
    );
    pickerReturnTimerRef.current = window.setTimeout(() => {
      if (!isNativeBookPickerPending()) return;
      const likelyBlocked = !pickerBlurredRef.current && document.visibilityState === "visible";
      setPickerStatus(
        likelyBlocked
          ? "O seletor ainda não respondeu. O navegador pode ter bloqueado a abertura; tente tocar novamente."
          : "O seletor ainda não retornou um arquivo. Aguarde ou cancele e tente novamente.",
      );
      diagnosticRecorderRef.current(
        "PICKER_TIMEOUT",
        likelyBlocked
          ? "O seletor não tirou a página de foco nem retornou evento em 60 segundos."
          : "O seletor permaneceu aberto sem retornar um arquivo por 60 segundos.",
        `visibility=${document.visibilityState}; online=${navigator.onLine}`,
      );
    }, 60_000);
    try {
      input.click();
    } catch (caughtError) {
      pickerPendingRef.current = false;
      setPickerPending(false);
      setNativeBookPickerPending(false);
      if (pickerReturnTimerRef.current !== null) window.clearTimeout(pickerReturnTimerRef.current);
      setPickerStatus("");
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      recordDiagnostic("PICKER_OPEN_FAILED", "O navegador lançou erro ao abrir o seletor.", message);
      setResult({ type: "error", message: `Não foi possível abrir o seletor de arquivos: ${message}` });
    }
  }

  function handleManualCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedCover = event.target.files?.[0] ?? null;
    setResult(null);
    setCoverPreparation(null);
    setManualCoverFile(null);
    setManualCoverUrl(null);
    if (!selectedCover) return;
    recordDiagnostic("COVER_RECEIVED", "Imagem de capa recebida.", `tamanho=${selectedCover.size} bytes; MIME=${selectedCover.type || "não informado"}`);
    if (!selectedCover.type.startsWith("image/")) {
      recordDiagnostic("COVER_REJECTED_TYPE", "Capa recusada por não ser imagem.", `MIME=${selectedCover.type || "não informado"}`);
      setResult({
        type: "error",
        message: "A capa precisa ser um arquivo de imagem.",
      });
      return;
    }
    if (selectedCover.size > 10 * 1024 * 1024) {
      recordDiagnostic("COVER_REJECTED_SIZE", "Capa recusada por exceder 10 MB.", `tamanho=${selectedCover.size} bytes`);
      setResult({
        type: "error",
        message: "A imagem da capa deve ter até 10 MB.",
      });
      return;
    }

    setManualCoverFile(selectedCover);
    setManualCoverUrl(URL.createObjectURL(selectedCover));
    recordDiagnostic("COVER_ACCEPTED", "Imagem de capa validada.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedFile = file ?? bookFileInputRef.current?.files?.[0] ?? null;
    const selectedTitle =
      title.trim() || selectedFile?.name.replace(/\.[^.]+$/, "").trim() || "";
    if (!user) {
      recordDiagnostic("VALIDATION_NO_SESSION", "Envio bloqueado: não há sessão autenticada.");
      setResult({
        type: "error",
        message: "Sua sessão expirou. Entre novamente antes de enviar a obra.",
      });
      return;
    }
    if (!selectedFile) {
      recordDiagnostic("VALIDATION_NO_FILE", "Envio bloqueado: nenhum arquivo selecionado.", `input.files=${bookFileInputRef.current?.files?.length ?? 0}`);
      setResult({
        type: "error",
        message: "Escolha um arquivo antes de enviar.",
      });
      return;
    }
    if (!selectedTitle) {
      recordDiagnostic("VALIDATION_NO_TITLE", "Envio bloqueado: título vazio.");
      setResult({
        type: "error",
        message: "Informe um título para a obra antes de enviar.",
      });
      return;
    }
    if (selectedTitle.length > 200) {
      recordDiagnostic("VALIDATION_TITLE_TOO_LONG", "Envio bloqueado: título excede 200 caracteres.", `caracteres=${selectedTitle.length}`);
      setResult({ type: "error", message: "O título deve ter no máximo 200 caracteres." });
      return;
    }
    if (selectedFile.size === 0 || selectedFile.size > MAX_FILE_SIZE) {
      const tooLarge = selectedFile.size > MAX_FILE_SIZE;
      recordDiagnostic(tooLarge ? "VALIDATION_FILE_TOO_LARGE" : "VALIDATION_EMPTY_FILE", tooLarge ? "Envio bloqueado: arquivo excede 100 MB." : "Envio bloqueado: arquivo vazio.", getFileDiagnostic(selectedFile));
      setResult({ type: "error", message: tooLarge ? "O arquivo deve ter no máximo 100 MB." : "O arquivo selecionado está vazio. Escolha outra cópia." });
      return;
    }
    if (!file) setFile(selectedFile);
    if (!title.trim()) setTitle(selectedTitle);

    setResult(null);
    setCoverUrl(null);
    setUploadProgress(null);
    uploadProgressRef.current = null;
    lastObservedProgressRef.current = null;
    uploadStartedAtRef.current = Date.now();
    setUploadElapsedSeconds(0);
    currentStageRef.current = "Preparando a capa";
    setUploadStage(
      manualCoverFile
        ? "Preparando a capa escolhida..."
        : "Preparando a prévia da capa...",
    );
    setUploading(true);
    recordDiagnostic("UPLOAD_STARTED", "Validações locais concluídas; iniciando preparação do envio.", `${getFileDiagnostic(selectedFile)}; título=${selectedTitle.length} caracteres; sessão=ativa; online=${navigator.onLine}`);

    let generatedCoverUrl: string | null = null;
    let coverPreview: Blob | undefined;
    let coverUnavailable = false;
    let coverError: string | undefined;
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    const canGenerateCover = ["pdf", "cbr", "cbz"].includes(extension ?? "");
    const onCoverProgress: CoverPreviewProgress = (percent, stage) => {
      currentStageRef.current = stage;
      setUploadStage(stage);
      setCoverPreparation({ percent, stage });
    };

    try {
      if (manualCoverFile) {
        recordDiagnostic("COVER_PREPARATION_STARTED", "Preparando a capa personalizada.");
        setCoverPreparation({
          percent: 5,
          stage: "Preparando a capa escolhida...",
        });
        coverPreview = await prepareManualBookCover(
          manualCoverFile,
          onCoverProgress,
        );
        generatedCoverUrl = URL.createObjectURL(coverPreview);
      } else if (canGenerateCover) {
        recordDiagnostic("COVER_PREPARATION_STARTED", "Gerando prévia da primeira página.", `tipo=${extension}`);
        setCoverPreparation({
          percent: 5,
          stage: "Lendo a primeira página para gerar a capa...",
        });
        try {
          const cover = await createBookCoverPreview(
            selectedFile,
            onCoverProgress,
          );
          coverPreview = cover;
          generatedCoverUrl = URL.createObjectURL(cover);
        } catch (caughtError) {
          coverUnavailable = true;
          coverError =
            caughtError instanceof Error
              ? caughtError.message
              : "Ocorreu um erro desconhecido ao gerar a capa.";
          recordDiagnostic("COVER_PREPARATION_FAILED", "Não foi possível gerar a prévia; o envio continuará sem capa.", coverError);
        }
      } else {
        coverUnavailable = true;
        coverError =
          "A geração automática da prévia ainda não é compatível com EPUB.";
        recordDiagnostic("COVER_NOT_SUPPORTED", "EPUB não gera prévia automática de capa.");
      }

      setCoverPreparation(null);
      setUploadStage("Enviando arquivo...");
      currentStageRef.current = "Enviando arquivo...";
      recordDiagnostic("UPLOAD_SERVICE_STARTED", "Preparação de armazenamento iniciada.");
      const uploadedBook = await uploadBook(
        user.id,
        selectedFile,
        selectedTitle,
        author,
        (progress) => {
          uploadProgressRef.current = progress;
          setUploadProgress(progress);
        },
        coverPreview,
        (stage, details) => {
          currentStageRef.current = details ?? stage;
          setUploadStage(currentStageRef.current);
          recordDiagnostic(`UPLOAD_${stage.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`, details ?? stage);
        },
      );
      if (uploadedBook.cover_url && generatedCoverUrl) {
        setCoverUrl(generatedCoverUrl);
        generatedCoverUrl = null;
      } else if (coverPreview) {
        coverUnavailable = true;
        coverError ??= "A capa não foi salva junto com a obra.";
      }
      setResult({
        type: "success",
        message: `${selectedTitle} foi adicionada à sua biblioteca.`,
        coverUnavailable,
        coverError,
      });
      recordDiagnostic("UPLOAD_SUCCEEDED", "Obra salva na biblioteca.", `tipo=${uploadedBook.file_type}; tamanho=${uploadedBook.file_size} bytes; capa=${Boolean(uploadedBook.cover_url)}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      recordDiagnostic("UPLOAD_FAILED", "O envio foi interrompido com erro.", `etapa=${currentStageRef.current}; mensagem=${message}; online=${navigator.onLine}`);
      setResult({
        type: "error",
        message,
      });
    } finally {
      if (generatedCoverUrl) URL.revokeObjectURL(generatedCoverUrl);
      setCoverPreparation(null);
      setUploading(false);
      setUploadStage("");
      currentStageRef.current = "aguardando início";
    }
  }

  async function copyUploadDiagnostics() {
    const browser = navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number };
      userAgentData?: { platform?: string };
    };
    const report = [
      "Librio · diagnóstico de upload",
      `Gerado: ${new Date().toISOString()}`,
      `Página: ${location.origin}${location.pathname}`,
      `Navegador: ${navigator.userAgent}`,
      `Plataforma: ${browser.userAgentData?.platform ?? navigator.platform}`,
      `Conexão: online=${navigator.onLine}; tipo=${browser.connection?.effectiveType ?? "indisponível"}; downlink=${browser.connection?.downlink ?? "indisponível"} Mbps`,
      `Tela: ${window.innerWidth}x${window.innerHeight}; DPR=${window.devicePixelRatio}; visibility=${document.visibilityState}`,
      `Sessão autenticada: ${Boolean(user)}`,
      `Arquivo atual: ${file ? getFileDiagnostic(file) : "nenhum"}`,
      `Etapa atual: ${currentStageRef.current}`,
      "Eventos recentes (mais antigos primeiro):",
      ...diagnostics.map((entry) =>
        `[${entry.time}] ${entry.code}: ${entry.message}${entry.details ? ` · ${entry.details}` : ""}`,
      ),
      "Tokens, URLs assinadas e conteúdo dos arquivos não são incluídos.",
    ].join("\n");

    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(report);
          copied = true;
        } catch {
          // Fall back for mobile browsers that expose Clipboard API but deny it.
        }
      }
      if (!copied) {
        const temporaryField = document.createElement("textarea");
        temporaryField.value = report;
        temporaryField.setAttribute("readonly", "");
        temporaryField.style.position = "fixed";
        temporaryField.style.opacity = "0";
        document.body.appendChild(temporaryField);
        temporaryField.select();
        copied = document.execCommand("copy");
        temporaryField.remove();
      }
      if (!copied) throw new Error("A área de transferência não está disponível neste navegador.");
      setDiagnosticCopyStatus("Diagnóstico copiado. Envie esse texto para análise.");
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
      setDiagnosticCopyStatus(`Não foi possível copiar: ${message}`);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#171A27] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-40 size-96 rounded-full bg-violet-700/10 blur-3xl"
      />
      <header className="relative border-b border-white/[0.07] bg-[#171A27]/80">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8 lg:px-12">
          <Link
            to="/library"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-300 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            Minha biblioteca
          </Link>
          <span className="inline-flex items-center gap-2 text-sm font-bold tracking-wide text-violet-100">
            <BookOpen aria-hidden="true" size={18} className="text-violet-300" />
            Librio
          </span>
        </nav>
      </header>

      <div className="relative mx-auto w-full min-w-0 max-w-6xl px-4 pb-12 pt-8 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12">
        <header className="mb-8 max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.07] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
            <Sparkles aria-hidden="true" size={14} />
            Sua próxima aventura
          </p>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Tem história nova{" "}
            <span className="text-violet-300">chegando!</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Guarde seus livros e quadrinhos favoritos num só lugar. Escolha um
            arquivo, dê os detalhes e prepare a leitura.
          </p>
        </header>

        <div className="grid w-full min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:gap-8">
          <section className="w-full min-w-0 rounded-3xl border border-white/[0.09] bg-[#202435]/90 p-5 shadow-2xl shadow-black/20 sm:p-7 lg:p-8">
            <header className="mb-6">
              <h2 className="text-lg font-bold text-white">Adicionar uma obra</h2>
              <p className="mt-1 text-sm text-slate-400">
                Os campos marcados são necessários para salvar na biblioteca.
              </p>
            </header>
            <form
              noValidate
              onSubmit={handleSubmit}
              className="w-full min-w-0 space-y-5"
            >
              <div>
                <label
                  htmlFor="book-file"
                  className="text-sm font-bold text-slate-200"
                >
                  Arquivo da obra
                </label>
                <div
                  role="button"
                  tabIndex={uploading ? -1 : 0}
                  aria-label={file ? `Arquivo selecionado: ${file.name}` : "Escolher arquivo da obra"}
                  aria-disabled={uploading}
                  onClick={openBookFilePicker}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openBookFilePicker();
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!uploading) setIsBookFileDragging(true);
                  }}
                  onDragLeave={(event) => {
                    const nextTarget = event.relatedTarget;
                    if (
                      nextTarget instanceof Node &&
                      event.currentTarget.contains(nextTarget)
                    ) {
                      return;
                    }
                    setIsBookFileDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsBookFileDragging(false);
                    if (uploading) return;
                    recordDiagnostic("FILE_DROP", "Arquivo recebido por arrastar e soltar.", `files=${event.dataTransfer.files?.length ?? 0}`);
                    handleFileChange(event.dataTransfer.files?.[0] ?? null);
                  }}
                  className={`group mt-2 flex min-h-36 w-full min-w-0 flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-5 text-center transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 ${
                    uploading
                      ? "cursor-not-allowed opacity-60"
                      : isBookFileDragging
                        ? "cursor-copy border-violet-300 bg-violet-300/[0.12] ring-4 ring-violet-300/10"
                        : file
                          ? "cursor-pointer border-violet-300/40 bg-violet-300/[0.07]"
                          : "cursor-pointer border-white/15 bg-[#171A27]/70 hover:border-violet-300/40 hover:bg-violet-300/[0.04]"
                  }`}
                >
                  <span className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
                    {file ? (
                      <Check aria-hidden="true" size={21} />
                    ) : (
                      <Upload aria-hidden="true" size={21} />
                    )}
                  </span>
                  <span className="max-w-full break-all text-sm font-bold text-slate-100">
                    {file ? file.name : "Escolha um arquivo"}
                  </span>
                  <span className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-violet-400 px-4 py-2 text-sm font-bold text-[#1d1930] transition group-hover:bg-violet-300">
                    {file ? "Trocar arquivo" : "Escolher arquivo"}
                  </span>
                  <span className="mt-2 text-xs text-slate-400">
                    {file
                      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · pronto para enviar`
                      : "PDF, EPUB, CBR ou CBZ · até 100 MB"}
                  </span>
                  {!file && (
                    <span className="mt-1 text-xs text-slate-500">
                      Clique ou toque para escolher; no computador, você também pode arrastar o arquivo até aqui.
                    </span>
                  )}
                </div>
                {pickerStatus && (
                  <p
                    role="status"
                    aria-live="polite"
                    className={`mt-2 flex items-center gap-2 text-sm ${pickerPending ? "text-violet-200" : "text-amber-200"}`}
                  >
                    {pickerPending && <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />}
                    {pickerStatus}
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-200">
                  Capa personalizada{" "}
                  <span className="font-normal text-slate-500">(opcional)</span>
                </p>
                <label
                  className={`relative mt-2 flex min-h-24 cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-[#171A27]/60 p-3 transition hover:border-violet-300/40 hover:bg-violet-300/[0.04] focus-within:ring-4 focus-within:ring-violet-300/10 ${
                    uploading ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  <input
                    id="manual-book-cover"
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={handleManualCoverChange}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  />
                  {manualCoverUrl ? (
                    <img
                      src={manualCoverUrl}
                      alt="Prévia da capa personalizada"
                      className="h-20 w-14 rounded-lg object-cover shadow-lg"
                    />
                  ) : (
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200">
                      <ImagePlus aria-hidden="true" size={22} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-100">
                      {manualCoverFile
                        ? manualCoverFile.name
                        : "Escolher uma imagem para a capa"}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">
                      {manualCoverFile
                        ? "A imagem será otimizada e enviada junto com a obra."
                        : "Opcional · JPG, PNG ou WEBP · até 10 MB"}
                    </span>
                  </span>
                </label>
              </div>

              {uploading && (
                <section
                  aria-label="Progresso do envio"
                  aria-live="polite"
                  className="w-full min-w-0 max-w-full rounded-2xl border border-violet-300/15 bg-violet-300/[0.05] p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <p className="flex min-w-0 items-center gap-2 font-semibold text-slate-100">
                      {uploadProgress === null ? <LoaderCircle aria-hidden="true" size={16} className="shrink-0 animate-spin text-violet-200" /> : <Check aria-hidden="true" size={16} className="shrink-0 text-violet-200" />}
                      <span className="truncate">{uploadStage}</span>
                    </p>
                    <p className="shrink-0 tabular-nums text-violet-200">
                      {uploadProgress === null
                        ? "Aguardando envio…"
                        : `${uploadProgress}%`}
                    </p>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Progresso do envio do arquivo"
                    aria-valuenow={uploadProgress ?? undefined}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuetext={
                      uploadProgress === null
                        ? uploadStage || "Preparando o envio"
                        : `${uploadProgress}% enviado`
                    }
                    className="h-2 overflow-hidden rounded-full bg-white/10"
                  >
                    <div
                      className={`h-full rounded-full bg-violet-400 transition-[width] duration-150 ${
                        uploadProgress === null
                          ? "w-2/5 animate-pulse"
                          : ""
                      }`}
                      style={
                        uploadProgress === null
                          ? undefined
                          : { width: `${uploadProgress}%` }
                      }
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Tempo decorrido: {Math.floor(uploadElapsedSeconds / 60)}m {uploadElapsedSeconds % 60}s
                    {uploadProgress === null
                      ? " · aguardando resposta desta etapa"
                      : uploadStage.toLowerCase().includes("enviando bytes")
                        ? " · transferência de bytes"
                        : " · bytes enviados, aguardando confirmação"}
                  </p>
                </section>
              )}

              <div>
                <label
                  htmlFor="book-title"
                  className="text-sm font-semibold text-slate-200"
                >
                  Título
                </label>
                <input
                  id="book-title"
                  type="text"
                  required
                  maxLength={200}
                  disabled={uploading}
                  value={title}
                  placeholder="Ex.: A aventura começa"
                  onChange={(event) => setTitle(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="book-author"
                  className="text-sm font-semibold text-slate-200"
                >
                  Autor
                </label>
                <input
                  id="book-author"
                  type="text"
                  maxLength={160}
                  disabled={uploading}
                  value={author}
                  placeholder="Nome do autor (opcional)"
                  onChange={(event) => setAuthor(event.target.value)}
                  className={inputClass}
                />
              </div>

              <footer className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <Link
                  to="/library"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-400 px-5 py-3 text-sm font-extrabold text-[#1d1930] shadow-lg shadow-violet-950/20 transition hover:-translate-y-0.5 hover:bg-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
                >
                  <BookUp aria-hidden="true" size={17} />
                  {uploading ? "Enviando..." : "Enviar obra"}
                </button>
              </footer>
            </form>
            <details className="mt-6 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#171A27]/45 p-4">
              <summary className="flex min-w-0 max-w-full cursor-pointer list-none flex-wrap items-center gap-2 text-sm font-bold text-slate-200 marker:hidden">
                <SearchCheck aria-hidden="true" size={18} className="text-violet-200" />
                <span className="min-w-0 flex-1 break-words">Diagnóstico do envio ({diagnostics.length} eventos)</span>
                <span className="ml-auto min-w-0 max-w-[45%] truncate whitespace-nowrap text-xs font-medium text-slate-400">
                  {diagnostics.at(-1)?.code ?? "sem eventos"}
                </span>
              </summary>
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs leading-5 text-slate-400">
                  O histórico identifica se o bloqueio acontece no seletor do celular, na validação, na capa, na autorização do Storage, na transferência ou ao salvar a obra. Nenhum token ou link assinado é incluído.
                </p>
                <button
                  type="button"
                  onClick={() => void copyUploadDiagnostics()}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-sm font-bold text-violet-100 transition hover:bg-violet-300/15"
                >
                  {diagnosticCopyStatus.startsWith("Diagnóstico copiado") ? <ClipboardCheck aria-hidden="true" size={16} /> : <Clipboard aria-hidden="true" size={16} />}
                  Copiar diagnóstico técnico
                </button>
                {diagnosticCopyStatus && <p role="status" className="mt-2 text-xs text-slate-300">{diagnosticCopyStatus}</p>}
                <ol className="mt-4 max-h-64 space-y-2 overflow-auto pr-1">
                  {diagnostics.slice(-20).map((entry) => (
                    <li key={`${entry.time}:${entry.code}`} className="rounded-xl bg-white/[0.035] p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-violet-200">{entry.code}</span>
                        <time className="text-slate-500">{new Date(entry.time).toLocaleTimeString()}</time>
                      </div>
                      <p className="mt-1 text-slate-200">{entry.message}</p>
                      {entry.details && <p className="mt-1 break-words text-slate-400">{entry.details}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          </section>

          <aside className="relative min-h-[300px] overflow-hidden rounded-3xl border border-violet-200/10 bg-gradient-to-br from-[#322b55] via-[#282442] to-[#1d2030] p-6 shadow-2xl shadow-black/20 sm:min-h-[350px] sm:p-8 lg:sticky lg:top-8 lg:min-h-[560px]">
            <div
              aria-hidden="true"
              className="absolute -right-14 -top-14 size-56 rounded-full bg-fuchsia-400/10 blur-3xl"
            />
            <div className="relative z-10 max-w-[62%] sm:max-w-[58%] lg:max-w-[65%]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-100">
                <Sparkles aria-hidden="true" size={12} />
                Clima de leitura
              </span>
              <h2 className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl">
                Um cantinho para cada aventura.
              </h2>
              <p className="mt-3 text-sm leading-6 text-violet-100/70">
                Sua coleção, suas regras. Deixe tudo pronto para a próxima
                página.
              </p>
            </div>
            <img
              src={sanjiSitting}
              alt="Sanji e Chopper"
              className="pointer-events-none absolute -bottom-5 -right-3 z-0 h-[78%] w-[52%] object-contain object-bottom drop-shadow-[0_16px_30px_rgba(0,0,0,0.35)] sm:-bottom-8 sm:right-0 sm:h-[88%] sm:w-[53%] lg:-bottom-8 lg:right-[-5%] lg:h-[86%] lg:w-[72%]"
            />
            <div className="absolute bottom-5 left-5 right-5 z-10 flex flex-wrap gap-2 sm:bottom-7 sm:left-8 sm:right-8">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#171A27]/55 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur">
                <FileText aria-hidden="true" size={14} className="text-rose-200" />
                PDF
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#171A27]/55 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur">
                <FileArchive aria-hidden="true" size={14} className="text-amber-200" />
                CBR / CBZ
              </span>
            </div>
          </aside>
        </div>
      </div>
      {coverPreparation && (
        <UploadResultModal
          type="progress"
          message="Estamos preparando a capa antes de enviar sua obra."
          progress={coverPreparation}
        />
      )}
      {result && (
        <UploadResultModal
          type={result.type}
          message={result.message}
          coverUrl={result.type === "success" ? coverUrl : null}
          coverError={result.coverError}
          coverUnavailable={
            result.type === "success" && result.coverUnavailable
          }
          onClose={() => {
            setResult(null);
            setCoverUrl(null);
          }}
          onLibraryClick={
            result.type === "success"
              ? () => {
                  setResult(null);
                  setCoverUrl(null);
                  navigate("/library", { replace: true });
                }
              : undefined
          }
        />
      )}
    </main>
  );
}
