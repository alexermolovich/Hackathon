import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

import { useGigStore } from '@/lib/gig-store';

type RadiusSliderProps = {
  value: number;
  onChange: (value: number) => void;
};

const MIN_RADIUS = 1;
const MAX_RADIUS = 100;

export function RadiusSlider({ value, onChange }: RadiusSliderProps) {
  const { isDark } = useGigStore();
  const [width, setWidth] = useState(0);
  const percent = ((value - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * 100;

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  function handlePress(event: GestureResponderEvent) {
    if (width <= 0) {
      return;
    }

    const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / width));
    onChange(Math.round(MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS)));
  }

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Proximity</Text>
        <Text className={`text-sm font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{value} mi</Text>
      </View>
      <Pressable
        accessibilityRole="adjustable"
        onLayout={handleLayout}
        onPress={handlePress}
        className={`h-10 justify-center rounded-full px-1 ${isDark ? 'bg-white/10' : 'bg-zinc-200'}`}>
        <View className="h-2 rounded-full bg-zinc-400/30">
          <View className="h-2 rounded-full bg-violet" style={{ width: `${percent}%` }} />
        </View>
        <View
          className="absolute h-7 w-7 rounded-full border-4 border-white bg-orange-500"
          style={{ left: `${percent}%`, marginLeft: -14 }}
        />
      </Pressable>
    </View>
  );
}
