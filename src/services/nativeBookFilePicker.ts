export type NativeBookFilePickerEvent = {
  type: "input" | "change" | "cancel";
  file: File | null;
  filesCount: number;
};

type NativeBookFilePickerListener = (
  event: NativeBookFilePickerEvent,
) => void;

let nativeInput: HTMLInputElement | null = null;
let activeListener: NativeBookFilePickerListener | null = null;
let queuedEvents: NativeBookFilePickerEvent[] = [];
let pickerPending = false;
let pickerWasBackgrounded = false;

function dispatchPickerEvent(event: NativeBookFilePickerEvent) {
  if (activeListener) {
    activeListener(event);
    return;
  }
  queuedEvents = [...queuedEvents, event].slice(-4);
}

export function getNativeBookFileInput(): HTMLInputElement {
  if (nativeInput?.isConnected) return nativeInput;

  const input = document.createElement("input");
  input.id = "book-file";
  input.type = "file";
  input.accept =
    ".pdf,.epub,.cbr,.cbz,application/pdf,application/epub+zip,application/vnd.comicbook-rar,application/vnd.comicbook+zip";
  input.tabIndex = -1;
  input.setAttribute("aria-label", "Selecionar arquivo da obra");
  input.style.position = "fixed";
  input.style.left = "-10000px";
  input.style.top = "0";
  input.style.width = "1px";
  input.style.height = "1px";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";

  input.addEventListener("input", () => {
    dispatchPickerEvent({
      type: "input",
      file: input.files?.[0] ?? null,
      filesCount: input.files?.length ?? 0,
    });
  });
  input.addEventListener("change", () => {
    pickerPending = false;
    pickerWasBackgrounded = false;
    dispatchPickerEvent({
      type: "change",
      file: input.files?.[0] ?? null,
      filesCount: input.files?.length ?? 0,
    });
    // Keep FileList alive until the browser finishes dispatching both native events.
    window.setTimeout(() => {
      input.value = "";
    }, 0);
  });
  input.addEventListener("cancel", () => {
    pickerPending = false;
    pickerWasBackgrounded = false;
    dispatchPickerEvent({ type: "cancel", file: null, filesCount: 0 });
  });

  document.body.appendChild(input);
  nativeInput = input;
  return input;
}

export function subscribeToNativeBookFilePicker(
  listener: NativeBookFilePickerListener,
): () => void {
  activeListener = listener;
  const queued = queuedEvents;
  queuedEvents = [];
  for (const event of queued) listener(event);

  return () => {
    if (activeListener === listener) activeListener = null;
  };
}

export function setNativeBookPickerPending(pending: boolean) {
  pickerPending = pending;
  if (!pending) pickerWasBackgrounded = false;
}

export function isNativeBookPickerPending() {
  return pickerPending;
}

export function markNativeBookPickerBackgrounded() {
  if (pickerPending) pickerWasBackgrounded = true;
}

export function wasNativeBookPickerBackgrounded() {
  return pickerWasBackgrounded;
}
