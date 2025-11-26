// hooks/useTokenMintFlow.ts
import { useState } from 'react';
import { TokenMetadata, MintConfig, LaunchType } from '@/types/token';
import { ProjectLinks } from '@/services/metadataUploadService';

export type MintFlowStep =
  | 'form'
  | 'upload-image'
  | 'upload-metadata'
  | 'review'
  | 'minting'
  | 'success';

interface MintFlowState {
  step: MintFlowStep;
  metadata: Partial<TokenMetadata>;
  imageFile?: File;
  projectLinks?: ProjectLinks; // Ensure this is in the state interface
  config?: MintConfig;
  launchType?: LaunchType;

  // Upload results
  imageIpfsUri?: string;
  metadataUri?: string;

  // Final result
  mintResult?: {
    mintAddress: string;
    signature: string;
    poolAddress?: string; // Added for Meteora support
  };
}

export function useTokenMintFlow() {
  const [flowState, setFlowState] = useState<MintFlowState>({
    step: 'form',
    metadata: {},
  });

  // ✅ FIXED: Added projectLinks as the 5th argument here
  const goToUploadImage = (
    metadata: TokenMetadata,
    config: MintConfig,
    launchType: LaunchType,
    imageFile?: File,
    projectLinks?: ProjectLinks
  ) => {
    setFlowState({
      ...flowState,
      step: 'upload-image',
      metadata,
      config,
      launchType,
      imageFile,
      projectLinks,
    });
  };

  const goToUploadMetadata = (imageIpfsUri?: string) => {
    setFlowState({
      ...flowState,
      step: 'upload-metadata',
      imageIpfsUri,
    });
  };

  const goToReview = (metadataUri: string) => {
    setFlowState({
      ...flowState,
      step: 'review',
      metadataUri,
    });
  };

  const goToMinting = () => {
    setFlowState({ ...flowState, step: 'minting' });
  };

  const goToSuccess = (mintResult: any) => {
    setFlowState({
      ...flowState,
      step: 'success',
      mintResult,
    });
  };

  const goBackToForm = () => {
    setFlowState({
      step: 'form',
      metadata: {},
    });
  };

  const goBackToImageUpload = () => {
    setFlowState({
      ...flowState,
      step: 'upload-image',
      imageIpfsUri: undefined,
    });
  };

  const goBackToMetadataUpload = () => {
    setFlowState({
      ...flowState,
      step: 'upload-metadata',
      metadataUri: undefined,
    });
  };

  return {
    flowState,
    goToUploadImage,
    goToUploadMetadata,
    goToReview,
    goToMinting,
    goToSuccess,
    goBackToForm,
    goBackToImageUpload,
    goBackToMetadataUpload,
  };
}