import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PdfViewer } from '@/components/PdfViewer';

export default function PdfViewerScreen() {
  const router = useRouter();
  const { uri, fileName } = useLocalSearchParams<{ uri: string; fileName?: string }>();

  const handleClose = () => {
    router.back();
  };

  if (!uri) {
    // If no URI provided, go back
    handleClose();
    return null;
  }

  return (
    <PdfViewer
      uri={decodeURIComponent(uri)}
      fileName={fileName ? decodeURIComponent(fileName) : undefined}
      onClose={handleClose}
    />
  );
}
