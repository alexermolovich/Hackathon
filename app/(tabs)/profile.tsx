import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreditBadge } from '@/components/credit-badge';
import { PrimaryButton } from '@/components/primary-button';
import { VerifiedBadge } from '@/components/verified-badge';
import { useGigStore } from '@/lib/gig-store';
import { initials } from '@/lib/gig-utils';

const radiusOptions = [3, 5, 8, 12, 20];

export default function ProfileScreen() {
  const { profile, verifySelfie, updateRadius } = useGigStore();

  async function runSelfieCheck() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Choose a selfie image to complete verification.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    await verifySelfie(result.assets[0].uri);
    Alert.alert('Verified', 'Selfie check complete.');
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-2">
        <View className="mb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold text-violet-200">Safety Shield</Text>
            <Text className="text-3xl font-black text-white">Profile</Text>
          </View>
          <CreditBadge credits={profile.credits} />
        </View>

        <View className="mb-5 rounded-[32px] border border-white/10 bg-zinc-950 p-5">
          <View className="mb-5 flex-row items-center gap-4">
            <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-violet/25">
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ height: 96, width: 96 }} contentFit="cover" />
              ) : (
                <Text className="text-3xl font-black text-white">{initials(profile.username)}</Text>
              )}
            </View>
            <View className="flex-1">
              <View className="mb-2 flex-row items-center gap-2">
                <Text className="text-2xl font-black text-white">{profile.username}</Text>
                <VerifiedBadge verified={profile.is_verified} compact />
              </View>
              <Text className="text-sm leading-5 text-zinc-400">{profile.bio}</Text>
            </View>
          </View>

          <View className="mb-5 flex-row gap-3">
            <TrustPanel icon="shield-checkmark" label="Vouches" value={profile.vouch_count.toString()} />
            <TrustPanel icon="star" label="Rating" value={profile.rating.toFixed(2)} />
          </View>

          <PrimaryButton
            label={profile.is_verified ? 'Selfie Verified' : 'Verify Identity'}
            icon={profile.is_verified ? 'checkmark-circle' : 'camera'}
            tone={profile.is_verified ? 'emerald' : 'violet'}
            onPress={() => void runSelfieCheck()}
          />
        </View>

        <View className="mb-5 rounded-[30px] border border-white/10 bg-white/10 p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-bold text-violet-200">Proximity</Text>
              <Text className="text-xl font-black text-white">{profile.search_radius} mile discovery radius</Text>
            </View>
            <Ionicons name="navigate-circle" size={26} color="#A78BFA" />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {radiusOptions.map((radius) => {
              const selected = radius === profile.search_radius;

              return (
                <Pressable
                  key={radius}
                  accessibilityRole="button"
                  onPress={() => updateRadius(radius)}
                  className={`min-h-11 min-w-16 items-center justify-center rounded-full px-4 ${
                    selected ? 'bg-violet' : 'border border-white/10 bg-white/10'
                  }`}>
                  <Text className="font-bold text-white">{radius} mi</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mb-5 rounded-[30px] border border-white/10 bg-zinc-950 p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-black text-white">Skill tags</Text>
            <Ionicons name="pricetags" size={22} color="#A78BFA" />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <View key={skill} className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-2">
                <Text className="text-sm font-bold text-emerald-100">{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="rounded-[30px] border border-violet/30 bg-violet/20 p-5">
          <View className="mb-3 flex-row items-center gap-2">
            <Ionicons name="shield" size={22} color="#C4B5FD" />
            <Text className="text-xl font-black text-white">Trust stack</Text>
          </View>
          <View className="gap-3">
            <TrustLine complete={profile.is_verified} label="Selfie verification" />
            <TrustLine complete={profile.vouch_count > 0} label="Successful-task vouches" />
            <TrustLine complete={profile.rating >= 4.5} label="High reputation score" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TrustPanel({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 rounded-[24px] bg-white/10 p-4">
      <Ionicons name={icon} size={18} color="#34D399" />
      <Text className="mt-3 text-3xl font-black text-white">{value}</Text>
      <Text className="text-xs font-semibold text-zinc-400">{label}</Text>
    </View>
  );
}

function TrustLine({ complete, label }: { complete: boolean; label: string }) {
  return (
    <View className="flex-row items-center gap-3 rounded-[22px] bg-black/25 p-3">
      <Ionicons name={complete ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={complete ? '#34D399' : '#71717A'} />
      <Text className="font-semibold text-white">{label}</Text>
    </View>
  );
}
