// components/ImageUploadStep.tsx
'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { uploadImageToIPFS } from '@/services/web3Storage';
import { TokenMetadata, MintConfig } from '@/types/token';
import { ProjectLinks } from '@/services/metadataUploadService';

interface ImageUploadStepProps {
  metadata: TokenMetadata;
  config: MintConfig;
  imageFile?: File;
  projectLinks?: ProjectLinks;
  onImageUploaded: (imageUri: string) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function ImageUploadStep({
  metadata,
  imageFile,
  onImageUploaded,
  onSkip,
  onBack,
}: ImageUploadStepProps) {
  const { publicKey, signMessage, connected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  // ✅ STEP 1: User clicks "Upload Image" button
  const handleUploadImage = async () => {
    if (!publicKey || !signMessage || !imageFile) {
      toast.error('Wallet not connected or no image selected');
      return;
    }

    setIsLoading(true);
    const uploadToast = toast.loading('📤 Uploading image to IPFS...');

    try {
      console.log('📷 STEP 1: User initiates image upload');
      console.log(`📁 File: ${imageFile.name} (${(imageFile.size / 1024).toFixed(1)}KB)`);

      const imageUri = await uploadImageToIPFS(
        imageFile,
        signMessage,
        publicKey.toBase58()
      );

      console.log(`✅ Image uploaded to IPFS: ${imageUri}`);
      toast.success('✅ Image uploaded to IPFS!', { id: uploadToast });

      // Move to next step with image URI
      onImageUploaded(imageUri);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Upload failed';
      console.error('❌ Image upload error:', error);
      toast.error(`Image upload failed: ${msg}`, { id: uploadToast, duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ User can skip image and go straight to metadata
  const handleSkipImage = () => {
    console.log('⏭️  User skipping image upload');
    onSkip();
  };

  return (
    <div className="space-y-6 p-6 bg-dark-50 rounded-lg border border-primary-500/30">
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">Step 1: Upload Image</h3>
        <p className="text-sm text-gray-400">Optional but recommended for better token visibility</p>
      </div>

      {imageFile ? (
        <div className="space-y-4">
          {/* Image Preview */}
          <div className="bg-dark-100 p-4 rounded border border-dark-300 overflow-hidden">
            <img
              src={URL.createObjectURL(imageFile)}
              alt="Token image preview"
              className="w-full h-48 object-cover rounded"
            />
          </div>

          {/* File Info */}
          <div className="bg-dark-100 p-3 rounded border border-dark-300">
            <p className="text-sm text-gray-300">
              <span className="font-medium">File:</span> {imageFile.name}
            </p>
            <p className="text-sm text-gray-400">
              <span className="font-medium">Size:</span> {(imageFile.size / 1024).toFixed(1)}KB
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Your wallet will be asked to sign this upload to verify ownership.
            </p>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUploadImage}
            disabled={isLoading || !connected}
            className="w-full py-3 rounded font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? '⏳ Uploading...' : '✅ Upload Image (Sign with Wallet)'}
          </button>

          {/* Skip Button */}
          <button
            onClick={handleSkipImage}
            disabled={isLoading}
            className="w-full py-3 rounded font-bold border border-primary-500/30 text-primary-500 hover:bg-primary-500/10 disabled:opacity-50 transition-all"
          >
            Skip Image, Go to Metadata
          </button>
        </div>
      ) : (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-400 text-sm">
            No image selected in token form. You can proceed to metadata upload without an image.
          </p>
          <button
            onClick={handleSkipImage}
            className="mt-3 w-full py-2 rounded font-bold bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-all"
          >
            Continue to Metadata
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4 border-t border-primary-500/30">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 py-3 rounded font-bold border border-primary-500/30 text-primary-500 hover:bg-primary-500/10 disabled:opacity-50 transition-all"
        >
          ← Back to Form
        </button>
      </div>
    </div>
  );
}