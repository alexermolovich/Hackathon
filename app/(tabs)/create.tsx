import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiscoveryMap } from '@/components/discovery-map';
import { PrimaryButton } from '@/components/primary-button';
import { useGigStore } from '@/lib/gig-store';

const categories = ['Events', 'Tech', 'Cleaning', 'Errands', 'Assembly', 'Home'];

export default function CreateTaskScreen() {
  const { profile, createTask } = useGigStore();
  const [title, setTitle] = useState('Move two shelves across town');
  const [description, setDescription] = useState(
    'Need one reliable helper for a short apartment move. Elevator access on both sides.',
  );
  const [budget, setBudget] = useState('68');
  const [category, setCategory] = useState('Moving');
  const [skills, setSkills] = useState('Moving, Assembly');
  const [isBoosted, setIsBoosted] = useState(true);

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
    });

    Alert.alert('Task posted', isBoosted ? 'Your boosted task is eligible for the top 3 cards.' : 'Your task is live.');
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-2">
        <View className="mb-6">
          <Text className="text-sm font-semibold text-violet-200">Poster mode</Text>
          <Text className="text-3xl font-black text-white">Post a gig</Text>
        </View>

        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What do you need done?"
            placeholderTextColor="#71717A"
            className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4 text-base font-semibold text-white"
          />
        </Field>

        <Field label="Description">
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Describe the task, timing, and any constraints."
            placeholderTextColor="#71717A"
            className="min-h-32 rounded-[24px] border border-white/10 bg-white/10 p-4 text-base leading-6 text-white"
            textAlignVertical="top"
          />
        </Field>

        <View className="mb-5 flex-row gap-3">
          <View className="flex-1">
            <Text className="mb-2 text-sm font-bold text-zinc-300">Budget</Text>
            <View className="flex-row items-center rounded-[24px] border border-white/10 bg-white/10 px-4">
              <Text className="text-xl font-black text-white">$</Text>
              <TextInput
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
                className="flex-1 py-4 text-xl font-black text-white"
              />
            </View>
          </View>
          <View className="flex-1">
            <Text className="mb-2 text-sm font-bold text-zinc-300">Boost</Text>
            <View className="min-h-14 flex-row items-center justify-between rounded-[24px] border border-violet/30 bg-violet/20 px-4">
              <Ionicons name="sparkles" size={18} color="#C4B5FD" />
              <Switch
                value={isBoosted}
                onValueChange={setIsBoosted}
                thumbColor="#FFFFFF"
                trackColor={{ false: '#3F3F46', true: '#8B5CF6' }}
              />
            </View>
          </View>
        </View>

        <Field label="Category">
          <View className="flex-row flex-wrap gap-2">
            {[...new Set([category, ...categories])].map((item) => {
              const selected = item === category;

              return (
                <PrimaryButton
                  key={item}
                  label={item}
                  tone={selected ? 'violet' : 'ghost'}
                  onPress={() => setCategory(item)}
                  style={{ minHeight: 42, paddingHorizontal: 14 }}
                />
              );
            })}
          </View>
        </Field>

        <Field label="Required skills">
          <TextInput
            value={skills}
            onChangeText={setSkills}
            placeholder="Moving, Cleaning, Tech Setup"
            placeholderTextColor="#71717A"
            className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4 text-base font-semibold text-white"
          />
        </Field>

        <View className="mb-6 overflow-hidden rounded-[30px] border border-white/10 bg-zinc-950">
          <View className="flex-row items-center justify-between p-4">
            <View>
              <Text className="text-sm font-bold text-violet-200">Discovery area</Text>
              <Text className="text-base font-black text-white">{profile.search_radius} mile task radius</Text>
            </View>
            <Ionicons name="map" size={22} color="#A78BFA" />
          </View>
          <DiscoveryMap center={profile.location} radiusMiles={profile.search_radius} />
        </View>

        <PrimaryButton label="Publish Task" icon="rocket" onPress={() => void submitTask()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-bold text-zinc-300">{label}</Text>
      {children}
    </View>
  );
}
