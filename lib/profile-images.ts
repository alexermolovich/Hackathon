import type { ImagePickerAsset, ImagePickerOptions } from 'expo-image-picker';
import { Platform } from 'react-native';

const PROFILE_IMAGE_MAX_DIMENSION = 512;
const PROFILE_IMAGE_MIME_TYPE = 'image/jpeg';
const PROFILE_IMAGE_QUALITY = 0.82;

export const PROFILE_IMAGE_PICKER_OPTIONS: ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: PROFILE_IMAGE_QUALITY,
  base64: Platform.OS === 'web',
};

function toDataUri(asset: ImagePickerAsset) {
  return asset.base64 ? `data:${PROFILE_IMAGE_MIME_TYPE};base64,${asset.base64}` : null;
}

function canUseBrowserCanvas() {
  return typeof document !== 'undefined' && typeof Image !== 'undefined';
}

function loadBrowserImage(sourceUri: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Profile image could not be loaded.'));
    image.src = sourceUri;
  });
}

async function compressWebProfileImage(sourceUri: string) {
  if (!canUseBrowserCanvas()) {
    return sourceUri;
  }

  const image = await loadBrowserImage(sourceUri);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const largestSide = Math.max(width, height);
  const scale = largestSide > PROFILE_IMAGE_MAX_DIMENSION ? PROFILE_IMAGE_MAX_DIMENSION / largestSide : 1;
  const canvas = document.createElement('canvas');
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));

  canvas.width = nextWidth;
  canvas.height = nextHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    return sourceUri;
  }

  context.drawImage(image, 0, 0, nextWidth, nextHeight);

  return canvas.toDataURL(PROFILE_IMAGE_MIME_TYPE, PROFILE_IMAGE_QUALITY);
}

export async function createPersistentProfileImageRef(asset: ImagePickerAsset) {
  const dataUri = toDataUri(asset);

  if (Platform.OS !== 'web') {
    return dataUri ?? asset.uri;
  }

  const sourceUri = dataUri ?? asset.uri;

  try {
    return await compressWebProfileImage(sourceUri);
  } catch {
    if (dataUri) {
      return dataUri;
    }

    throw new Error('Profile image could not be saved locally.');
  }
}
