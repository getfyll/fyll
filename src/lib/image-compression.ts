import { Image, Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.7;

const getImageSize = (uri: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });

const compressWebDataUrl = async (
  dataUrl: string,
  maxDimension: number,
  quality: number
): Promise<string> => {
  if (typeof document === 'undefined') return dataUrl;
  if (!dataUrl.startsWith('data:image/')) return dataUrl;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = dataUrl;
  });

  const maxSide = Math.max(img.width, img.height);
  if (maxSide <= maxDimension) return dataUrl;

  const scale = maxDimension / maxSide;
  const targetWidth = Math.round(img.width * scale);
  const targetHeight = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/jpeg', quality);
};

export const compressImage = async (
  uriOrDataUrl: string,
  options?: { maxDimension?: number; quality?: number }
): Promise<string> => {
  if (!uriOrDataUrl) return uriOrDataUrl;

  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options?.quality ?? DEFAULT_QUALITY;

  try {
    if (Platform.OS === 'web') {
      return await compressWebDataUrl(uriOrDataUrl, maxDimension, quality);
    }

    const { width, height } = await getImageSize(uriOrDataUrl);
    const maxSide = Math.max(width, height);
    if (maxSide <= maxDimension) return uriOrDataUrl;

    const resize =
      width >= height ? { width: maxDimension } : { height: maxDimension };

    const result = await ImageManipulator.manipulateAsync(
      uriOrDataUrl,
      [{ resize }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );

    return result.uri;
  } catch (error) {
    console.warn('Image compression failed, using original image:', error);
    return uriOrDataUrl;
  }
};
