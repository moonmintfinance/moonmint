'use client';

import { useState, useEffect, useRef } from 'react';
import { TokenMetadata, MintConfig } from '@/types/token';
import { sanitizeInput } from '@/utils/validation';
import { SERVICE_FEE_BASE_SOL, SERVICE_FEE_AUTHORITY_SOL, METEORA_CONFIG } from '@/lib/constants';
import { uploadImageToIPFS } from '@/services/web3Storage';
import { toast } from 'react-hot-toast';

interface TokenFormProps {
  onSubmit: (
    metadata: TokenMetadata,
    config: MintConfig,
    launchType: LaunchType,
    meteoraConfig?: { enableFirstBuy: boolean; initialBuyAmount: number }
  ) => void;
  isLoading: boolean;
  isWalletConnected: boolean;
}

export enum LaunchType {
  DIRECT = 'direct',
  METEORA = 'meteora',
}

interface FeeBreakdownProps {
  config: MintConfig;
  launchType: LaunchType;
  meteoraConfig: { enableFirstBuy: boolean; initialBuyAmount: number };
}

function FeeBreakdown({ config, launchType, meteoraConfig }: FeeBreakdownProps) {
  if (launchType === LaunchType.METEORA) {
    const meteoraBaseFee = 0.00;
    const firstBuyFee = meteoraConfig.enableFirstBuy ? meteoraConfig.initialBuyAmount : 0;
    const totalFee = meteoraBaseFee + firstBuyFee;

    return (
      <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
        <div className="text-sm">
          <div className="font-medium text-primary-400 mb-3">Fee Breakdown</div>
          <div className="space-y-2 text-gray-400 text-sm">
            <div className="flex justify-between">
              <span>Pool creation fee:</span>
              <span className="font-medium">{meteoraBaseFee.toFixed(2)} SOL</span>
            </div>
            {meteoraConfig.enableFirstBuy && (
              <div className="flex justify-between">
                <span>First buy amount:</span>
                <span className="font-medium">{firstBuyFee.toFixed(2)} SOL</span>
              </div>
            )}
            <div className="flex justify-between border-t border-primary-500/20 pt-2 mt-2">
              <span className="font-semibold">Total fee:</span>
              <span className="font-bold text-primary-300">
                {totalFee.toFixed(2)} SOL
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Direct Token 2022 fees
  const baseFee = SERVICE_FEE_BASE_SOL;
  const authorityFee = SERVICE_FEE_AUTHORITY_SOL;
  const authoritiesCost =
    (config.mintAuthority ? 1 : 0) + (config.freezeAuthority ? 1 : 0);
  const authoritiesFeeTotal = authoritiesCost * authorityFee;
  const totalFee = baseFee + authoritiesFeeTotal;

  return (
    <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
      <div className="text-sm">
        <div className="font-medium text-primary-400 mb-3">Fee Breakdown</div>
        <div className="space-y-2 text-gray-400 text-sm">
          <div className="flex justify-between">
            <span>Base minting fee:</span>
            <span className="font-medium">{baseFee.toFixed(2)} SOL</span>
          </div>
          {config.mintAuthority && (
            <div className="flex justify-between">
              <span>Revoke mint authority:</span>
              <span className="font-medium">+{authorityFee.toFixed(2)} SOL</span>
            </div>
          )}
          {config.freezeAuthority && (
            <div className="flex justify-between">
              <span>Revoke freeze authority:</span>
              <span className="font-medium">+{authorityFee.toFixed(2)} SOL</span>
            </div>
          )}
          <div className="flex justify-between border-t border-primary-500/20 pt-2 mt-2">
            <span className="font-semibold">Total fee:</span>
            <span className="font-bold text-primary-300">
              {totalFee.toFixed(2)} SOL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TokenForm({
  onSubmit,
  isLoading,
  isWalletConnected,
}: TokenFormProps) {
  const [formData, setFormData] = useState<TokenMetadata>({
    name: '',
    symbol: '',
    decimals: 9,
    initialSupply: 1000000,
    description: '',
    imageUrl: '',
  });

  const [config, setConfig] = useState<MintConfig>({
    freezeAuthority: false,
    mintAuthority: false,
  });

  const [launchType, setLaunchType] = useState<LaunchType>(LaunchType.METEORA);
  const [meteoraConfig, setMeteoraConfig] = useState({
    enableFirstBuy: false,
    initialBuyAmount: 0.1,
  });

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-configure decimals and supply for Meteora
  useEffect(() => {
    if (launchType === LaunchType.METEORA) {
      setFormData((prev) => ({
        ...prev,
        decimals: 6, // Meteora standard
        initialSupply: 1000000000, // 1 billion tokens
      }));
    }
  }, [launchType]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate file size (e.g. max 4MB)
      if (file.size > 4 * 1024 * 1024) {
        toast.error('File size must be less than 4MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('File must be an image');
        return;
      }

      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleMintAuthorityChange = (checked: boolean) => {
    setConfig((prev) => ({
      ...prev,
      mintAuthority: checked,
    }));
  };

  const handleFreezeAuthorityChange = (checked: boolean) => {
    setConfig((prev) => ({
      ...prev,
      freezeAuthority: checked,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWalletConnected) return;

    let finalImageUrl = formData.imageUrl;

    // Upload image if a file was selected
    if (imageFile) {
      setIsUploading(true);
      const loadingToast = toast.loading('Uploading image to Web3.Storage...');

      try {
        finalImageUrl = await uploadImageToIPFS(imageFile);
        toast.success('Image uploaded successfully!', { id: loadingToast });
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error('Failed to upload image. Please try again.', { id: loadingToast });
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const sanitizedMetadata: TokenMetadata = {
      ...formData,
      name: sanitizeInput(formData.name),
      symbol: sanitizeInput(formData.symbol).toUpperCase(),
      description: formData.description
        ? sanitizeInput(formData.description)
        : undefined,
      imageUrl: finalImageUrl,
    };

    onSubmit(
      sanitizedMetadata,
      config,
      launchType,
      launchType === LaunchType.METEORA ? meteoraConfig : undefined
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 rounded-xl p-8 space-y-6"
    >
      {/* Launch Type Selection */}
      {METEORA_CONFIG.ENABLED && (
        <div className="space-y-4 pb-6 border-b border-dark-200">
          <div className="text-sm font-semibold text-primary-400">
            Launch Type
          </div>

          <div className="space-y-3">
            <label className="flex items-start space-x-3 cursor-pointer p-4 rounded-lg border border-dark-300 hover:border-primary-500/50 transition-colors">
              <input
                type="radio"
                checked={launchType === LaunchType.DIRECT}
                onChange={() => setLaunchType(LaunchType.DIRECT)}
                className="w-5 h-5 text-primary-500 mt-0.5"
                disabled={isLoading || isUploading || !isWalletConnected}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-300 mb-1">
                  Direct Token 2022 Launch
                </div>
                <p className="text-xs text-gray-400">
                  Create token directly on-chain with fixed supply
                </p>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer p-4 rounded-lg border border-dark-300 hover:border-primary-500/50 transition-colors">
              <input
                type="radio"
                checked={launchType === LaunchType.METEORA}
                onChange={() => setLaunchType(LaunchType.METEORA)}
                className="w-5 h-5 text-primary-500 mt-0.5"
                disabled={isLoading || isUploading || !isWalletConnected}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-300 mb-1">
                  Moon Mint Bonding Curve
                </div>
                <p className="text-xs text-gray-400">
                  Launch with no fees and instant liquidity on the Moon Mint bonding curve, powered by Meteora
                </p>
              </div>
            </label>

            {launchType === LaunchType.METEORA && (
              <div className="ml-8 space-y-4 bg-primary-500/5 p-4 rounded-lg border border-primary-500/20">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={meteoraConfig.enableFirstBuy}
                    onChange={(e) => setMeteoraConfig({
                      ...meteoraConfig,
                      enableFirstBuy: e.target.checked
                    })}
                    className="w-5 h-5 rounded border-dark-300 text-primary-500"
                    disabled={isLoading || isUploading || !isWalletConnected}
                  />
                  <div className="text-sm font-medium text-gray-300">
                    Enable First Buy
                  </div>
                </label>

                {meteoraConfig.enableFirstBuy && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Initial Buy Amount (SOL)
                    </label>
                    <input
                      type="number"
                      value={meteoraConfig.initialBuyAmount}
                      onChange={(e) => setMeteoraConfig({
                        ...meteoraConfig,
                        initialBuyAmount: parseFloat(e.target.value) || 0
                      })}
                      min={0}
                      step={0.01}
                      className="w-full bg-dark-50 border border-dark-300 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={isLoading || isUploading || !isWalletConnected}
                      placeholder="0.1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Automatically purchase tokens after pool creation
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Upload */}
      <div>
        <label
          className="block text-sm font-medium mb-3 text-gray-300"
          htmlFor="imageUpload"
        >
          Token Icon <span className="text-gray-500">(Optional)</span>
        </label>

        <div className="flex items-start gap-4">
          {/* Preview Box */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-lg border border-dark-300 bg-dark-50 overflow-hidden flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
          </div>

          {/* File Input */}
          <div className="flex-1">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              disabled={isLoading || isUploading || !isWalletConnected}
            />
            <label
              htmlFor="file-upload"
              className="inline-block bg-dark-200 hover:bg-dark-300 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium border border-dark-300"
            >
              Choose File
            </label>
            <p className="text-xs text-gray-500 mt-2">
              Supported: JPG, PNG, GIF. Max 4MB.
              <br />
              <span className="text-primary-400">Uploaded to IPFS via Web3.Storage for immutability</span>
            </p>
          </div>
        </div>
      </div>

      {/* Token Name */}
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-300" htmlFor="name">
          Token Name <span className="text-red-400">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., My Token"
          className="w-full bg-dark-50 border border-dark-300 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          required
          maxLength={32}
          disabled={isLoading || isUploading || !isWalletConnected}
        />
        <p className="text-xs text-gray-500 mt-1">Maximum 32 characters</p>
      </div>

      {/* Token Symbol */}
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-300" htmlFor="symbol">
          Token Symbol <span className="text-red-400">*</span>
        </label>
        <input
          id="symbol"
          type="text"
          value={formData.symbol}
          onChange={(e) =>
            setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
          }
          placeholder="e.g., MTK"
          className="w-full bg-dark-50 border border-dark-300 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all uppercase"
          required
          maxLength={10}
          disabled={isLoading || isUploading || !isWalletConnected}
        />
        <p className="text-xs text-gray-500 mt-1">Maximum 10 characters</p>
      </div>

      {/* Decimals and Initial Supply - Only for Direct Launch */}
      {launchType === LaunchType.DIRECT && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300" htmlFor="decimals">
              Decimals <span className="text-red-400">*</span>
            </label>
            <input
              id="decimals"
              type="number"
              value={formData.decimals}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  decimals: parseInt(e.target.value) || 0,
                })
              }
              min={0}
              max={9}
              className="w-full bg-dark-50 border border-dark-300 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              required
              disabled={isLoading || isUploading || !isWalletConnected}
            />
            <p className="text-xs text-gray-500 mt-1">Standard is 9</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300" htmlFor="supply">
              Initial Supply <span className="text-red-400">*</span>
            </label>
            <input
              id="supply"
              type="number"
              value={formData.initialSupply}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  initialSupply: parseInt(e.target.value) || 0,
                })
              }
              min={0}
              className="w-full bg-dark-50 border border-dark-300 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              required
              disabled={isLoading || isUploading || !isWalletConnected}
            />
            <p className="text-xs text-gray-500 mt-1">Number of tokens</p>
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-300" htmlFor="description">
          Description <span className="text-gray-500">(Optional)</span>
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Describe your token..."
          className="w-full bg-dark-50 border border-dark-300 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
          rows={3}
          maxLength={200}
          disabled={isLoading || isUploading || !isWalletConnected}
        />
      </div>

      {/* Authorities (only for Direct launch) */}
      {launchType === LaunchType.DIRECT && (
        <div className="space-y-4 border-t border-dark-200 pt-6">
          <div className="text-sm font-semibold text-primary-400 mb-4">
            Token Authorities
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={config.mintAuthority}
                  onChange={(e) => handleMintAuthorityChange(e.target.checked)}
                  className="w-5 h-5 rounded border-dark-300 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  disabled={isLoading || isUploading || !isWalletConnected}
                />
                <div className="text-sm font-medium text-gray-300">
                  Revoke Mint Authority
                </div>
              </label>
              <span className="text-xs text-primary-400 font-medium">
                Fee: {SERVICE_FEE_AUTHORITY_SOL.toFixed(1)} SOL
              </span>
            </div>
            <p className="text-xs text-gray-400 ml-8">
              No new additional tokens can be minted.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={config.freezeAuthority}
                  onChange={(e) => handleFreezeAuthorityChange(e.target.checked)}
                  className="w-5 h-5 rounded border-dark-300 text-primary-500 focus:ring-2 focus:ring-primary-500"
                  disabled={isLoading || isUploading || !isWalletConnected}
                />
                <div className="text-sm font-medium text-gray-300">
                  Revoke Freeze Authority
                </div>
              </label>
              <span className="text-xs text-primary-400 font-medium">
                Fee: {SERVICE_FEE_AUTHORITY_SOL.toFixed(1)} SOL
              </span>
            </div>
            <p className="text-xs text-gray-400 ml-8">
              Revoke your right to freeze token transfers and transactions.
            </p>
          </div>
        </div>
      )}

      {/* Meteora-specific info */}
      {launchType === LaunchType.METEORA && (
        <div className="bg-primary-500/10 border border-primary-500/20 rounded-lg p-4 border-t border-dark-200 pt-6">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="font-semibold text-primary-300 text-sm mb-2">
                About Token Authorities
              </div>
              <p className="text-xs text-gray-300 mb-3">
                On our bonding curves, your token is created with standard authorities.
                This ensures a fair and transparent launch for all participants.
              </p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>✓ Mint authority revoked: No one can mint additional tokens</li>
                <li>✓ Freeze authority revoked: No one can tamper with transactions</li>
                <li>✓ Update authority revoked: No one can change the tokens metadata</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Fee Breakdown */}
      <FeeBreakdown config={config} launchType={launchType} meteoraConfig={meteoraConfig} />

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || isUploading || !isWalletConnected}
        className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
      >
        {isLoading || isUploading ? (
          <span className="flex items-center justify-center space-x-2">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>
              {isUploading ? 'Uploading to IPFS...' : (launchType === LaunchType.METEORA ? 'Launching on Meteora...' : 'Creating Token...')}
            </span>
          </span>
        ) : !isWalletConnected ? (
          'Connect Wallet to Create Token'
        ) : (
          launchType === LaunchType.METEORA ? 'Launch on Moon Mint' : 'Create Token'
        )}
      </button>
    </form>
  );
}