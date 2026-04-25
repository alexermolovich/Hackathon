import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';
import type { ViewStyle } from 'react-native';

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
  ghost: 'border border-white/20 bg-white/10',
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
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-3xl px-5 ${
        toneClasses[tone]
      } ${disabled ? 'opacity-40' : 'opacity-100'}`}
      style={style}>
      {icon && <Ionicons name={icon} size={18} color="#FFFFFF" />}
      <Text className="text-center text-sm font-bold text-white">{label}</Text>
    </Pressable>
  );
}
