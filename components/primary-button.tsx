import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useGigStore } from '@/lib/gig-store';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'violet' | 'emerald' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
};

const toneClasses = {
  violet: 'bg-violet',
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
  style,
}: PrimaryButtonProps) {
  const { isDark } = useGigStore();
  const ghostTextClass = tone === 'ghost' && !isDark ? 'text-zinc-950' : 'text-white';
  const iconColor = tone === 'ghost' && !isDark ? '#18181B' : '#FFFFFF';
  const buttonClass =
    tone === 'ghost'
      ? isDark
        ? `${toneClasses.ghost} border-white/20 bg-white/10`
        : `${toneClasses.ghost} border-zinc-200 bg-white`
      : toneClasses[tone];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-3xl px-5 ${
        buttonClass
      } ${disabled ? 'opacity-40' : 'opacity-100'}`}
      style={style}>
      {icon && <Ionicons name={icon} size={18} color={iconColor} />}
      <Text className={`text-center text-sm font-bold ${ghostTextClass}`}>{label}</Text>
    </Pressable>
  );
}
