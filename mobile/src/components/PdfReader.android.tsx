import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Pdf, { type PdfRef } from 'react-native-pdf';
import { palette } from './atoms';

export type ReadingMode = 'page' | 'manga' | 'vertical';

type Props = {
  uri: string;
  initialProgress: number;
  readingMode?: ReadingMode;
  targetPage?: number;
  onProgress: (value: number) => void;
  onPage: (current: number, total: number) => void;
  onError: (message: string) => void;
};

export default function PdfReader({
  uri,
  initialProgress,
  readingMode = 'page',
  targetPage,
  onProgress,
  onPage,
  onError,
}: Props) {
  const pdf = useRef<PdfRef>(null);
  const [loaded, setLoaded] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    restored.current = false;
    setLoaded(false);
  }, [uri, readingMode]);

  useEffect(() => {
    if (loaded && targetPage && targetPage > 0) {
      pdf.current?.setPage(targetPage);
    }
  }, [loaded, targetPage]);

  const isVertical = readingMode === 'vertical';
  const isManga = readingMode === 'manga';

  return (
    <View style={styles.root}>
      {!loaded && (
        <ActivityIndicator
          style={styles.loader}
          size="large"
          color={palette.violet}
        />
      )}
      <Pdf
        key={`${uri}-${readingMode}`}
        ref={pdf}
        source={{ uri }}
        style={styles.pdf}
        trustAllCerts={false}
        enableDoubleTapZoom
        enablePaging={!isVertical}
        horizontal={!isVertical}
        enableRTL={isManga}
        renderActivityIndicator={() => (
          <ActivityIndicator size="large" color={palette.violet} />
        )}
        onLoadComplete={(total) => {
          setLoaded(true);
          const initialPage =
            initialProgress > 0
              ? Math.max(1, Math.round((total * initialProgress) / 100))
              : 1;
          if (!restored.current && initialProgress > 0) {
            restored.current = true;
            pdf.current?.setPage(initialPage);
          }
          onPage(initialPage, total);
        }}
        onPageChanged={(current, total) => {
          onPage(current, total);
          onProgress(total ? (current / total) * 100 : 0);
        }}
        onError={(error) =>
          onError(error.message || 'Não foi possível renderizar este PDF.')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  pdf: {
    flex: 1,
    backgroundColor: palette.background,
  },
  loader: {
    position: 'absolute',
    zIndex: 1,
    alignSelf: 'center',
    top: '45%',
  },
});
