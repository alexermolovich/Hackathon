import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';
import 'react-native-reanimated';

import { SelfieCheckGate } from '@/components/selfie-check-gate';
import { GigProvider } from '@/lib/gig-store';

export const unstable_settings = {
  anchor: '(tabs)',
};

const gigSwipeTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000000',
    border: '#18181B',
    card: '#050505',
    primary: '#8B5CF6',
    text: '#FFFFFF',
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
      <GigProvider>
        <ThemeProvider value={gigSwipeTheme}>
          <Stack screenOptions={{ contentStyle: { backgroundColor: '#000000' }, headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat/[matchId]" />
          </Stack>
          <SelfieCheckGate />
          <StatusBar style="light" />
        </ThemeProvider>
      </GigProvider>
    </GestureHandlerRootView>
  );
}
