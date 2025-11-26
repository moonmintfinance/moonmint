// components/MetadataUploadStep.tsx
'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { uploadMetadataJson, ProjectLinks, validateMetadataJson } from '@/services/metadataUploadService';
import { TokenMetadata } from '@/types/token';

interface MetadataUploadStepProps {
  metadata: TokenMetadata;
  imageIpfsUri?: string;
  projectLinks?: ProjectLinks;
  onMetadataUploaded: (metadataUri: string) => void;
  onBack: () => void;
}

export function MetadataUploadStep({
  metadata,
  imageIpfsUri,
  projectLinks,
  onMetadataUploaded,
  onBack,
}: MetadataUploadStepProps) {
  const { publicKey, signMessage, connected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  // ✅ STEP 2: User clicks "Create Metadata" button
  const handleUploadMetadata = async () => {
    if (!publicKey || !signMessage || !connected) {
      toast.error('Wallet not connected');
      return;
    }

    // Validate metadata before upload
    const validation = validateMetadataJson(metadata, imageIpfsUri, projectLinks);
    if (!validation.valid) {
      validation.errors.forEach((error) => toast.error(error));
      return;
    }

    setIsLoading(true);
    const uploadToast = toast.loading('📝 Creating metadata JSON...');

    try {
      console.log('📝 STEP 2: User initiates metadata upload');
      console.log(`Token: ${metadata.name} (${metadata.symbol})`);
      if (imageIpfsUri) {
        console.log(`Image IPFS: ${imageIpfsUri}`);
      }
      if (projectLinks && Object.keys(projectLinks).length > 0) {
        console.log(`Social links: ${Object.keys(projectLinks).length}`);
      }

      const metadataUri = await uploadMetadataJson(
        metadata,
        imageIpfsUri,
        projectLinks,
        signMessage,
        publicKey.toBase58()
      );

      console.log(`✅ Metadata created on IPFS: ${metadataUri}`);
      toast.success('✅ Metadata created on IPFS!', { id: uploadToast });

      // Move to review step with metadata URI
      onMetadataUploaded(metadataUri);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Creation failed';
      console.error('❌ Metadata creation error:', error);
      toast.error(`Metadata creation failed: ${msg}`, { id: uploadToast, duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-dark-50 rounded-lg border border-primary-500/30">
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">Step 2: Create Metadata</h3>
        <p className="text-sm text-gray-400">Metadata JSON will be created and stored on IPFS</p>
      </div>

      {/* Metadata Preview */}
      <div className="bg-dark-100 p-4 rounded border border-dark-300 space-y-3">
        <div className="border-b border-dark-300 pb-3">
          <p className="text-xs text-gray-400">Token Info</p>
          <div className="mt-2 space-y-1 text-sm">
            <p>
              <span className="text-gray-400">Name:</span>{' '}
              <span className="text-primary-400 font-mono">{metadata.name}</span>
            </p>
            <p>
              <span className="text-gray-400">Symbol:</span>{' '}
              <span className="text-primary-400 font-mono">{metadata.symbol}</span>
            </p>
            <p>
              <span className="text-gray-400">Decimals:</span>{' '}
              <span className="text-primary-400 font-mono">{metadata.decimals || 9}</span>
            </p>
          </div>
        </div>

        {imageIpfsUri && (
          <div className="border-b border-dark-300 pb-3">
            <p className="text-xs text-gray-400">Image (from Step 1)</p>
            <p className="text-xs text-primary-400 font-mono break-all mt-1">{imageIpfsUri}</p>
          </div>
        )}

        {projectLinks && Object.keys(projectLinks).length > 0 && (
          <div>
            <p className="text-xs text-gray-400">🔗 Social Links</p>
            <div className="mt-2 space-y-1 text-xs">
              {projectLinks.x && (
                <p>
                  <span className="text-gray-500">X:</span>{' '}
                  <span className="text-primary-400 break-all">{projectLinks.x}</span>
                </p>
              )}
              {projectLinks.telegram && (
                <p>
                  <span className="text-gray-500">Telegram:</span>{' '}
                  <span className="text-primary-400 break-all">{projectLinks.telegram}</span>
                </p>
              )}
              {projectLinks.discord && (
                <p>
                  <span className="text-gray-500">Discord:</span>{' '}
                  <span className="text-primary-400 break-all">{projectLinks.discord}</span>
                </p>
              )}
              {projectLinks.website && (
                <p>
                  <span className="text-gray-500">Website:</span>{' '}
                  <span className="text-primary-400 break-all">{projectLinks.website}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Metadata Button */}
      <button
        onClick={handleUploadMetadata}
        disabled={isLoading || !connected}
        className="w-full py-3 rounded font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? '⏳ Creating Metadata...' : '✅ Create Metadata (Sign with Wallet)'}
      </button>

      {/* Navigation */}
      <div className="flex gap-3 pt-4 border-t border-primary-500/30">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 py-3 rounded font-bold border border-primary-500/30 text-primary-500 hover:bg-primary-500/10 disabled:opacity-50 transition-all"
        >
          ← Back to Image Upload
        </button>
      </div>
    </div>
  );
}