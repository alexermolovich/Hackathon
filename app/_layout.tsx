import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';
import 'react-native-reanimated';

import { GigProvider, useGigStore } from '@/lib/gig-store';

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

const gigSwipeLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F4F4F5',
    border: '#E4E4E7',
    card: '#FFFFFF',
    primary: '#8B5CF6',
    text: '#18181B',
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
      <GigProvider>
        <ThemedAppShell />
      </GigProvider>
    </GestureHandlerRootView>
  );
}

function ThemedAppShell() {
  const { isDark } = useGigStore();
  const backgroundColor = isDark ? '#000000' : '#F4F4F5';

  return (
    <ThemeProvider value={isDark ? gigSwipeTheme : gigSwipeLightTheme}>
      <Stack screenOptions={{ contentStyle: { backgroundColor }, headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[matchId]" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
