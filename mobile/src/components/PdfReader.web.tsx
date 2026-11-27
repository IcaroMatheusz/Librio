import { StyleSheet, Text, View } from 'react-native';
import type { PdfReaderProps } from './PdfReader.android';

export default function PdfReader({ uri }: PdfReaderProps) {
  if (uri.startsWith('http') || uri.startsWith('blob:')) {
    return <iframe title="Documento PDF" src={uri} style={{ border: 0, flex: 1 }} />;
  }
  return <View style={styles.root}><Text style={styles.text}>Abra o PDF no aplicativo móvel.</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { color: '#FFFFFF' },
});
