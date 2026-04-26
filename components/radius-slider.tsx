import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';

import { useGigStore } from '@/lib/gig-store';

type RadiusSliderProps = {
  value: number;
  onChange: (value: number) => void;
};

const MIN_RADIUS = 1;
const MAX_RADIUS = 100;
const THUMB_SIZE = 28;

function clampRadius(value: number) {
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.round(value)));
}

export function RadiusSlider({ value, onChange }: RadiusSliderProps) {
  const { isDark } = useGigStore();
  const [width, setWidth] = useState(0);
  const radius = clampRadius(value);
  const ratio = (radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS);
  const percent = ratio * 100;
  const thumbLeft = width > 0 ? ratio * Math.max(0, width - THUMB_SIZE) : 0;
  const updateFromLocation = useCallback(
    (event: GestureResponderEvent) => {
      if (width <= 0) {
        return;
      }

      const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / width));
      onChange(clampRadius(MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS)));
    },
    [onChange, width],
  );
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dx) > 2 && Math.abs(gestureState.dx) >= Math.abs(gestureState.dy),
        onPanResponderGrant: (event) => updateFromLocation(event),
        onPanResponderMove: (event) => updateFromLocation(event),
      }),
    [updateFromLocation],
  );

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className={`text-sm font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Proximity</Text>
        <Text className={`text-sm font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{radius} mi</Text>
      </View>
      <View
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          onChange(clampRadius(radius + (event.nativeEvent.actionName === 'increment' ? 5 : -5)));
        }}
        onLayout={handleLayout}
        className={`h-10 justify-center rounded-full px-1 ${isDark ? 'bg-white/10' : 'bg-zinc-200'}`}>
        <View className="h-2 rounded-full bg-zinc-400/30">
          <View className="h-2 rounded-full bg-violet" style={{ width: `${percent}%` }} />
        </View>
        <View
          className="absolute h-7 w-7 rounded-full border-4 border-white bg-orange-500"
          style={{ left: thumbLeft, top: 6 }}
        />
      </View>
    </View>
  );
}
