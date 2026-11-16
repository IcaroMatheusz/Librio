import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Pdf, { type PdfRef } from 'react-native-pdf';
import { palette } from './atoms';

type Props = { uri: string; initialProgress: number; onProgress: (value: number) => void; onPage: (current: number, total: number) => void; onError: (message: string) => void };

export default function PdfReader({ uri, initialProgress, onProgress, onPage, onError }: Props) {
  const pdf = useRef<PdfRef>(null);
  const [loaded, setLoaded] = useState(false);
  const restored = useRef(false);
  useEffect(() => { restored.current = false; setLoaded(false); }, [uri]);
  return <View style={styles.root}>
    {!loaded && <ActivityIndicator style={styles.loader} size="large" color={palette.violet} />}
    <Pdf ref={pdf} source={{ uri }} style={styles.pdf} trustAllCerts={false} enableDoubleTapZoom enablePaging={false} renderActivityIndicator={() => <ActivityIndicator size="large" color={palette.violet} />} onLoadComplete={(total) => {
      setLoaded(true);
      if (!restored.current && initialProgress > 0) {
        restored.current = true;
        pdf.current?.setPage(Math.max(1, Math.round(total * initialProgress / 100)));
      }
      onPage(initialProgress > 0 ? Math.max(1, Math.round(total * initialProgress / 100)) : 1, total);
    }} onPageChanged={(current, total) => { onPage(current, total); onProgress(total ? current / total * 100 : 0); }} onError={(error) => onError(error.message || 'Não foi possível renderizar este PDF.')} />
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: palette.background }, pdf: { flex: 1, backgroundColor: palette.background }, loader: { position: 'absolute', zIndex: 1, alignSelf: 'center', top: '45%' } });
