import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type MatchBurstProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onDismiss: () => void;
};

export function MatchBurst({
  visible,
  title = 'Hustle made',
  subtitle = 'The chat is ready behind the BST unlock.',
  onDismiss,
}: MatchBurstProps) {
  const scale = useSharedValue(0.86);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(-8);

  useEffect(() => {
    if (!visible) {
      opacity.value = withTiming(0, { duration: 160 });
      return;
    }

    opacity.value = withTiming(1, { duration: 180 });
    scale.value = withSequence(withSpring(1.06, { damping: 11 }), withSpring(1, { damping: 13 }));
    rotate.value = withSequence(
      withTiming(5, { duration: 150, easing: Easing.out(Easing.quad) }),
      withDelay(100, withSpring(0)),
    );
  }, [opacity, rotate, scale, visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/80 px-6">
      <Animated.View
        className="w-full max-w-sm items-center rounded-[34px] border border-emerald-300/30 bg-emerald-500/20 p-7"
        style={overlayStyle}>
        <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-emerald">
          <Ionicons name="chatbubbles" size={36} color="#FFFFFF" />
        </View>
        <Text className="mb-2 text-center text-4xl font-black text-white">{title}</Text>
        <Text className="mb-6 text-center text-base leading-6 text-emerald-50">{subtitle}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onDismiss}
          className="min-h-12 w-full items-center justify-center rounded-3xl bg-white">
          <Text className="font-bold text-black">Keep swiping</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
