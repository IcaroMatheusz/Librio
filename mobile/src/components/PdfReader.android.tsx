import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import Pdf, { type PdfRef } from 'react-native-pdf';
import { palette } from './atoms';

export type ReadingMode = 'page' | 'manga' | 'vertical';
export type PdfReaderProps = {
  uri: string;
  initialProgress: number;
  initialPage?: number;
  readingMode: ReadingMode;
  command: { page: number } | null;
  onPage: (current: number, total: number) => void;
  onTap: () => void;
  onError: () => void;
};

export default function PdfReader(props: PdfReaderProps) {
  return <PdfDocument key={`${props.uri}-${props.readingMode}`} {...props} />;
}

function PdfDocument({ uri, initialProgress, initialPage, readingMode, command, onPage, onTap, onError }: PdfReaderProps) {
  const pdf = useRef<PdfRef>(null);
  const source = useMemo(() => ({ uri }), [uri]);
  const start = useRef({ page: initialPage, progress: initialProgress });
  const waitingFor = useRef<number | null>(null);
  const totalPages = useRef(0);
  const lastCommand = useRef(command);
  const vertical = readingMode === 'vertical';
  const reversed = readingMode === 'manga' && Platform.OS === 'android';
  const mapPage = (current: number, total: number) => reversed ? total - current + 1 : current;

  useEffect(() => {
    if (totalPages.current && command && command !== lastCommand.current) {
      lastCommand.current = command;
      waitingFor.current = null;
      pdf.current?.setPage(mapPage(command.page, totalPages.current));
    }
  }, [command, reversed]);

  return (
    <View style={styles.root}>
      <Pdf
        ref={pdf}
        source={source}
        style={styles.pdf}
        trustAllCerts={false}
        enableDoubleTapZoom
        enablePaging={!vertical}
        horizontal={!vertical}
        enableRTL={readingMode === 'manga'}
        fitPolicy={vertical ? 0 : 2}
        renderActivityIndicator={() => <ActivityIndicator color={palette.violet} />}
        onLoadComplete={(total) => {
          const target = Math.max(1, Math.min(total, start.current.page ?? Math.round((total * start.current.progress) / 100)));
          totalPages.current = total;
          onPage(target, total);
          const nativePage = mapPage(target, total);
          if (nativePage !== 1) {
            waitingFor.current = nativePage;
            pdf.current?.setPage(nativePage);
          }
        }}
        onPageChanged={(current, total) => {
          if (!totalPages.current || (waitingFor.current !== null && current !== waitingFor.current)) return;
          waitingFor.current = null;
          onPage(mapPage(current, total), total);
        }}
        onPageSingleTap={onTap}
        onError={onError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#100E16' },
  pdf: { flex: 1, backgroundColor: '#100E16' },
});
