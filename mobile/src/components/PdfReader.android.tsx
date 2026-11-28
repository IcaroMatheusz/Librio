import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PixelRatio, Platform, StyleSheet, View } from 'react-native';
import Pdf, { type PdfRef } from 'react-native-pdf';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { libraryInk, useLibraryTheme } from '../design/libraryTheme';

export type ReadingMode = 'page' | 'manga' | 'vertical';
export type PdfReaderProps = {
  uri: string;
  initialProgress: number;
  initialPage?: number;
  fade: boolean;
  readingMode: ReadingMode;
  command: { page: number } | null;
  onPage: (current: number, total: number) => void;
  onTap: (x: number, width: number) => void;
  onError: () => void;
};

export default function PdfReader(props: PdfReaderProps) {
  return <PdfDocument key={`${props.uri}-${props.readingMode}`} {...props} />;
}

function PdfDocument({ uri, initialProgress, initialPage, readingMode, command, fade, onPage, onTap, onError }: PdfReaderProps) {
  const { colors } = useLibraryTheme();
  const pdf = useRef<PdfRef>(null);
  const source = useMemo(() => ({ uri }), [uri]);
  const start = useRef({ page: initialPage, progress: initialProgress });
  const waitingFor = useRef<number | null>(null);
  const totalPages = useRef(0);
  const lastCommand = useRef(command);
  const lastPage = useRef<number | null>(null);
  const zoom = useRef(1);
  const [width, setWidth] = useState(0);
  const opacity = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => { if (!fade) opacity.value = 1; }, [fade, opacity]);
  const vertical = readingMode === 'vertical';
  const reversed = readingMode === 'manga' && Platform.OS === 'android';
  const mapPage = (current: number, total: number) => reversed ? total - current + 1 : current;

  useEffect(() => {
    if (totalPages.current && command && command !== lastCommand.current) {
      lastCommand.current = command;
      const nativePage = mapPage(command.page, totalPages.current);
      waitingFor.current = nativePage;
      pdf.current?.setPage(nativePage);
    }
  }, [command, reversed]);

  function display(current: number, total: number) {
    if (fade && lastPage.current !== current) {
      opacity.value = lastPage.current === null ? 0 : 0.7;
      opacity.value = withTiming(1, { duration: 180 });
    }
    lastPage.current = current;
    onPage(current, total);
  }

  return (
    <View style={styles.root} onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
      <Animated.View style={[styles.root, fadeStyle]}>
      <Pdf
        ref={pdf}
        source={source}
        style={styles.pdf}
        trustAllCerts={false}
        enableDoubleTapZoom
        minScale={1}
        maxScale={4}
        enablePaging={!vertical}
        horizontal={!vertical}
        enableRTL={readingMode === 'manga'}
        fitPolicy={vertical ? 0 : 2}
        renderActivityIndicator={() => <ActivityIndicator color={colors.accent} />}
        onLoadComplete={(total) => {
          const target = Math.max(1, Math.min(total, start.current.page ?? Math.round((total * start.current.progress) / 100)));
          totalPages.current = total;
          display(target, total);
          const nativePage = mapPage(target, total);
          if (nativePage !== 1) {
            waitingFor.current = nativePage;
            pdf.current?.setPage(nativePage);
          }
        }}
        onPageChanged={(current, total) => {
          if (!totalPages.current || (waitingFor.current !== null && current !== waitingFor.current)) return;
          waitingFor.current = null;
          display(mapPage(current, total), total);
        }}
        onScaleChanged={(scale) => { zoom.current = scale; }}
        onPageSingleTap={(_page, x) => {
          const position = Platform.OS === 'android' ? x / PixelRatio.get() : x;
          onTap(zoom.current > 1.03 ? width / 2 : position, width);
        }}
        onError={onError}
      />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: libraryInk.canvas },
  pdf: { flex: 1, backgroundColor: libraryInk.canvas },
});
