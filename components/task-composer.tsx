import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { DiscoveryMap } from '@/components/discovery-map';
import { PrimaryButton } from '@/components/primary-button';
import { useGigStore } from '@/lib/gig-store';

const categories = ['Moving', 'Events', 'Tech', 'Cleaning', 'Errands', 'Assembly', 'Home'];

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
  const [skills, setSkills] = useState('Moving, Assembly');
  const [isBoosted, setIsBoosted] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const inputClass = `rounded-[24px] border px-4 py-4 text-base ${
    isDark ? 'border-white/10 bg-white/10 text-white' : 'border-zinc-200 bg-zinc-100 text-zinc-950'
  }`;
  const labelClass = isDark ? 'text-zinc-300' : 'text-zinc-700';
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';

  async function pickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photos to attach task reference images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    const requiredSkills = skills
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean);

    if (!title.trim() || !description.trim() || !Number.isFinite(parsedBudget) || parsedBudget < 5) {
      Alert.alert('Missing details', 'Add a title, description, and realistic budget.');
      return;
    }

    if (requiredSkills.length === 0) {
      Alert.alert('Skills needed', 'Add at least one required skill.');
      return;
    }

    await createTask({
      title: title.trim(),
      description: description.trim(),
      budget: parsedBudget,
      category,
      required_skills: requiredSkills,
      is_boosted: isBoosted,
      image_urls: imageUrls,
    });

    Alert.alert('Task posted', isBoosted ? 'Your boosted task is eligible for the top 3 cards.' : 'Your task is live.');
    onCreated?.();
  }

  return (
    <ScrollView contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
      <View className="mb-6">
        <Text className="text-sm font-semibold text-violet-400">Poster mode</Text>
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
          placeholder="Describe the task, timing, and any constraints."
          placeholderTextColor="#71717A"
          className={`${inputClass} min-h-32 leading-6`}
          textAlignVertical="top"
        />
      </Field>

      <Field label="Reference images" labelClass={labelClass}>
        <View className="gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={() => void pickImages()}
            className={`min-h-14 flex-row items-center justify-center gap-2 rounded-[24px] border ${
              isDark ? 'border-violet/40 bg-violet/20' : 'border-violet/30 bg-violet/10'
            }`}>
            <Ionicons name="image" size={20} color="#8B5CF6" />
            <Text className={`font-bold ${isDark ? 'text-white' : 'text-zinc-950'}`}>Attach Images</Text>
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
          <View
            className={`flex-row items-center rounded-[24px] border px-4 ${
              isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100'
            }`}>
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
          <View
            className={`min-h-14 flex-row items-center justify-between rounded-[24px] border border-violet/30 px-4 ${
              isDark ? 'bg-violet/20' : 'bg-violet/10'
            }`}>
            <Ionicons name="sparkles" size={18} color="#8B5CF6" />
            <Switch
              value={isBoosted}
              onValueChange={setIsBoosted}
              thumbColor="#FFFFFF"
              trackColor={{ false: '#A1A1AA', true: '#8B5CF6' }}
            />
          </View>
        </View>
      </View>

      <Field label="Category" labelClass={labelClass}>
        <View className="flex-row flex-wrap gap-2">
          {categories.map((item) => (
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

      <Field label="Required skills" labelClass={labelClass}>
        <TextInput
          value={skills}
          onChangeText={setSkills}
          placeholder="Moving, Cleaning, Tech Setup"
          placeholderTextColor="#71717A"
          className={`${inputClass} font-semibold`}
        />
      </Field>

      <View
        className={`mb-6 overflow-hidden rounded-[30px] border ${
          isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white'
        }`}>
        <View className="flex-row items-center justify-between p-4">
          <View>
            <Text className="text-sm font-bold text-violet-400">Rapid City area</Text>
            <Text className={`text-base font-black ${titleClass}`}>8 mile task radius</Text>
          </View>
          <Ionicons name="map" size={22} color="#8B5CF6" />
        </View>
        <DiscoveryMap center={profile.location} radiusMiles={8} />
      </View>

      <PrimaryButton label="Publish Task" icon="rocket" onPress={() => void submitTask()} />
    </ScrollView>
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
