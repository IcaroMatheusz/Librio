const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new RangeError("O tamanho em bytes precisa ser um número não negativo.");
  }
  if (bytes === 0) return "0 B";

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;
  const formattedValue = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: value < 10 && unitIndex > 0 ? 1 : 0,
  }).format(value);

  return `${formattedValue} ${BYTE_UNITS[unitIndex]}`;
}
