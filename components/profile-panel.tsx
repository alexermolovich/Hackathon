import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { BstPurchaseSheet } from '@/components/bst-purchase-sheet';
import { CreditBadge } from '@/components/credit-badge';
import { PrimaryButton } from '@/components/primary-button';
import { RadiusSlider } from '@/components/radius-slider';
import { VerifiedBadge } from '@/components/verified-badge';
import { useGigStore } from '@/lib/gig-store';
import { calculateAge, initials } from '@/lib/gig-utils';
import { CURRENCY_NAME } from '@/lib/sidehustle-config';

export function ProfilePanel() {
  const {
    profile,
    tasks,
    matches,
    verifySelfie,
    updateRadius,
    isDark,
    colorMode,
    toggleColorMode,
    logout,
  } = useGigStore();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const titleClass = isDark ? 'text-white' : 'text-zinc-950';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const panelClass = isDark ? 'border-white/10 bg-zinc-950' : 'border-zinc-200 bg-white';
  const softClass = isDark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-zinc-100';
  const age = calculateAge(profile.birth_date);

  const profileStats = useMemo(() => {
    const completedDoing = matches.filter((match) => match.doer_id === profile.id && match.status === 'completed');
    const postedTasks = tasks.filter((task) => task.poster_id === profile.id);
    const postedFinished = postedTasks.filter((task) =>
      matches.some((match) => match.task.id === task.id && match.status === 'completed'),
    );

    return {
      completedDoing,
      postedTasks,
      postedFinished,
    };
  }, [matches, profile.id, tasks]);

  async function runPhotoEdit() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Choose an image to update your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    await verifySelfie(result.assets[0].uri);
  }

  return (
    <View>
      <View className="mb-6 flex-row items-center justify-between">
        <View>
          <Text className="text-sm font-semibold text-orange-400">Account hub</Text>
          <Text className={`text-3xl font-black ${titleClass}`}>Profile</Text>
        </View>
        <CreditBadge credits={profile.credits} onPress={() => setPurchaseOpen(true)} />
      </View>

      <View className={`mb-5 rounded-[32px] border p-5 ${panelClass}`}>
        <View className="mb-5 flex-row items-center gap-4">
          <Pressable
            accessibilityRole="button"
            onPress={() => void runPhotoEdit()}
            className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-orange-400/30 bg-orange-500/15">
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ height: 96, width: 96 }} contentFit="cover" />
            ) : (
              <Text className="text-3xl font-black text-white">{initials(profile.username)}</Text>
            )}
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full bg-violet">
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
          <View className="flex-1">
            <View className="mb-2 flex-row items-center gap-2">
              <Text className={`text-2xl font-black ${titleClass}`} numberOfLines={1}>{profile.username}</Text>
              <VerifiedBadge verified={profile.is_verified} compact />
            </View>
            <Text className={`text-sm leading-5 ${mutedClass}`}>{profile.bio}</Text>
          </View>
        </View>

        <View className="mb-5 flex-row gap-3">
          <TrustPanel icon="medal" label="Sweat Wins" value={profile.vouch_count.toString()} />
          <TrustPanel icon="star" label="Avg Rating" value={profile.rating.toFixed(2)} />
        </View>
        <View className="flex-row gap-3">
          <TrustPanel icon="briefcase" label="Posted Wins" value={profile.posted_vouch_count.toString()} />
          <TrustPanel icon="flame" label={CURRENCY_NAME} value={profile.credits.toString()} />
        </View>
      </View>

      <View className={`mb-5 rounded-[30px] border p-5 ${softClass}`}>
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-bold text-orange-400">Theme</Text>
            <Text className={`text-xl font-black ${titleClass}`}>{colorMode === 'dark' ? 'Dark mode' : 'Light mode'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={toggleColorMode}
            className="h-12 w-12 items-center justify-center rounded-full bg-violet">
            <Ionicons name={colorMode === 'dark' ? 'moon' : 'sunny'} size={22} color="#FFFFFF" />
          </Pressable>
        </View>
        <RadiusSlider value={profile.search_radius} onChange={updateRadius} />
      </View>

      <View className={`mb-5 rounded-[30px] border p-5 ${panelClass}`}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className={`text-xl font-black ${titleClass}`}>Account creation</Text>
          <Ionicons name="person-circle" size={24} color="#8B5CF6" />
        </View>
        <InfoRow label="Phone" value={profile.phone_number || 'Required'} />
        <InfoRow label="Google" value={profile.google_authenticated ? 'Connected' : 'Required'} />
        <InfoRow label="Birth date" value={age ? `${profile.birth_date} (${age})` : profile.birth_date} />
        <InfoRow label="Education" value={profile.education_level ?? 'Optional'} />
        <InfoRow label="Terms" value={profile.accepted_terms_at ? 'Accepted' : 'Required'} />
      </View>

      <View className={`mb-5 rounded-[30px] border p-5 ${panelClass}`}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className={`text-xl font-black ${titleClass}`}>Categories</Text>
          <Ionicons name="pricetags" size={22} color="#8B5CF6" />
        </View>
        <View className="flex-row flex-wrap gap-2">
          {profile.interests.map((interest) => (
            <View key={interest} className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-2">
              <Text className="text-sm font-bold text-emerald-600">{interest}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className={`mb-5 rounded-[30px] border p-5 ${panelClass}`}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className={`text-xl font-black ${titleClass}`}>Finished gigs</Text>
          <Text className={`rounded-full px-3 py-1 text-xs font-bold ${isDark ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
            {profileStats.completedDoing.length}
          </Text>
        </View>
        {profileStats.completedDoing.length === 0 ? (
          <Text className={`text-sm ${mutedClass}`}>Finished hustles will show here.</Text>
        ) : (
          profileStats.completedDoing.map((match) => <MiniGigRow key={match.id} title={match.task.title} meta={`Earned $${match.counter_bid}`} />)
        )}
      </View>

      <View className={`mb-5 rounded-[30px] border p-5 ${panelClass}`}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className={`text-xl font-black ${titleClass}`}>Posted gigs</Text>
          <Text className={`rounded-full px-3 py-1 text-xs font-bold ${isDark ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
            {profileStats.postedTasks.length}
          </Text>
        </View>
        {profileStats.postedTasks.map((task) => (
          <MiniGigRow
            key={task.id}
            title={task.title}
            meta={task.status === 'archived' ? 'Archived' : `${task.category} - $${task.budget}`}
          />
        ))}
      </View>

      <View className="mb-5 flex-row gap-3">
        <PrimaryButton
          label={`Buy ${CURRENCY_NAME}`}
          icon="flame"
          tone="violet"
          onPress={() => setPurchaseOpen(true)}
          style={{ flex: 1 }}
        />
        <PrimaryButton label="Logout" icon="log-out" tone="danger" onPress={logout} style={{ flex: 1 }} />
      </View>

      <BstPurchaseSheet visible={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { isDark } = useGigStore();

  return (
    <View className={`mb-2 flex-row items-center justify-between rounded-2xl px-3 py-3 ${isDark ? 'bg-white/5' : 'bg-zinc-100'}`}>
      <Text className={`text-sm font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</Text>
      <Text className={`max-w-[62%] text-right text-sm font-black ${isDark ? 'text-white' : 'text-zinc-950'}`} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function MiniGigRow({ title, meta }: { title: string; meta: string }) {
  const { isDark } = useGigStore();

  return (
    <View className={`mb-3 rounded-[22px] px-4 py-3 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
      <Text className={`font-black ${isDark ? 'text-white' : 'text-zinc-950'}`} numberOfLines={1}>{title}</Text>
      <Text className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{meta}</Text>
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
      <Ionicons name={icon} size={18} color={icon === 'flame' ? '#F97316' : '#10B981'} />
      <Text className={`mt-3 text-3xl font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>{value}</Text>
      <Text className={`text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</Text>
    </View>
  );
}
