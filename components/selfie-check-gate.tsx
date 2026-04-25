import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { useGigStore } from '@/lib/gig-store';

export function SelfieCheckGate() {
  const { profile, verifySelfie } = useGigStore();

  if (profile.is_verified) {
    return null;
  }

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
  }

  return (
    <View className="absolute inset-0 z-50 justify-end bg-black/90">
      <View className="rounded-t-[36px] border border-white/10 bg-zinc-950 p-6">
        <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-violet">
          <Ionicons name="shield-checkmark" size={36} color="#FFFFFF" />
        </View>
        <Text className="mb-2 text-4xl font-black text-white">Verify your Identity</Text>
        <Text className="mb-6 text-base leading-6 text-zinc-300">
          Complete a mocked selfie check to activate your verified badge and start matching.
        </Text>
        <PrimaryButton label="Upload Selfie" icon="camera" onPress={() => void runSelfieCheck()} />
      </View>
    </View>
  );
}
