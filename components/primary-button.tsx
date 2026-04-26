import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useGigStore } from '@/lib/gig-store';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'violet' | 'orange' | 'emerald' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  visuallyDisabled?: boolean;
  style?: ViewStyle;
};

const toneClasses = {
  violet: 'bg-violet',
  orange: 'bg-orange-500',
  emerald: 'bg-emerald',
  ghost: 'border',
  danger: 'bg-rose-500',
};

export function PrimaryButton({
  label,
  onPress,
  icon,
  tone = 'violet',
  disabled,
  loading,
  visuallyDisabled,
  style,
}: PrimaryButtonProps) {
  const { isDark } = useGigStore();
  const isDisabled = disabled || loading;
  const muted = isDisabled || visuallyDisabled;
  const ghostTextClass = muted ? (isDark ? 'text-zinc-300' : 'text-zinc-600') : tone === 'ghost' && !isDark ? 'text-zinc-950' : 'text-white';
  const iconColor = muted ? (isDark ? '#D4D4D8' : '#52525B') : tone === 'ghost' && !isDark ? '#18181B' : '#FFFFFF';
  const buttonClass =
    muted
      ? isDark
        ? 'border border-white/10 bg-zinc-800'
        : 'border border-zinc-300 bg-zinc-300'
      : tone === 'ghost'
      ? isDark
        ? `${toneClasses.ghost} border-white/20 bg-white/10`
        : `${toneClasses.ghost} border-zinc-200 bg-white`
      : toneClasses[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-3xl px-5 ${
        buttonClass
      }`}
      style={style}>
      {loading ? <ActivityIndicator color={iconColor} size="small" /> : icon ? <Ionicons name={icon} size={18} color={iconColor} /> : null}
      <Text className={`text-center text-sm font-bold ${ghostTextClass}`}>{label}</Text>
    </Pressable>
  );
}
