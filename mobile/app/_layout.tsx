import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { LibraryThemeProvider, useLibraryTheme } from '../src/design/libraryTheme';
import { useReducedMotion } from 'react-native-reanimated';
import { FeedbackProvider } from '../src/components/AppSheet';
import { ReaderSettingsProvider } from '../src/components/ReaderSettings';

export default function RootLayout() {
  return <LibraryThemeProvider><Navigation /></LibraryThemeProvider>;
}

function Navigation() {
  const { mode, colors } = useLibraryTheme();
  const reduced = useReducedMotion();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FeedbackProvider><ReaderSettingsProvider>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={{ flex: 1, backgroundColor: colors.background }}>
          <Stack screenOptions={{ headerShown: false, animation: reduced ? 'none' : 'fade', contentStyle: { backgroundColor: colors.background } }} />
        </KeyboardAvoidingView>
      </ReaderSettingsProvider></FeedbackProvider>
    </GestureHandlerRootView>
  );
}
