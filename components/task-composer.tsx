import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { BstPurchaseSheet } from '@/components/bst-purchase-sheet';
import { PrimaryButton } from '@/components/primary-button';
import { useGigStore } from '@/lib/gig-store';
import { BOOST_COST_PER_DAY_BSTS, CURRENCY_NAME, POPULAR_CATEGORIES } from '@/lib/sidehustle-config';

const boostDurations = [1, 3, 7];

type TaskComposerProps = {
  onCreated?: () => void;
};

export function TaskComposer({ onCreated }: TaskComposerProps) {
  const { profile, createTask, isDark } = useGigStore();
  const [title, setTitle] = useState('Move two shelves across town');
  const [description, setDescription] = useState(
    'Need one reliable helper for a short apartment move. Elevator access on both sides.',
  );
  const [budget, setBudget] = useState('68');
  const [category, setCategory] = useState('Moving');
  const [locationLabel, setLocationLabel] = useState('Rapid City general area');
  const [dateWindow, setDateWindow] = useState('Apr 26 - Apr 27, flexible');
  const [isBoosted, setIsBoosted] = useState(false);
  const [boostDays, setBoostDays] = useState(3);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const boostCost = useMemo(
    () => (isBoosted ? boostDays * BOOST_COST_PER_DAY_BSTS : 0),
    [boostDays, isBoosted],
  );
  const inputClass = `rounded-[24px] border px-4 py-4 text-base ${
    isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-zinc-100 text-zinc-950'
  }`;
  const labelClass = isDark ? 'text-zinc-300' : 'text-zinc-700';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const softClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100';

  async function pickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Attach at least one image for this gig.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    setImageUrls((current) => [...current, ...result.assets.map((asset) => asset.uri)].slice(0, 4));
  }

  async function submitTask() {
    const parsedBudget = Number(budget);

    if (!title.trim() || !description.trim() || !Number.isFinite(parsedBudget) || parsedBudget < 5) {
      Alert.alert('Missing details', 'Add a title, description, and realistic budget.');
      return;
    }

    if (imageUrls.length === 0) {
      Alert.alert('Image required', 'Add at least one image before posting the gig.');
      return;
    }

    const created = await createTask({
      title: title.trim(),
      description: description.trim(),
      budget: parsedBudget,
      category,
      location_label: locationLabel.trim() || 'Rapid City general area',
      date_window: dateWindow.trim(),
      is_boosted: isBoosted,
      boost_days: isBoosted ? boostDays : 0,
      boost_cost_bsts: boostCost,
      image_urls: imageUrls,
    });

    if (!created) {
      setPurchaseOpen(true);
      return;
    }

    Alert.alert('Gig posted', isBoosted ? `Boosted for ${boostDays} day${boostDays === 1 ? '' : 's'}.` : 'Your gig is live.');
    onCreated?.();
  }

  return (
    <>
      <ScrollView contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <Text className="text-sm font-semibold text-orange-400">Gig starter mode</Text>
          <Text className={`text-3xl font-black ${titleClass}`}>Post a gig</Text>
        </View>

        <Field label="Title" labelClass={labelClass}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What do you need done?"
            placeholderTextColor="#71717A"
            className={`${inputClass} font-semibold`}
          />
        </Field>

        <Field label="Description" labelClass={labelClass}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Describe the gig, timing, and constraints."
            placeholderTextColor="#71717A"
            className={`${inputClass} min-h-32 leading-6`}
            textAlignVertical="top"
          />
        </Field>

        <Field label={`Reference images (${imageUrls.length}/4)`} labelClass={labelClass}>
          <View className="gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => void pickImages()}
              className={`min-h-14 flex-row items-center justify-center gap-2 rounded-[24px] border ${
                isDark ? 'border-orange-400/40 bg-orange-500/15' : 'border-orange-300 bg-orange-50'
              }`}>
              <Ionicons name="image" size={20} color="#F97316" />
              <Text className={`font-bold ${titleClass}`}>Attach Images</Text>
            </Pressable>

            {imageUrls.length > 0 && (
              <View className="flex-row flex-wrap gap-2">
                {imageUrls.map((uri) => (
                  <View key={uri} className="overflow-hidden rounded-[18px]">
                    <Image source={{ uri }} style={{ height: 76, width: 76 }} contentFit="cover" />
                  </View>
                ))}
              </View>
            )}
          </View>
        </Field>

        <View className="mb-5 flex-row gap-3">
          <View className="flex-1">
            <Text className={`mb-2 text-sm font-bold ${labelClass}`}>Budget</Text>
            <View className={`flex-row items-center rounded-[24px] border px-4 ${softClass}`}>
              <Text className={`text-xl font-black ${titleClass}`}>$</Text>
              <TextInput
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
                className={`flex-1 py-4 text-xl font-black ${titleClass}`}
              />
            </View>
          </View>
          <View className="flex-1">
            <Text className={`mb-2 text-sm font-bold ${labelClass}`}>Boost</Text>
            <View className={`min-h-14 flex-row items-center justify-between rounded-[24px] border px-4 ${softClass}`}>
              <View className="flex-row items-center gap-2">
                <Ionicons name="flame" size={18} color="#F97316" />
                <Text className={`text-sm font-bold ${titleClass}`}>{boostCost} {CURRENCY_NAME}</Text>
              </View>
              <Switch
                value={isBoosted}
                onValueChange={setIsBoosted}
                thumbColor="#FFFFFF"
                trackColor={{ false: '#A1A1AA', true: '#F97316' }}
              />
            </View>
          </View>
        </View>

        {isBoosted && (
          <Field label="Boost duration" labelClass={labelClass}>
            <View className="flex-row gap-2">
              {boostDurations.map((days) => {
                const selected = boostDays === days;

                return (
                  <Pressable
                    key={days}
                    accessibilityRole="button"
                    onPress={() => setBoostDays(days)}
                    className={`min-h-12 flex-1 items-center justify-center rounded-full border ${
                      selected ? 'border-orange-400 bg-orange-500' : softClass
                    }`}>
                    <Text className={`font-black ${selected || isDark ? 'text-white' : 'text-zinc-950'}`}>
                      {days}d
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className={`mt-2 text-xs font-semibold ${mutedClass}`}>
              Posting is free. Boosting spends {BOOST_COST_PER_DAY_BSTS} {CURRENCY_NAME} per day.
            </Text>
          </Field>
        )}

        <Field label="Category" labelClass={labelClass}>
          <View className="flex-row flex-wrap gap-2">
            {POPULAR_CATEGORIES.map((item) => (
              <PrimaryButton
                key={item}
                label={item}
                tone={item === category ? 'violet' : 'ghost'}
                onPress={() => setCategory(item)}
                style={{ minHeight: 42, paddingHorizontal: 14 }}
              />
            ))}
          </View>
        </Field>

        <Field label="General location" labelClass={labelClass}>
          <TextInput
            value={locationLabel}
            onChangeText={setLocationLabel}
            placeholder="City, neighborhood, or general area"
            placeholderTextColor="#71717A"
            className={`${inputClass} font-semibold`}
          />
        </Field>

        <Field label="Date range" labelClass={labelClass}>
          <TextInput
            value={dateWindow}
            onChangeText={setDateWindow}
            placeholder="Optional"
            placeholderTextColor="#71717A"
            className={`${inputClass} font-semibold`}
          />
        </Field>

        <View className={`mb-6 rounded-[26px] border p-4 ${softClass}`}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className={`text-sm font-bold ${mutedClass}`}>Balance</Text>
              <Text className={`text-2xl font-black ${titleClass}`}>{profile.credits} {CURRENCY_NAME}</Text>
            </View>
            <Ionicons name="flame" size={28} color="#F97316" />
          </View>
        </View>

        <PrimaryButton label="Publish Gig" icon="rocket" onPress={() => void submitTask()} />
      </ScrollView>

      <BstPurchaseSheet
        visible={purchaseOpen}
        reason={`Boosting this gig needs ${boostCost} ${CURRENCY_NAME}.`}
        onClose={() => setPurchaseOpen(false)}
      />
    </>
  );
}

function Field({
  label,
  labelClass,
  children,
}: {
  label: string;
  labelClass: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-5">
      <Text className={`mb-2 text-sm font-bold ${labelClass}`}>{label}</Text>
      {children}
    </View>
  );
}
