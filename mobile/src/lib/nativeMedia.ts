import { requireOptionalNativeModule } from 'expo';

type MediaModule = {
  contextMenuHaptic?: () => void;
  extractComic?: (input: string, destination: string, coverOnly: boolean, jobId: string) => Promise<{ name: string; uri: string; aspectRatio: number }[]>;
  cancelComic?: (jobId: string) => void;
  renderPdfCover: (input: string, destination: string) => Promise<void>;
};

export const nativeMedia = requireOptionalNativeModule<MediaModule>('LibrioMedia');
