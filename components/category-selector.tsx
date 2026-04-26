import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { useGigStore } from '@/lib/gig-store';
import { POPULAR_CATEGORIES } from '@/lib/sidehustle-config';

type CategorySelectorProps = {
  selected: string[];
  onChange: (selected: string[]) => void;
  minSelected?: number;
  showSearch?: boolean;
};

const popularCategoryNames = new Set(POPULAR_CATEGORIES.map((category) => category.toLowerCase()));

export function CategorySelector({ selected, onChange, minSelected = 0, showSearch = true }: CategorySelectorProps) {
  const { isDark } = useGigStore();
  const [customCategory, setCustomCategory] = useState('');
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const customSelected = selected.filter((category) => !popularCategoryNames.has(category.toLowerCase()));

  function toggleCategory(category: string) {
    if (selected.includes(category)) {
      if (selected.length <= minSelected) {
        return;
      }

      onChange(selected.filter((item) => item !== category));
      return;
    }

    onChange([...selected, category]);
  }

  function addCustomCategory() {
    const trimmed = customCategory.trim();

    if (!trimmed) {
      return;
    }

    const popularMatch = POPULAR_CATEGORIES.find((category) => category.toLowerCase() === trimmed.toLowerCase());
    const nextCategory = popularMatch ?? trimmed;
    const exists = selected.some((item) => item.toLowerCase() === nextCategory.toLowerCase());
    onChange(exists ? selected : [...selected, nextCategory]);
    setCustomCategory('');
  }

  return (
    <View>
      {minSelected > 0 && (
        <Text className={`mb-3 text-sm font-semibold ${selected.length >= minSelected ? 'text-emerald-500' : mutedClass}`}>
          {selected.length}/{minSelected} minimum selected
        </Text>
      )}
      <View className="mb-3 flex-row flex-wrap gap-2">
        {POPULAR_CATEGORIES.map((category) => {
          const active = selected.includes(category);
          const lockedActive = active && selected.length <= minSelected;

          return (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityState={{ disabled: lockedActive }}
              disabled={lockedActive}
              onPress={() => toggleCategory(category)}
              className={`min-h-10 flex-row items-center gap-1 rounded-full border px-3 ${
                active
                  ? 'border-violet bg-violet'
                  : isDark
                    ? 'border-white/10 bg-white/10'
                    : 'border-zinc-200 bg-white'
              } ${lockedActive ? 'opacity-70' : ''}`}>
              {active && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              <Text className={`text-sm font-bold ${active || isDark ? 'text-white' : 'text-zinc-950'}`}>
                {category}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {customSelected.length > 0 && (
        <View className="mb-3 flex-row flex-wrap gap-2">
          {customSelected.map((category) => {
            const lockedActive = selected.length <= minSelected;

            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityState={{ disabled: lockedActive }}
                disabled={lockedActive}
                onPress={() => toggleCategory(category)}
                className={`min-h-10 flex-row items-center gap-1 rounded-full border border-orange-400/40 bg-orange-500/15 px-3 ${
                  lockedActive ? 'opacity-70' : ''
                }`}>
                <Text className="text-sm font-bold text-orange-400">{category}</Text>
                <Ionicons name={lockedActive ? 'checkmark-circle' : 'close-circle'} size={15} color="#F97316" />
              </Pressable>
            );
          })}
        </View>
      )}
      {showSearch && (
        <View className="flex-row gap-2">
          <TextInput
            value={customCategory}
            onChangeText={setCustomCategory}
            placeholder="Search or add another category"
            placeholderTextColor="#71717A"
            className={`min-h-12 flex-1 rounded-3xl border px-4 text-base ${
              isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-white text-zinc-950'
            }`}
          />
          <PrimaryButton
            label="Add"
            icon="add"
            tone="ghost"
            onPress={addCustomCategory}
            disabled={!customCategory.trim()}
            style={{ minWidth: 84 }}
          />
        </View>
      )}
      {selected.length > 0 && <Text className={`mt-3 text-xs font-semibold ${titleClass}`}>{selected.length} selected</Text>}
    </View>
  );
}
