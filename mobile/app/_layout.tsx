import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { palette } from '../src/components/atoms';

export default function RootLayout() {
  return <><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: palette.background } }} /></>;
}
