import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { palette } from '../src/components/atoms';
import { ReaderSettingsProvider } from '../src/components/ReaderSettings';

export default function RootLayout() {
  return <ReaderSettingsProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: palette.background } }} /></ReaderSettingsProvider>;
}
