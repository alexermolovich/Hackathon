const repoImageSources = {
  'repo://demo/avatars/aria-stone.png': require('../assets/demo/avatars/aria-stone.png'),
  'repo://demo/avatars/demo-hustler.png': require('../assets/demo/avatars/demo-hustler.png'),
  'repo://demo/avatars/juno-patel.png': require('../assets/demo/avatars/juno-patel.png'),
  'repo://demo/avatars/milo-reyes.png': require('../assets/demo/avatars/milo-reyes.png'),
  'repo://demo/avatars/sage-kim.png': require('../assets/demo/avatars/sage-kim.png'),
  'repo://demo/gigs/category-fallback.png': require('../assets/demo/gigs/category-fallback.png'),
  'repo://demo/gigs/catering-run.png': require('../assets/demo/gigs/catering-run.png'),
  'repo://demo/gigs/garage-sort.png': require('../assets/demo/gigs/garage-sort.png'),
  'repo://demo/gigs/mesh-wifi.png': require('../assets/demo/gigs/mesh-wifi.png'),
  'repo://demo/gigs/patio-assembly.png': require('../assets/demo/gigs/patio-assembly.png'),
  'repo://demo/gigs/pop-up-booth.png': require('../assets/demo/gigs/pop-up-booth.png'),
  'repo://demo/gigs/studio-reset.png': require('../assets/demo/gigs/studio-reset.png'),
} as const;

export type RepoImageRef = keyof typeof repoImageSources;

export const DEFAULT_GIG_IMAGE_REF: RepoImageRef = 'repo://demo/gigs/category-fallback.png';

export function resolveImageSource(imageRef?: string | null) {
  if (!imageRef) {
    return null;
  }

  if (isTransientImageRef(imageRef)) {
    return null;
  }

  return repoImageSources[imageRef as RepoImageRef] ?? { uri: imageRef };
}

export function isTransientImageRef(imageRef: string) {
  return /^blob:/i.test(imageRef);
}

export function isDeviceLocalImageRef(imageRef: string) {
  return /^(assets-library|blob|content|file|ph):/i.test(imageRef);
}

export function toShareableImageRefs(imageRefs: string[], fallback: string = DEFAULT_GIG_IMAGE_REF) {
  const shareableRefs = imageRefs.filter((imageRef) => imageRef && !isDeviceLocalImageRef(imageRef));
  return shareableRefs.length > 0 ? shareableRefs : [fallback];
}

export function toPublicAvatarRef(imageRef: string | null) {
  if (!imageRef || isDeviceLocalImageRef(imageRef)) {
    return null;
  }

  return imageRef;
}
