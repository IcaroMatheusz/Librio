import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Maximize,
} from "lucide-react";

import { useReaderTheme, type ReaderTheme } from "../../hooks/useReaderTheme";
import { ReaderThemeToggle } from "./ReaderThemeToggle";
import { ChapterSelector } from "./ChapterSelector";
import {
  ReaderModeToggle,
  type ReadingMode,
} from "./ReaderModeToggle";
import { ReaderTextSizeControls } from "./ReaderTextSizeControls";
import { getReaderScrollBehavior } from "./readerAccessibility";
import {
  extractEpub,
  type EpubContentNode,
  type EpubDocument,
} from "../../services/epubReaderService";
import { ReaderLoading } from "./ReaderLoading";

interface EpubReaderProps {
  file: Blob;
  fallbackTitle: string;
  initialProgress: number;
  onProgressChange: (progress: number) => Promise<void>;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";
const FONT_SIZE_STORAGE_KEY = "librio-reader-font-size";

function getStoredFontSize() {
  try {
    const storedSize = Number(
      window.localStorage.getItem(FONT_SIZE_STORAGE_KEY),
    );
    return storedSize >= 14 && storedSize <= 28 ? storedSize : 17;
  } catch {
    return 17;
  }
}

const CONTENT_CLASSES: Partial<Record<EpubContentNode["type"], string>> = {
  blockquote:
    "my-6 border-l-2 pl-4 italic",
  code: "rounded px-1.5 py-0.5 font-mono",
  dd: "ml-5 mt-1",
  dl: "my-5",
  dt: "mt-3 font-semibold",
  em: "italic",
  a: "underline underline-offset-2",
  figcaption: "mt-2 text-center text-[0.875em]",
  figure: "my-6 flex flex-col items-center",
  h1: "mb-6 mt-10 text-[1.8em] font-bold tracking-tight",
  h2: "mb-5 mt-9 text-[1.5em] font-bold tracking-tight",
  h3: "mb-4 mt-7 text-[1.25em] font-bold",
  h4: "mb-3 mt-6 text-[1.125em] font-bold",
  h5: "mb-3 mt-5 font-bold",
  h6: "mb-2 mt-4 font-bold",
  i: "italic",
  img: "mx-auto block h-auto max-h-full max-w-full break-inside-avoid-column rounded-lg object-contain",
  li: "my-1 pl-1",
  ol: "my-5 list-decimal space-y-1 pl-7",
  p: "my-5 whitespace-pre-wrap leading-[1.9]",
  pre: "my-5 overflow-x-auto rounded-xl p-4 font-mono text-[0.875em]",
  section: "my-4",
  small: "text-[0.875em]",
  strong: "font-bold",
  table: "my-6 w-full border-collapse text-left text-[0.875em]",
  td: "border px-3 py-2",
  th: "border px-3 py-2 font-semibold",
  tr: "border-b",
  ul: "my-5 list-disc space-y-1 pl-7",
};

const CONTENT_THEME_CLASSES: Record<
  ReaderTheme,
  Partial<Record<EpubContentNode["type"], string>>
> = {
  night: {
    blockquote: "border-violet-300/50 text-slate-300",
    code: "bg-black/20 text-violet-100",
    dd: "text-slate-300",
    dt: "text-slate-100",
    a: "text-violet-200 decoration-violet-200/30",
    figcaption: "text-slate-400",
    h1: "text-white",
    h2: "text-white",
    h3: "text-white",
    h4: "text-white",
    h5: "text-white",
    h6: "text-slate-200",
    li: "text-slate-200",
    ol: "marker:text-violet-200",
    p: "text-slate-200",
    pre: "bg-black/25 text-slate-200",
    small: "text-slate-400",
    strong: "text-white",
    td: "border-white/10 text-slate-200",
    th: "border-white/10 bg-white/[0.05] text-white",
    tr: "border-white/10",
    ul: "marker:text-violet-200",
  },
  light: {
    blockquote: "border-violet-500/40 text-stone-700",
    code: "bg-stone-200 text-violet-900",
    dd: "text-stone-700",
    dt: "text-stone-900",
    a: "text-violet-800 decoration-violet-500/40",
    figcaption: "text-stone-500",
    h1: "text-stone-950",
    h2: "text-stone-950",
    h3: "text-stone-950",
    h4: "text-stone-950",
    h5: "text-stone-950",
    h6: "text-stone-800",
    li: "text-stone-800",
    ol: "marker:text-violet-700",
    p: "text-stone-800",
    pre: "bg-stone-200 text-stone-800",
    small: "text-stone-500",
    strong: "text-stone-950",
    td: "border-stone-300 text-stone-800",
    th: "border-stone-300 bg-stone-200 text-stone-950",
    tr: "border-stone-300",
    ul: "marker:text-violet-700",
  },
};

function containsImage(node: EpubContentNode): boolean {
  return node.type === "img" || (node.children ?? []).some(containsImage);
}

function containsText(node: EpubContentNode): boolean {
  return Boolean(node.text?.trim()) || (node.children ?? []).some(containsText);
}

function renderContent(
  nodes: EpubContentNode[],
  theme: ReaderTheme,
  parentKey = "content",
  imagePageLayout = true,
): ReactNode {
  return nodes.map((node, index) => {
    const key = `${parentKey}-${index}`;
    const isImagePage =
      imagePageLayout &&
      node.type === "p" &&
      containsImage(node) &&
      !containsText(node);
    if (node.type === "img") {
      return node.src
        ? createElement("img", {
            key,
            src: node.src,
            alt: node.alt ?? "",
            className: `${CONTENT_CLASSES.img} transition-transform duration-300 ${
              theme === "light" ? "rounded-none sm:rounded-lg" : ""
            }`,
          })
        : null;
    }

    if (node.type === "br" || node.type === "hr") {
      return createElement(node.type, { key });
    }

    return createElement(
      node.type,
      {
        key,
        className: `${CONTENT_CLASSES[node.type] ?? ""} ${
          isImagePage
            ? "my-0 flex h-full break-inside-avoid-column items-center justify-center"
            : ""
        } ${
          CONTENT_THEME_CLASSES[theme][node.type] ?? ""
        }`,
      },
      node.text ?? renderContent(node.children ?? [], theme, key, imagePageLayout),
    );
  });
}

function getChapterPosition(progress: number, chapterCount: number) {
  const position = (Math.min(100, Math.max(0, progress)) / 100) * chapterCount;
  const index = Math.min(chapterCount - 1, Math.floor(position));
  return {
    index: Math.max(0, index),
    offset: progress >= 100 ? 1 : position - index,
  };
}

export function EpubReader({
  file,
  fallbackTitle,
  initialProgress,
  onProgressChange,
}: EpubReaderProps) {
  const readerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveRequestRef = useRef(0);
  const restoredOffsetRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef<number | null>(null);
  const chapterProgressRef = useRef(0);
  const restoreContentRef = useRef(false);
  const [book, setBook] = useState<EpubDocument | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [chapterProgress, setChapterProgress] = useState(0);
  const [readingMode, setReadingMode] = useState<ReadingMode>("page");
  const [pageWidth, setPageWidth] = useState(0);
  const [fontSize, setFontSize] = useState(getStoredFontSize);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { theme, setTheme } = useReaderTheme();

  useEffect(() => {
    try {
      window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(fontSize));
    } catch (error) {
      console.warn("Não foi possível salvar o tamanho do texto.", error);
    }
  }, [fontSize]);

