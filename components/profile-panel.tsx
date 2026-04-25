import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, Text, View } from 'react-native';

import { CreditBadge } from '@/components/credit-badge';
import { PrimaryButton } from '@/components/primary-button';
import { VerifiedBadge } from '@/components/verified-badge';
import { useGigStore } from '@/lib/gig-store';
import { initials } from '@/lib/gig-utils';

const radiusOptions = [3, 5, 8, 12, 20];

export function ProfilePanel() {
  const { profile, verifySelfie, updateRadius, isDark, colorMode, toggleColorMode } = useGigStore();
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const softClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100';

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
    <View>
      <View className="mb-6 flex-row items-center justify-between">
        <View>
          <Text className="text-sm font-semibold text-violet-400">Safety Shield</Text>
          <Text className={`text-3xl font-black ${titleClass}`}>Profile</Text>
        </View>
        <CreditBadge credits={profile.credits} />
      </View>

      <View className={`mb-5 rounded-[32px] border p-5 ${panelClass}`}>
        <View className="mb-5 flex-row items-center gap-4">
          <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-violet/20 bg-violet/25">
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ height: 96, width: 96 }} contentFit="cover" />
            ) : (
              <Text className="text-3xl font-black text-white">{initials(profile.username)}</Text>
            )}
          </View>
          <View className="flex-1">
            <View className="mb-2 flex-row items-center gap-2">
              <Text className={`text-2xl font-black ${titleClass}`}>{profile.username}</Text>
              <VerifiedBadge verified={profile.is_verified} compact />
            </View>
            <Text className={`text-sm leading-5 ${mutedClass}`}>{profile.bio}</Text>
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

      <View className={`mb-5 rounded-[30px] border p-5 ${softClass}`}>
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-bold text-violet-400">Theme</Text>
            <Text className={`text-xl font-black ${titleClass}`}>{colorMode === 'dark' ? 'Dark mode' : 'Light mode'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={toggleColorMode}
            className="h-12 w-12 items-center justify-center rounded-full bg-violet">
            <Ionicons name={colorMode === 'dark' ? 'moon' : 'sunny'} size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View className={`mb-5 rounded-[30px] border p-5 ${softClass}`}>
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-bold text-violet-400">Proximity</Text>
            <Text className={`text-xl font-black ${titleClass}`}>{profile.search_radius} mile discovery radius</Text>
          </View>
          <Ionicons name="navigate-circle" size={26} color="#8B5CF6" />
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
                  selected ? 'bg-violet' : isDark ? 'border border-white/10 bg-white/10' : 'border border-zinc-200 bg-white'
                }`}>
                <Text className={`font-bold ${selected || isDark ? 'text-white' : 'text-zinc-950'}`}>{radius} mi</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className={`mb-5 rounded-[30px] border p-5 ${panelClass}`}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className={`text-xl font-black ${titleClass}`}>Skill tags</Text>
          <Ionicons name="pricetags" size={22} color="#8B5CF6" />
        </View>
        <View className="flex-row flex-wrap gap-2">
          {profile.skills.map((skill) => (
            <View key={skill} className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-2">
              <Text className="text-sm font-bold text-emerald-600">{skill}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
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
  const { isDark } = useGigStore();

  return (
    <View className={`flex-1 rounded-[24px] p-4 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
      <Ionicons name={icon} size={18} color="#10B981" />
      <Text className={`mt-3 text-3xl font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{value}</Text>
      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</Text>
    </View>
  );
}
