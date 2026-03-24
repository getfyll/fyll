import { Linking, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image-compression';

type UploadBusinessAttachmentInput = {
  businessId: string;
  folder: string;
  uri: string;
  fileName: string;
  mimeType?: string | null;
  compressImages?: boolean;
};

type UploadedBusinessAttachment = {
  storagePath: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
};

const sanitizeFileName = (fileName: string) => {
  const trimmed = fileName.trim();
  const safe = trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return safe || 'attachment';
};

const toJpegFileName = (fileName: string) => {
  const safe = sanitizeFileName(fileName);
  const dotIndex = safe.lastIndexOf('.');
  const base = dotIndex > 0 ? safe.slice(0, dotIndex) : safe;
  return `${base || 'attachment'}.jpg`;
};

const isImageUpload = (fileName: string, mimeType?: string | null) => {
  const normalizedMime = mimeType?.toLowerCase() ?? '';
  if (normalizedMime.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(fileName);
};

const isDirectUrl = (value: string) => /^(https?:|file:|blob:|data:)/i.test(value);

const openUrlDirectly = async (url: string) => {
  if (Platform.OS === 'web') {
    const webWindow = (globalThis as any)?.window;
    if (webWindow?.open) {
      webWindow.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
  }
  await Linking.openURL(url);
};

export const uploadBusinessAttachment = async ({
  businessId,
  folder,
  uri,
  fileName,
  mimeType = null,
  compressImages = true,
}: UploadBusinessAttachmentInput): Promise<UploadedBusinessAttachment> => {
  let uploadUri = uri;
  let uploadMimeType = mimeType;
  let uploadName = sanitizeFileName(fileName || 'attachment');

  if (compressImages && isImageUpload(uploadName, uploadMimeType)) {
    try {
      uploadUri = await compressImage(uploadUri, { maxDimension: 1600, quality: 0.72 });
      uploadMimeType = 'image/jpeg';
      uploadName = toJpegFileName(uploadName);
    } catch (error) {
      console.warn('Attachment image compression failed:', error);
    }
  }

  const response = await fetch(uploadUri);
  if (!response.ok) {
    throw new Error('Could not read selected attachment file.');
  }
  const blob = await response.blob();
  const resolvedMimeType = uploadMimeType ?? blob.type ?? undefined;
  const uniqueKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizedFolder = folder.replace(/^\/+|\/+$/g, '');
  const storagePath = `${businessId}/${normalizedFolder}/${uniqueKey}-${uploadName}`;

  const { error } = await supabase
    .storage
    .from('collaboration-attachments')
    .upload(storagePath, blob, {
      upsert: false,
      contentType: resolvedMimeType,
    });

  if (error) throw error;

  return {
    storagePath,
    fileName: uploadName,
    mimeType: resolvedMimeType,
    fileSize: blob.size || undefined,
  };
};

export const getSignedAttachmentUrl = async (pathOrUrl: string, expiresInSeconds = 60 * 10) => {
  const normalizedPath = pathOrUrl.trim();
  if (!normalizedPath) {
    throw new Error('Attachment path is empty.');
  }

  if (isDirectUrl(normalizedPath)) {
    return normalizedPath;
  }

  const { data, error } = await supabase
    .storage
    .from('collaboration-attachments')
    .createSignedUrl(normalizedPath.replace(/^\/+/, ''), expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw error || new Error('Could not create signed URL for attachment.');
  }

  return data.signedUrl;
};

export const openAttachmentPath = async (pathOrUrl: string, expiresInSeconds = 60 * 10) => {
  const normalizedPath = pathOrUrl.trim();
  if (!normalizedPath) return;

  if (Platform.OS !== 'web') {
    const url = await getSignedAttachmentUrl(normalizedPath, expiresInSeconds);
    await Linking.openURL(url);
    return;
  }

  const webWindow = (globalThis as any)?.window;
  let pendingWindow: any = null;
  if (webWindow?.open) {
    pendingWindow = webWindow.open('', '_blank', 'noopener,noreferrer');
  }

  try {
    const url = await getSignedAttachmentUrl(normalizedPath, expiresInSeconds);
    if (pendingWindow && typeof pendingWindow === 'object') {
      pendingWindow.location.href = url;
      return;
    }
    await openUrlDirectly(url);
  } catch (error) {
    if (pendingWindow && typeof pendingWindow.close === 'function') {
      pendingWindow.close();
    }
    throw error;
  }
};