  useEffect(() => {
    function syncFullscreen() {
      setIsFullscreen(document.fullscreenElement === readerRef.current);
    }

    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (!isFullscreen || document.fullscreenElement) return;
    function exitImmersiveMode(event: KeyboardEvent) {
      if (event.key === "Escape") setIsFullscreen(false);
    }
    window.addEventListener("keydown", exitImmersiveMode);
    return () => window.removeEventListener("keydown", exitImmersiveMode);
  }, [isFullscreen]);

  useEffect(() => {
    let active = true;
    let loadedBook: EpubDocument | null = null;

    void extractEpub(
      file,
      (completed, total) => {
        if (active && total > 0) {
          setLoadProgress(Math.round((completed / total) * 100));
        }
      },
      fallbackTitle,
    )
      .then((result) => {
        loadedBook = result;
        if (!active) {
          result.imageUrls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }
        const restoredPosition = getChapterPosition(
          initialProgress,
          result.chapters.length,
        );
        restoredOffsetRef.current = restoredPosition.offset;
        chapterProgressRef.current = restoredPosition.offset;
        restoreContentRef.current = true;
        setBook(result);
        setChapterIndex(restoredPosition.index);
        setChapterProgress(restoredPosition.offset);
        setLoading(false);
      })
      .catch((caughtError: unknown) => {
        if (!active) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível abrir este EPUB.",
        );
        setLoading(false);
      });

    return () => {
      active = false;
      loadedBook?.imageUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [fallbackTitle, file, initialProgress]);

  const handleScroll = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    if (readingMode === "vertical" && book) {
      const chapters = Array.from(
        content.querySelectorAll<HTMLElement>("[data-epub-chapter]"),
      );
      const viewport = content.getBoundingClientRect();
      const midpoint = viewport.top + content.clientHeight / 2;
      const activeChapter =
        chapters.find(
          (chapter) => chapter.getBoundingClientRect().bottom > midpoint,
        ) ?? chapters[chapters.length - 1];
      if (activeChapter) {
        const index = Number(activeChapter.dataset.epubChapter);
        const bounds = activeChapter.getBoundingClientRect();
        const progress = Math.min(
          1,
          Math.max(0, (midpoint - bounds.top) / bounds.height),
        );
        setChapterIndex(index);
        chapterProgressRef.current = progress;
        setChapterProgress(progress);
      }
      return;
    }

    const scrollRange = content.scrollWidth - content.clientWidth;
    const progress =
      scrollRange > 0 ? content.scrollLeft / scrollRange : 1;
    chapterProgressRef.current = progress;
    setChapterProgress(progress);
  }, [book, readingMode]);

  useEffect(() => {
    pendingOffsetRef.current = chapterProgressRef.current;
    restoreContentRef.current = true;
  }, [fontSize]);

  useEffect(() => {
    const content = contentRef.current;
    if (!book || !content || !restoreContentRef.current) return;

    restoreContentRef.current = false;
    const offset =
      pendingOffsetRef.current ??
      restoredOffsetRef.current ??
      chapterProgressRef.current;
    pendingOffsetRef.current = null;
    restoredOffsetRef.current = null;
    window.requestAnimationFrame(() => {
      if (readingMode === "page") {
        content.scrollLeft =
          (content.scrollWidth - content.clientWidth) * offset;
        content.scrollTop = 0;
      } else {
        const chapter = content.querySelector<HTMLElement>(
          `[data-epub-chapter="${chapterIndex}"]`,
        );
        if (chapter) {
          const chapterTop =
            content.scrollTop +
            chapter.getBoundingClientRect().top -
            content.getBoundingClientRect().top;
          content.scrollTop =
            chapterTop +
            offset * chapter.offsetHeight -
            content.clientHeight / 2;
        }
        content.scrollLeft = 0;
      }
      handleScroll();
    });
  }, [book, chapterIndex, fontSize, handleScroll, readingMode]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measurePageWidth = () => {
      const style = window.getComputedStyle(content);
      const horizontalPadding =
        Number.parseFloat(style.paddingLeft) +
        Number.parseFloat(style.paddingRight);
      setPageWidth(Math.max(160, content.clientWidth - horizontalPadding));
    };
    const observer = new ResizeObserver(() => {
      measurePageWidth();
    });
    observer.observe(content);
    measurePageWidth();
    return () => observer.disconnect();
  }, [book]);

  const currentProgress = book
    ? Math.min(
        100,
          Math.round(((chapterIndex + chapterProgress) / book.chapters.length) * 100),
      )
    : 0;

  useEffect(() => {
    if (!book) return;
    let active = true;
    const requestId = ++saveRequestRef.current;
    const timeoutId = window.setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .catch(() => {})
        .then(() => {
          if (!active || requestId !== saveRequestRef.current) return;
          setSaveStatus("saving");
          setSaveError(null);
          return onProgressChange(currentProgress);
        })
        .then(() => {
          if (active && requestId === saveRequestRef.current) {
            setSaveStatus("saved");
          }
        })
        .catch((caughtError: unknown) => {
          if (active && requestId === saveRequestRef.current) {
            setSaveError(
              caughtError instanceof Error
                ? caughtError.message
                : "Erro desconhecido ao sincronizar o progresso.",
            );
            setSaveStatus("error");
          }
        });
    }, 500);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [book, currentProgress, onProgressChange, saveAttempt]);

  const changeChapter = useCallback(
    (direction: number) => {
      if (!book) return;
      const nextIndex = Math.min(
        book.chapters.length - 1,
        Math.max(0, chapterIndex + direction),
      );
      if (nextIndex === chapterIndex) return;
      restoreContentRef.current = true;
      pendingOffsetRef.current = direction < 0 ? 1 : 0;
      chapterProgressRef.current = pendingOffsetRef.current;
      setChapterIndex(nextIndex);
      setChapterProgress(0);
    },
    [book, chapterIndex],
  );

  const turnPage = useCallback(
    (direction: number) => {
      const content = contentRef.current;
      if (!content || !book) return;
      const pageStep = pageWidth + 32;
      const maxScrollLeft = Math.max(0, content.scrollWidth - content.clientWidth);
      const currentScrollLeft = Math.max(
        0,
        Math.min(maxScrollLeft, content.scrollLeft),
      );
      if (direction > 0 && currentScrollLeft >= maxScrollLeft - 1) {
        changeChapter(1);
        return;
      }
      if (direction < 0 && currentScrollLeft <= 1) {
        changeChapter(-1);
        return;
      }
      content.scrollTo({
        left: Math.max(
          0,
          Math.min(maxScrollLeft, currentScrollLeft + direction * pageStep),
        ),
        behavior: getReaderScrollBehavior(),
      });
    },
    [book, changeChapter, pageWidth],
  );

  function changeReadingMode(mode: ReadingMode) {
    if (mode === readingMode) return;
    restoreContentRef.current = true;
    setReadingMode(mode);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (isFullscreen) {
      setIsFullscreen(false);
      return;
    }

    const reader = readerRef.current;
    if (!reader?.requestFullscreen) {
      setIsFullscreen(true);
      return;
    }
    void reader.requestFullscreen().catch(() => setIsFullscreen(true));
  }

  function handlePageClick(event: MouseEvent<HTMLDivElement>) {
    if (
      readingMode !== "page" ||
      event.button !== 0 ||
      !(event.target instanceof HTMLElement)
    ) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    turnPage(event.clientX >= bounds.left + bounds.width / 2 ? 1 : -1);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement &&
          event.target.closest("button, a, [contenteditable='true']"))
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        if (readingMode === "page") turnPage(-1);
        else changeChapter(-1);
      }
      if (event.key === "ArrowRight") {
        if (readingMode === "page") turnPage(1);
        else changeChapter(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeChapter, readingMode, turnPage]);

  if (loading) {
    return (
      <ReaderLoading
        title="Preparando seu EPUB"
        detail={`Organizando capítulos e ilustrações… ${loadProgress}%`}
        percent={loadProgress}
        theme={theme}
      />
    );
  }

  if (error || !book || book.chapters.length === 0) {
    return (
      <p
        role="alert"
        className={`m-auto max-w-lg p-8 text-center ${
          theme === "night" ? "text-rose-200" : "text-rose-800"
        }`}
      >
        {error ?? "Este EPUB não possui capítulos compatíveis para leitura."}
      </p>
    );
  }

  const currentChapter = book.chapters[chapterIndex];

  return (
    <section
      ref={readerRef}
      aria-label="Leitor de EPUB"
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-2xl shadow-black/25 sm:rounded-2xl ${
        theme === "night"
          ? "border-white/10 bg-[#151827]"
          : "border-stone-300 bg-[#fffaf0]"
      } ${
        isFullscreen
          ? "fixed inset-0 z-50 h-[100dvh] min-h-0 w-screen rounded-none border-0"
          : ""
      }`}
    >
      <header
        className={`relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 overflow-visible border-b px-2 py-2.5 backdrop-blur sm:px-5 ${
          theme === "night"
            ? "border-white/[0.08] bg-[#202435]/95"
            : "border-stone-300 bg-[#f2eadc]/95"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <BookOpen
            aria-hidden="true"
            size={18}
            className={`shrink-0 ${
              theme === "night" ? "text-violet-200" : "text-violet-700"
            }`}
          />
          <div className="min-w-0">
            <p
              className={`truncate text-sm font-bold ${
                theme === "night" ? "text-white" : "text-stone-900"
              }`}
            >
              {book.title}
            </p>
            <p
              className={`truncate text-xs ${
                theme === "night" ? "text-slate-400" : "text-stone-500"
              }`}
            >
              {currentChapter.title}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div
            role="group"
            aria-label="Navegação da leitura"
            className="flex items-center gap-1 sm:hidden"
          >
            <button
              type="button"
              onClick={() =>
                readingMode === "page" ? turnPage(-1) : changeChapter(-1)
              }
              disabled={chapterIndex === 0 && chapterProgress === 0}
              aria-label={
                readingMode === "page" ? "Página anterior" : "Capítulo anterior"
              }
              className={`inline-flex size-10 items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-40 ${
                theme === "night"
                  ? "text-slate-200 hover:bg-white/10"
                  : "text-stone-700 hover:bg-stone-200"
              }`}
            >
              <ArrowLeft aria-hidden="true" size={18} />
            </button>
            <button
              type="button"
              onClick={() =>
                readingMode === "page" ? turnPage(1) : changeChapter(1)
              }
              disabled={
                chapterIndex === book.chapters.length - 1 &&
                chapterProgress >= 1
              }
              aria-label={
                readingMode === "page" ? "Próxima página" : "Próximo capítulo"
              }
              className={`inline-flex size-10 items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-40 ${
                theme === "night"
                  ? "text-slate-200 hover:bg-white/10"
                  : "text-stone-700 hover:bg-stone-200"
              }`}
            >
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>
          <ReaderModeToggle
            mode={readingMode}
            onChange={changeReadingMode}
            theme={theme}
          />
          <ReaderThemeToggle theme={theme} onChange={setTheme} />
          <ReaderTextSizeControls
            fontSize={fontSize}
            theme={theme}
            onChange={setFontSize}
          />
          <ChapterSelector
            id="epub-chapter"
            label="Ir para capítulo"
            value={String(chapterIndex)}
            theme={theme}
            options={book.chapters.map((chapter, index) => ({
              value: String(index),
              label: `${index + 1}. ${chapter.title}`,
            }))}
            onChange={(value) => {
              pendingOffsetRef.current = 0;
              restoreContentRef.current = true;
              chapterProgressRef.current = 0;
              setChapterIndex(Number(value));
              setChapterProgress(0);
            }}
          />
        </div>
      </header>

      <div
        className={`grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] items-stretch gap-1 overflow-hidden p-2 sm:gap-3 sm:p-4 ${
          theme === "night"
            ? "bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.07),transparent_65%)]"
            : "bg-stone-200"
        } ${
          readingMode === "page"
            ? "grid-cols-1 sm:grid-cols-[2.75rem_minmax(0,1fr)_2.75rem]"
            : "grid-cols-1"
        }`}
      >
      {readingMode === "page" && (
      <button
          type="button"
          onClick={() =>
            readingMode === "page" ? turnPage(-1) : changeChapter(-1)
          }
          disabled={chapterIndex === 0 && chapterProgress === 0}
          aria-label={
            readingMode === "page" ? "Página anterior" : "Capítulo anterior"
          }
          className={`z-10 my-auto hidden size-10 items-center justify-center justify-self-center rounded-full border shadow-lg transition focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-30 sm:inline-flex ${
            theme === "night"
              ? "border-white/10 bg-[#202435]/90 text-slate-200 hover:border-violet-200/30 hover:bg-violet-300/15"
              : "border-stone-300 bg-white/90 text-stone-700 hover:border-violet-300 hover:bg-violet-100"
          }`}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        )}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          onClick={handlePageClick}
          role="region"
          tabIndex={0}
          aria-label={
            readingMode === "page"
              ? `Leitura: ${currentChapter.title}`
              : "Leitura contínua do EPUB"
          }
          className={`epub-page-viewport min-h-0 min-w-0 rounded-xl px-4 py-4 transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-violet-500 sm:px-8 sm:py-8 lg:px-14 ${
            readingMode === "page"
              ? "overflow-x-auto overflow-y-hidden"
              : "overflow-y-auto"
          } ${
            theme === "night"
              ? "bg-[#151827] text-slate-200"
              : "bg-[#fffaf0] text-stone-800 shadow-inner shadow-stone-900/5"
          }`}
          style={{ fontSize: `${fontSize}px` }}
        >
          {readingMode === "page" ? (
            <article
              className="h-full max-w-none font-serif leading-[1.85]"
              style={{
                height: "100%",
                fontSize: `${fontSize}px`,
                columnWidth: pageWidth ? `${pageWidth}px` : "auto",
                columnGap: "2rem",
                columnFill: "auto",
              }}
            >
              {renderContent(currentChapter.content, theme, currentChapter.id)}
            </article>
          ) : (
            <div className="mx-auto max-w-3xl space-y-12 font-serif leading-[1.85]">
              {book.chapters.map((chapter, index) => (
                <article
                  key={chapter.id}
                  data-epub-chapter={index}
                  aria-label={chapter.title}
                  className={`border-b pb-8 last:border-b-0 ${
                    theme === "night" ? "border-white/10" : "border-stone-300"
                  }`}
                >
                  {index > 0 && (
                    <h2
                      className={`mb-8 mt-4 text-center font-sans text-[1.125em] font-bold ${
                        theme === "night" ? "text-violet-200" : "text-violet-800"
                      }`}
                    >
                      {chapter.title}
                    </h2>
                  )}
                  {renderContent(chapter.content, theme, chapter.id, false)}
                </article>
              ))}
            </div>
          )}
        </div>
        {readingMode === "page" && (
        <button
          type="button"
          onClick={() =>
            readingMode === "page" ? turnPage(1) : changeChapter(1)
          }
          disabled={
            chapterIndex === book.chapters.length - 1 &&
            chapterProgress >= 1
          }
          aria-label={
            readingMode === "page" ? "Próxima página" : "Próximo capítulo"
          }
          className={`z-10 my-auto hidden size-10 items-center justify-center justify-self-center rounded-full border shadow-lg transition focus-visible:outline-2 focus-visible:outline-violet-500 disabled:opacity-30 sm:inline-flex ${
            theme === "night"
              ? "border-white/10 bg-[#202435]/90 text-slate-200 hover:border-violet-200/30 hover:bg-violet-300/15"
              : "border-stone-300 bg-white/90 text-stone-700 hover:border-violet-300 hover:bg-violet-100"
          }`}
        >
          <ArrowRight aria-hidden="true" size={18} />
        </button>
        )}
      </div>

      <footer
        className={`relative flex min-h-11 items-center justify-between gap-3 border-t px-3 text-xs sm:px-4 ${
          theme === "night"
            ? "border-white/[0.08] bg-[#202435]/70 text-slate-400"
            : "border-stone-300 bg-[#f2eadc] text-stone-600"
        }`}
      >
        <div
          role="progressbar"
          aria-label="Progresso de leitura do EPUB"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={currentProgress}
          className={`absolute inset-x-0 top-0 h-0.5 ${
            theme === "night" ? "bg-white/10" : "bg-stone-300"
          }`}
        >
          <span
            className={`block h-full transition-[width] duration-300 ${
              theme === "night" ? "bg-violet-300" : "bg-violet-700"
            }`}
            style={{ width: `${currentProgress}%` }}
          />
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 font-semibold ${
            theme === "night" ? "text-violet-100" : "text-violet-800"
          }`}
          aria-label={`${currentProgress}% do EPUB lido`}
        >
          <BookOpen
            aria-hidden="true"
            size={15}
            className={theme === "night" ? "text-violet-200" : "text-violet-700"}
          />
          {currentProgress}% <span className="hidden sm:inline">lido</span>
        </span>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Sair da tela cheia" : "Alternar tela cheia"}
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-violet-500 ${
            theme === "night"
              ? "text-slate-200 hover:bg-white/10"
              : "text-stone-700 hover:bg-stone-200"
          }`}
        >
          <Maximize aria-hidden="true" size={16} />
        </button>
        {saveStatus === "saving" && (
          <span role="status" className="inline-flex min-w-0 items-center gap-1.5">
            <LoaderCircle
              aria-hidden="true"
              size={14}
              className={`shrink-0 animate-spin ${
                theme === "night" ? "text-violet-200" : "text-violet-700"
              }`}
            />
            <span className="truncate">Salvando progresso…</span>
          </span>
        )}
        {saveStatus === "saved" && (
          <span role="status" className="inline-flex items-center gap-1.5">
            <CircleCheck
              aria-hidden="true"
              size={14}
              className={theme === "night" ? "text-emerald-300" : "text-emerald-700"}
            />
            Progresso salvo
          </span>
        )}
        {saveStatus === "error" && (
          <span
            className={`flex min-w-0 items-center gap-1.5 ${
              theme === "night" ? "text-rose-200" : "text-rose-800"
            }`}
          >
            <CircleAlert aria-hidden="true" size={14} className="shrink-0" />
            <span className="truncate" title={saveError ?? undefined}>
              {saveError ?? "Não foi possível sincronizar o progresso."}
            </span>
            <button
              type="button"
              onClick={() => setSaveAttempt((attempt) => attempt + 1)}
              className="shrink-0 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-violet-200"
            >
              Tentar novamente
            </button>
          </span>
        )}
      </footer>
    </section>
  );
}
