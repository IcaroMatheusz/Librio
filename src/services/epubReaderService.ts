import {
  BlobReader,
  BlobWriter,
  TextWriter,
  ZipReader,
  type FileEntry,
} from "@zip.js/zip.js";

const MAX_EPUB_ENTRIES = 2000;
const MAX_EPUB_UNCOMPRESSED_BYTES = 300 * 1024 * 1024;
const MAX_EPUB_IMAGE_BYTES = 20 * 1024 * 1024;
const EPUB_IMAGE_EXTENSIONS = /\.(avif|gif|jpe?g|png|webp)$/i;
const SAFE_TAGS = new Set<EpubTag>([
  "blockquote",
  "a",
  "br",
  "code",
  "dd",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

export type EpubTag =
  | "blockquote"
  | "br"
  | "code"
  | "dd"
  | "a"
  | "div"
  | "dl"
  | "dt"
  | "em"
  | "figcaption"
  | "figure"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "hr"
  | "i"
  | "img"
  | "li"
  | "ol"
  | "p"
  | "pre"
  | "section"
  | "small"
  | "span"
  | "strong"
  | "sub"
  | "sup"
  | "table"
  | "tbody"
  | "td"
  | "th"
  | "thead"
  | "tr"
  | "u"
  | "ul";

export interface EpubContentNode {
  type: EpubTag;
  text?: string;
  src?: string;
  alt?: string;
  children?: EpubContentNode[];
}

export interface EpubChapter {
  id: string;
  title: string;
  content: EpubContentNode[];
}

export interface EpubDocument {
  title: string;
  chapters: EpubChapter[];
  imageUrls: string[];
}

export type EpubProgress = (completed: number, total: number) => void;

function parseXml(source: string, label: string): Document {
  const parsed = new DOMParser().parseFromString(source, "application/xml");
  if (parsed.querySelector("parsererror")) {
    throw new Error(`O arquivo EPUB contém XML inválido em ${label}.`);
  }
  return parsed;
}

function normalizeArchivePath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join("/");
}

function resolveArchivePath(basePath: string, href: string): string | null {
  if (!href || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("//")) {
    return null;
  }
  let cleanHref: string;
  try {
    cleanHref = decodeURIComponent(href.split(/[?#]/, 1)[0] ?? "");
  } catch {
    return null;
  }
  const joined = cleanHref.startsWith("/")
    ? cleanHref.slice(1)
    : `${basePath ? `${basePath}/` : ""}${cleanHref}`;
  const normalized = normalizeArchivePath(joined);
  return normalized.startsWith("../") ? null : normalized;
}

function elementChildren(element: Element, localName: string): Element[] {
  return Array.from(element.children).filter(
    (child) => child.localName.toLowerCase() === localName,
  );
}

function safeTitle(content: string, fallback: string): string {
  const title = content.replace(/\s+/g, " ").trim();
  return title.slice(0, 180) || fallback;
}

function isOutlineDocument(root: Element, headingText: string): boolean {
  const links = root.querySelectorAll("a");
  if (links.length < 3) return false;

  const normalizedHeading = headingText.replace(/\s+/g, " ").trim();
  if (
    /^(document outline|table of contents|contents|sumário|índice)$/i.test(
      normalizedHeading,
    )
  ) {
    return true;
  }

  const text = (root.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!/^document\s*outline(?:\s*ch\s*\d|\s|$)/i.test(text)) return false;

  const originalSizeEntries = text.match(/\[\s*original\s+size\s*\]/gi) ?? [];
  const chapterEntries = text.match(/\bch\s*\d+/gi) ?? [];
  return originalSizeEntries.length >= 3 || chapterEntries.length >= 3;
}

function getImageSource(element: Element): string | null {
  return [
    element.getAttribute("src"),
    element.getAttribute("data-src"),
    element.getAttribute("href"),
    element.getAttributeNS("http://www.w3.org/1999/xlink", "href"),
  ].find((source) => source?.trim()) ?? null;
}

async function toSafeImage(
  source: string | null,
  alt: string,
  chapterPath: string,
  entries: Map<string, FileEntry>,
  imageUrlsByPath: Map<string, string>,
  allImageUrls: Set<string>,
): Promise<EpubContentNode[]> {
  const path = source
    ? resolveArchivePath(chapterPath.split("/").slice(0, -1).join("/"), source)
    : null;
  const imageEntry = path ? entries.get(path) : undefined;
  if (
    !path ||
    !imageEntry ||
    !EPUB_IMAGE_EXTENSIONS.test(path) ||
    (imageEntry.uncompressedSize ?? 0) > MAX_EPUB_IMAGE_BYTES
  ) {
    return [];
  }

  let url = imageUrlsByPath.get(path);
  if (!url) {
    const imageBlob = await imageEntry.getData(new BlobWriter());
    url = URL.createObjectURL(imageBlob);
    imageUrlsByPath.set(path, url);
    allImageUrls.add(url);
  }
  return [{ type: "img", src: url, alt }];
}

async function toSafeContent(
  node: Node,
  chapterPath: string,
  entries: Map<string, FileEntry>,
  imageUrlsByPath: Map<string, string>,
  allImageUrls: Set<string>,
): Promise<EpubContentNode[]> {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    return text ? [{ type: "span", text }] : [];
  }
  if (!(node instanceof Element)) return [];

  const tagName = node.localName.toLowerCase();
  const epubType =
    node.getAttributeNS("http://www.idpf.org/2007/ops", "type") ??
    node.getAttribute("epub:type") ??
    "";
  if (
    ["script", "style", "noscript", "iframe", "object", "form", "nav"].includes(
      tagName,
    ) ||
    node.getAttribute("role") === "navigation" ||
    /(^|\s)(toc|doc-toc|landmarks|page-list)(\s|$)/i.test(epubType)
  ) {
    return [];
  }

  if (tagName === "svg") {
    const svgImage = node.getElementsByTagNameNS("*", "image")[0];
    if (!svgImage) return [];
    return toSafeImage(
      getImageSource(svgImage),
      "Capa do livro",
      chapterPath,
      entries,
      imageUrlsByPath,
      allImageUrls,
    );
  }

  if (tagName === "img") {
    return toSafeImage(
      getImageSource(node),
      node.getAttribute("alt") ?? "",
      chapterPath,
      entries,
      imageUrlsByPath,
      allImageUrls,
    );
  }

  const safeTag = SAFE_TAGS.has(tagName as EpubTag)
    ? (tagName as EpubTag)
    : "span";
  const children = (
    await Promise.all(
      Array.from(node.childNodes).map((child) =>
        toSafeContent(child, chapterPath, entries, imageUrlsByPath, allImageUrls),
      ),
    )
  ).flat();

  return [{ type: safeTag, children }];
}

async function readEntryText(entry: FileEntry): Promise<string> {
  return entry.getData(new TextWriter());
}

export async function extractEpub(
  archive: Blob,
  onProgress?: EpubProgress,
  fallbackTitle?: string,
): Promise<EpubDocument> {
  const reader = new ZipReader(new BlobReader(archive));
  const imageUrls = new Set<string>();

  try {
    const zipEntries = await reader.getEntries();
    if (zipEntries.length > MAX_EPUB_ENTRIES) {
      throw new Error("Este EPUB contém itens demais para abrir no leitor.");
    }
    const entries = new Map(
      zipEntries
        .filter((entry): entry is FileEntry => entry.directory === false)
        .map((entry) => [normalizeArchivePath(entry.filename), entry]),
    );
    const totalUncompressedBytes = zipEntries.reduce(
      (sum, entry) => sum + (entry.uncompressedSize ?? 0),
      0,
    );
    if (totalUncompressedBytes > MAX_EPUB_UNCOMPRESSED_BYTES) {
      throw new Error("O conteúdo descompactado do EPUB excede 300 MB.");
    }

    const containerEntry = entries.get("META-INF/container.xml");
    if (!containerEntry) {
      throw new Error("Este arquivo não contém a estrutura de um EPUB válido.");
    }
    const container = parseXml(
      await readEntryText(containerEntry),
      "META-INF/container.xml",
    );
    const rootfile = container.getElementsByTagNameNS("*", "rootfile")[0];
    const packagePath = rootfile?.getAttribute("full-path");
    if (!packagePath) {
      throw new Error("Não foi possível localizar o pacote principal do EPUB.");
    }

    const normalizedPackagePath = normalizeArchivePath(packagePath);
    const packageEntry = entries.get(normalizedPackagePath);
    if (!packageEntry) {
      throw new Error("O pacote principal do EPUB está ausente.");
    }
    const packageDocument = parseXml(
      await readEntryText(packageEntry),
      normalizedPackagePath,
    );
    const packageRoot = packageDocument.documentElement;
    const packageDirectory = normalizedPackagePath.split("/").slice(0, -1).join("/");
    const manifestElement = elementChildren(packageRoot, "manifest")[0];
    const spineElement = elementChildren(packageRoot, "spine")[0];
    if (!manifestElement || !spineElement) {
      throw new Error("O EPUB não contém um manifesto ou sumário de leitura.");
    }

    const manifest = new Map<
      string,
      { path: string; mediaType: string; properties: string }
    >();
    for (const item of elementChildren(manifestElement, "item")) {
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      if (!id || !href) continue;
      const path = resolveArchivePath(packageDirectory, href);
      if (path) {
        manifest.set(id, {
          path,
          mediaType: item.getAttribute("media-type") ?? "",
          properties: item.getAttribute("properties") ?? "",
        });
      }
    }

    const spineItems = elementChildren(spineElement, "itemref")
      .map((item) => manifest.get(item.getAttribute("idref") ?? ""))
      .filter(
        (
          item,
        ): item is {
          path: string;
          mediaType: string;
          properties: string;
        } =>
          item !== undefined &&
          /xhtml|html/i.test(item.mediaType) &&
          !item.properties.split(/\s+/).includes("nav"),
      );
    if (spineItems.length === 0 || spineItems.length > 1000) {
      throw new Error("Este EPUB não possui capítulos compatíveis para leitura.");
    }

    const imageUrlsByPath = new Map<string, string>();
    const chapters: EpubChapter[] = [];
    const packageTitle =
      packageDocument.getElementsByTagNameNS("*", "title")[0]?.textContent ?? "";
    for (const [index, item] of spineItems.entries()) {
      const entry = entries.get(item.path);
      if (!entry) {
        throw new Error(`Um capítulo do EPUB está ausente: ${item.path}`);
      }
      const chapterMarkup = await readEntryText(entry);
      const chapterDocument = new DOMParser().parseFromString(
        chapterMarkup,
        "application/xhtml+xml",
      );
      const parserError = chapterDocument.querySelector("parsererror");
      const contentDocument = parserError
        ? new DOMParser().parseFromString(chapterMarkup, "text/html")
        : chapterDocument;
      const contentRoot =
        contentDocument.body ?? contentDocument.documentElement;
      const heading = contentRoot.querySelector("h1, h2, h3, title");
      const headingText = heading?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (isOutlineDocument(contentRoot, headingText)) {
        onProgress?.(index + 1, spineItems.length);
        continue;
      }
      const generatedTitle =
        item.path.split("/").pop()?.replace(/\.[^.]+$/, "") ??
        `Capítulo ${index + 1}`;
      const content = (
        await Promise.all(
          Array.from(contentRoot.childNodes).map((node) =>
            toSafeContent(
              node,
              item.path,
              entries,
              imageUrlsByPath,
              imageUrls,
            ),
          ),
        )
      ).flat();
      const chapterTitle = /^(cover|front cover)$/i.test(headingText)
        ? "Capa"
        : /^(index|untitled)$/i.test(headingText)
          ? `Capítulo ${index + 1}`
          : headingText || `Capítulo ${index + 1}`;

      chapters.push({
        id: item.path,
        title: safeTitle(chapterTitle, generatedTitle),
        content,
      });
      onProgress?.(index + 1, spineItems.length);
    }

    if (chapters.length === 0) {
      throw new Error("Este EPUB contém apenas sumários, sem capítulos de leitura.");
    }

    return {
      title: /^(untitled|index|)$/i.test(packageTitle.trim())
        ? safeTitle(fallbackTitle ?? "", "Livro EPUB")
        : safeTitle(packageTitle, fallbackTitle ?? "Livro EPUB"),
      chapters,
      imageUrls: [...imageUrls],
    };
  } catch (error) {
    imageUrls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  } finally {
    await reader.close();
  }
}
