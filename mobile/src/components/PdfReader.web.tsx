import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { palette } from './atoms';
import type { ReadingMode } from './PdfReader.android';

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
  onProgress,
  onError,
}: Props) {
  return (
    <View style={styles.root}>
      <WebView
        source={{ uri }}
        style={styles.web}
        startInLoadingState
        renderLoading={() => (
          <ActivityIndicator style={styles.loader} size="large" color={palette.violet} />
        )}
        onError={(event: any) =>
          onError(event.nativeEvent.description || 'Não foi possível abrir este PDF.')
        }
        injectedJavaScript={`window.scrollTo(0, document.documentElement.scrollHeight * ${Math.max(0, Math.min(100, initialProgress)) / 100}); true;`}
        onScroll={(event: any) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const max = contentSize.height - layoutMeasurement.height;
          if (max > 0) onProgress(Math.round((contentOffset.y / max) * 100));
        }}
        scrollEventThrottle={500}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  web: { flex: 1, backgroundColor: palette.background },
  loader: { flex: 1 },
});
