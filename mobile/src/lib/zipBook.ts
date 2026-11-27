import { Inflate, inflateSync, strFromU8 } from 'fflate';
import { File, FileMode, type FileHandle } from 'expo-file-system';

type Entry = { name: string; flags: number; method: number; compressed: number; size: number; offset: number };
const invalid = 'O índice do arquivo compactado está incompleto ou inválido.';
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
function integer64(fields: DataView, offset: number) {
  const result = fields.getUint32(offset, true) + fields.getUint32(offset + 4, true) * 0x100000000;
  if (!Number.isSafeInteger(result)) throw new Error(invalid);
  return result;
}

export class ZipBook {
  readonly entries = new Map<string, Entry>();
  private readonly handle: FileHandle;
  private readonly size: number;
  private indexOffset = 0;

  private constructor(source: File) {
    this.handle = source.open(FileMode.ReadOnly);
    this.size = source.size;
  }

  static async open(uri: string) {
    const archive = new ZipBook(new File(uri));
    try {
      await archive.readIndex();
      return archive;
    } catch (error) {
      archive.close();
      throw error;
    }
  }

  close() { this.handle.close(); }

  private async readAt(offset: number, length: number) {
    if (offset < 0 || length < 0 || offset + length > this.size) throw new Error(invalid);
    if (!length) return new Uint8Array(0);
    this.handle.offset = offset;
    const bytes = await this.handle.readBytes(length);
    if (bytes.length !== length) throw new Error(invalid);
    return bytes;
  }

  private async readIndex() {
    const tailOffset = Math.max(0, this.size - 65_557);
    const end = await this.readAt(tailOffset, this.size - tailOffset);
    const tail = view(end);
    let footer = end.length - 22;
    while (footer >= 0 && (tail.getUint32(footer, true) !== 0x06054b50 ||
      footer + 22 + tail.getUint16(footer + 20, true) !== end.length)) footer -= 1;
    if (footer < 0) throw new Error(invalid);
    const disks = tail.getUint32(footer + 4, true);
    if (disks !== 0 && disks !== 0xffffffff) throw new Error(invalid);

    let count = tail.getUint16(footer + 10, true);
    let indexSize = tail.getUint32(footer + 12, true);
    let indexOffset = tail.getUint32(footer + 16, true);
    if (disks === 0xffffffff || count === 0xffff || indexSize === 0xffffffff || indexOffset === 0xffffffff) {
      const locator = view(await this.readAt(tailOffset + footer - 20, 20));
      if (locator.getUint32(0, true) !== 0x07064b50 || locator.getUint32(4, true) !== 0 || locator.getUint32(16, true) !== 1) throw new Error(invalid);
      const zip64 = view(await this.readAt(integer64(locator, 8), 56));
      if (zip64.getUint32(0, true) !== 0x06064b50 || zip64.getUint32(16, true) || zip64.getUint32(20, true)) throw new Error(invalid);
      count = integer64(zip64, 32);
      indexSize = integer64(zip64, 40);
      indexOffset = integer64(zip64, 48);
    }
    if (indexOffset + indexSize > tailOffset + footer || count > Math.floor(indexSize / 46)) throw new Error(invalid);
    this.indexOffset = indexOffset;
    const index = await this.readAt(indexOffset, indexSize);
    const central = view(index);
    let cursor = 0;
    for (let entry = 0; entry < count; entry += 1) {
      if (cursor + 46 > index.length || central.getUint32(cursor, true) !== 0x02014b50) throw new Error(invalid);
      const flags = central.getUint16(cursor + 8, true);
      const method = central.getUint16(cursor + 10, true);
      let compressed = central.getUint32(cursor + 20, true);
      let size = central.getUint32(cursor + 24, true);
      let offset = central.getUint32(cursor + 42, true);
      const nameOffset = cursor + 46;
      const nameEnd = nameOffset + central.getUint16(cursor + 28, true);
      const extraEnd = nameEnd + central.getUint16(cursor + 30, true);
      cursor = extraEnd + central.getUint16(cursor + 32, true);
      if (cursor > index.length) throw new Error(invalid);
      const name = strFromU8(index.subarray(nameOffset, nameEnd), !(flags & 0x800));
      if (name.split('/').some((part) => part === '__MACOSX' || part.startsWith('.'))) continue;
      if ([compressed, size, offset].includes(0xffffffff)) {
        for (let extra = nameEnd; extra + 4 <= extraEnd;) {
          const field = central.getUint16(extra, true);
          const length = central.getUint16(extra + 2, true);
          extra += 4;
          if (extra + length > extraEnd) throw new Error(invalid);
          if (field === 1) {
            const zip64 = view(index.subarray(extra, extra + length));
            let offsetInField = 0;
            const next = () => { const n = integer64(zip64, offsetInField); offsetInField += 8; return n; };
            if (size === 0xffffffff) size = next();
            if (compressed === 0xffffffff) compressed = next();
            if (offset === 0xffffffff) offset = next();
            break;
          }
          extra += length;
        }
      }
      this.entries.set(name, { name, flags, method, compressed, size, offset });
    }
  }

  private async dataOffset(entry: Entry) {
    if (entry.flags & 1 || (entry.method !== 0 && entry.method !== 8)) {
      throw new Error('O arquivo usa criptografia ou compactação incompatível.');
    }
    const header = view(await this.readAt(entry.offset, 30));
    if (header.getUint32(0, true) !== 0x04034b50) throw new Error(invalid);
    const start = entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
    if (start + entry.compressed > this.indexOffset) throw new Error(invalid);
    return start;
  }

  async read(name: string) {
    const entry = this.entries.get(name);
    if (!entry) return undefined;
    const start = await this.dataOffset(entry);
    const input = await this.readAt(start, entry.compressed);
    const bytes = entry.method === 8 ? inflateSync(input, { out: new Uint8Array(entry.size) }) : input;
    if (bytes.length !== entry.size) throw new Error(invalid);
    return bytes;
  }

  async extract(entry: Entry, target: File, signal: AbortSignal) {
    const start = await this.dataOffset(entry);
    target.create();
    const writer = target.open(FileMode.WriteOnly);
    let written = 0;
    const write = (chunk: Uint8Array) => {
      written += chunk.length;
      if (written > entry.size) throw new Error(invalid);
      writer.writeBytesSync(chunk);
    };
    // Each step reads a small block even for ZIP64 archives and very large images.
    const inflate = entry.method === 8 ? new Inflate(write) : null;
    try {
      for (let offset = 0; offset < entry.compressed;) {
        if (signal.aborted) throw new Error('Extração cancelada.');
        const input = await this.readAt(start + offset, Math.min(32 * 1024, entry.compressed - offset));
        offset += input.length;
        if (inflate) inflate.push(input, offset === entry.compressed);
        else write(input);
      }
      if (written !== entry.size) throw new Error(invalid);
    } finally {
      writer.close();
    }
  }
}
