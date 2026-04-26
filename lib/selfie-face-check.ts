import { Platform } from 'react-native';
import type { FaceCheckResult } from 'expo-face-check';

type SelfieFaceCheckStatus = FaceCheckResult['status'] | 'UNSUPPORTED';

type BrowserFaceDetector = {
  detect: (source: HTMLImageElement) => Promise<Array<unknown>>;
};

type BrowserFaceDetectorConstructor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => BrowserFaceDetector;

type BrowserFaceDetectorGlobal = typeof globalThis & {
  FaceDetector?: BrowserFaceDetectorConstructor;
};

type BlazeFaceModelLike = {
  estimateFaces: (
    input: HTMLImageElement,
    returnTensors?: false,
    flipHorizontal?: boolean,
    annotateBoxes?: boolean,
  ) => Promise<Array<unknown>>;
};

export type SelfieFaceCheckResult = {
  faceCount: number;
  status: SelfieFaceCheckStatus;
};

const MIN_SELFIE_PIXELS = 100_000;
let blazeFaceModelPromise: Promise<BlazeFaceModelLike> | null = null;

function loadBrowserImage(uri: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Selfie image could not be loaded.'));
    image.src = uri;
  });
}

async function checkBrowserFace(uri: string): Promise<SelfieFaceCheckResult> {
  const FaceDetectorConstructor = (globalThis as BrowserFaceDetectorGlobal).FaceDetector;

  if (typeof Image === 'undefined') {
    return { faceCount: 0, status: 'UNSUPPORTED' };
  }

  const image = await loadBrowserImage(uri);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (width * height < MIN_SELFIE_PIXELS) {
    return { faceCount: 0, status: 'LOW_QUALITY' };
  }

  if (FaceDetectorConstructor) {
    try {
      return countBrowserFaces(await new FaceDetectorConstructor({ fastMode: true, maxDetectedFaces: 3 }).detect(image));
    } catch {
      // Fall through to the TensorFlow.js detector when the browser API exists but fails.
    }
  }

  try {
    return countBrowserFaces(await detectFacesWithBlazeFace(image));
  } catch {
    return { faceCount: 0, status: 'UNSUPPORTED' };
  }
}

function countBrowserFaces(faces: Array<unknown>): SelfieFaceCheckResult {
  if (faces.length === 0) {
    return { faceCount: 0, status: 'NO_FACE' };
  }

  if (faces.length > 1) {
    return { faceCount: faces.length, status: 'MULTIPLE_FACES' };
  }

  return { faceCount: 1, status: 'READY' };
}

async function detectFacesWithBlazeFace(image: HTMLImageElement) {
  const model = await loadBlazeFaceModel();
  return model.estimateFaces(image, false, false, false);
}

function loadBlazeFaceModel() {
  blazeFaceModelPromise ??= (async () => {
    await Promise.all([
      import('@tensorflow/tfjs-backend-webgl'),
      import('@tensorflow/tfjs-backend-cpu'),
    ]);

    const tf = await import('@tensorflow/tfjs-core');

    try {
      await tf.setBackend('webgl');
    } catch {
      await tf.setBackend('cpu');
    }

    await tf.ready();

    const blazeface = await import('@tensorflow-models/blazeface');
    return blazeface.load({ maxFaces: 3, scoreThreshold: 0.75 });
  })();

  return blazeFaceModelPromise;
}

export async function checkSelfieForSingleFace(uri: string): Promise<SelfieFaceCheckResult> {
  if (Platform.OS === 'web') {
    return checkBrowserFace(uri);
  }

  const { checkFace } = await import('expo-face-check');
  return checkFace(uri, { minPixelSize: MIN_SELFIE_PIXELS });
}
