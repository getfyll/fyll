import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image-compression';
import type { RefundRequestAttachment } from '@/lib/state/fyll-store';
import { openAttachmentPath } from '@/lib/storage-attachments';

export type RefundRequestAttachmentDraft = {
  id: string;
  fileName: string;
  localUri?: string;
  storagePath?: string;
  mimeType?: string | null;
  fileSize?: number | null;
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

export const uploadRefundRequestAttachments = async (
  businessId: string,
  assets: RefundRequestAttachmentDraft[],
  source: 'finance' | 'order' = 'finance'
): Promise<RefundRequestAttachment[]> => {
  return Promise.all(assets.map(async (asset) => {
    if (!asset.localUri && asset.storagePath) {
      return {
        id: asset.id,
        fileName: asset.fileName,
        storagePath: asset.storagePath,
        mimeType: asset.mimeType ?? undefined,
        fileSize: asset.fileSize ?? undefined,
      };
    }

    if (!asset.localUri) {
      throw new Error('Missing local attachment uri');
    }

    let uploadUri = asset.localUri;
    let uploadMime = asset.mimeType ?? null;
    let uploadName = sanitizeFileName(asset.fileName || 'refund-screenshot');

    if (isImageUpload(uploadName, uploadMime)) {
      uploadUri = await compressImage(uploadUri, { maxDimension: 1600, quality: 0.72 });
      uploadMime = 'image/jpeg';
      uploadName = toJpegFileName(uploadName);
    }

    const uniqueKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `${businessId}/refund-requests/${source}/${uniqueKey}-${uploadName}`;
    const response = await fetch(uploadUri);
    if (!response.ok) {
      throw new Error('Could not read selected refund attachment');
    }
    const blob = await response.blob();
    const resolvedMime = uploadMime ?? blob.type ?? undefined;

    const { error } = await supabase
      .storage
      .from('collaboration-attachments')
      .upload(storagePath, blob, {
        upsert: false,
        contentType: resolvedMime,
      });

    if (error) throw error;

    return {
      id: asset.id,
      fileName: uploadName,
      storagePath,
      mimeType: resolvedMime,
      fileSize: blob.size || asset.fileSize || undefined,
    };
  }));
};

export const openRefundRequestAttachment = async (storagePath: string) => {
  await openAttachmentPath(storagePath, 60 * 10);
};
