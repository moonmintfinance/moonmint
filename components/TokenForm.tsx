'use client';

import { useState, useEffect, useRef } from 'react';
import { TokenMetadata, MintConfig } from '@/types/token';
import { ProjectLinks } from '@/services/metadataUploadService';
import { sanitizeInput } from '@/utils/validation';
import { SERVICE_FEE_BASE_SOL, SERVICE_FEE_AUTHORITY_SOL, METEORA_CONFIG } from '@/lib/constants';
import { uploadImageToIPFS } from '@/services/web3Storage';
import { toast } from 'react-hot-toast';
// Imports for brand icons
import { FaTelegram, FaDiscord, FaGlobe } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

interface TokenFormProps {
  onSubmit: (
    metadata: TokenMetadata,
    config: MintConfig,
    launchType: LaunchType,
    meteoraConfig?: { enableFirstBuy: boolean; initialBuyAmount: number },
    imageFile?: File | null,
    projectLinks?: ProjectLinks
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
    imageUrl: '',
  });

  const [projectLinks, setProjectLinks] = useState<ProjectLinks>({
    x: '',
    telegram: '',
    discord: '',
    website: '',
  });

  const [showProjectLinks, setShowProjectLinks] = useState(false);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-configure decimals and supply for Meteora
  useEffect(() => {
    if (launchType === LaunchType.METEORA) {
      setFormData((prev) => ({
        ...prev,
        decimals: 6,
        initialSupply: 1000000000,
      }));
    }
  }, [launchType]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate file size (max 4MB)
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

  const handleProjectLinkChange = (key: keyof ProjectLinks, value: string) => {
    setProjectLinks((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWalletConnected) return;

    const sanitizedMetadata: TokenMetadata = {
      ...formData,
      name: sanitizeInput(formData.name),
      symbol: sanitizeInput(formData.symbol).toUpperCase(),
      imageUrl: formData.imageUrl,
    };

    // Clean up project links (remove empty strings)
    const cleanProjectLinks: ProjectLinks = {};
    if (projectLinks.x?.trim()) cleanProjectLinks.x = projectLinks.x.trim();
    if (projectLinks.telegram?.trim()) cleanProjectLinks.telegram = projectLinks.telegram.trim();
    if (projectLinks.discord?.trim()) cleanProjectLinks.discord = projectLinks.discord.trim();
    if (projectLinks.website?.trim()) cleanProjectLinks.website = projectLinks.website.trim();

    onSubmit(
      sanitizedMetadata,
      config,
      launchType,
      launchType === LaunchType.METEORA ? meteoraConfig : undefined,
      imageFile,
      Object.keys(cleanProjectLinks).length > 0 ? cleanProjectLinks : undefined
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 rounded-xl p-8 space-y-6"
    >
      {/* Launch Type Selection */}
      <div>
        <label className="block text-sm font-medium mb-3 text-gray-300">
          Launch Type <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setLaunchType(LaunchType.METEORA)}
            className={`p-4 rounded-lg border-2 transition-all ${
              launchType === LaunchType.METEORA
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-dark-300 bg-dark-50 hover:border-dark-200'
            }`}
            disabled={isLoading || !isWalletConnected}
          >
            <div className="font-medium text-white mb-1">Chad Mint Bonding Curve</div>
            <div className="text-xs text-gray-400">Instant trading and liquidity</div>
          </button>
          <button
            type="button"
            onClick={() => setLaunchType(LaunchType.DIRECT)}
            className={`p-4 rounded-lg border-2 transition-all ${
              launchType === LaunchType.DIRECT
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-dark-300 bg-dark-50 hover:border-dark-200'
            }`}
            disabled={isLoading || !isWalletConnected}
          >
            <div className="font-medium text-white mb-1">Direct Token 2022</div>
            <div className="text-xs text-gray-400">Receive all tokens and customize authorities</div>
          </button>
        </div>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium mb-3 text-gray-300">
          Token Image (Optional)
        </label>
        <div className="flex gap-4">
          <div className="flex-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-3 border-2 border-dashed border-dark-300 rounded-lg hover:border-primary-500 transition-colors text-gray-300 hover:text-primary-400"
              disabled={isLoading || !isWalletConnected}
            >
              {imageFile ? '✓ Image selected' : 'Click to upload or drag image'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isLoading || !isWalletConnected}
            />
          </div>
          {previewUrl && (
            <div className="relative">
              <img
                src={previewUrl}
                alt="Token preview"
                className="w-20 h-20 rounded-lg object-cover border border-dark-300"
              />
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  setPreviewUrl(null);
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
          )}
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
          disabled={isLoading || !isWalletConnected}
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
          disabled={isLoading || !isWalletConnected}
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
              disabled={isLoading || !isWalletConnected}
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
              disabled={isLoading || !isWalletConnected}
            />
            <p className="text-xs text-gray-500 mt-1">Number of tokens</p>
          </div>
        </div>
      )}

      {/* Project Links - Collapsible Section */}
      <div className="border-t border-dark-200 pt-6">
        <button
          type="button"
          onClick={() => setShowProjectLinks(!showProjectLinks)}
          className="flex items-center justify-between w-full text-left"
          disabled={isLoading || !isWalletConnected}
        >
          <span className="text-sm font-semibold text-primary-400">
            🔗 Project Links (Optional)
          </span>
          <span className="text-primary-400">
            {showProjectLinks ? '▼' : '▶'}
          </span>
        </button>

        {showProjectLinks && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-gray-400 mb-4">
              Add links to your project's social media and website. These will be included in your token metadata.
            </p>

            {/* X/Twitter */}
            <div>
              <label className="flex items-center text-sm font-medium mb-2 text-gray-300" htmlFor="twitter">
                <FaXTwitter className="w-4 h-4 mr-2" />
                Twitter
              </label>
              <input
                id="twitter"
                type="url"
                value={projectLinks.x || ''}
                onChange={(e) => handleProjectLinkChange('x', e.target.value)}
                placeholder="https://x.com/yourproject"
                className="w-full bg-dark-50 border border-dark-300 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
                disabled={isLoading || !isWalletConnected}
              />
            </div>

            {/* Telegram */}
            <div>
              <label className="flex items-center text-sm font-medium mb-2 text-gray-300" htmlFor="telegram">
                <FaTelegram className="w-4 h-4 mr-2" />
                Telegram
              </label>
              <input
                id="telegram"
                type="url"
                value={projectLinks.telegram || ''}
                onChange={(e) => handleProjectLinkChange('telegram', e.target.value)}
                placeholder="https://t.me/yourproject"
                className="w-full bg-dark-50 border border-dark-300 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
                disabled={isLoading || !isWalletConnected}
              />
            </div>

            {/* Discord */}
            <div>
              <label className="flex items-center text-sm font-medium mb-2 text-gray-300" htmlFor="discord">
                <FaDiscord className="w-4 h-4 mr-2" />
                Discord
              </label>
              <input
                id="discord"
                type="url"
                value={projectLinks.discord || ''}
                onChange={(e) => handleProjectLinkChange('discord', e.target.value)}
                placeholder="https://discord.gg/yourserver"
                className="w-full bg-dark-50 border border-dark-300 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
                disabled={isLoading || !isWalletConnected}
              />
            </div>

            {/* Website */}
            <div>
              <label className="flex items-center text-sm font-medium mb-2 text-gray-300" htmlFor="website">
                <FaGlobe className="w-4 h-4 mr-2" />
                Website
              </label>
              <input
                id="website"
                type="url"
                value={projectLinks.website || ''}
                onChange={(e) => handleProjectLinkChange('website', e.target.value)}
                placeholder="https://yourproject.com"
                className="w-full bg-dark-50 border border-dark-300 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
                disabled={isLoading || !isWalletConnected}
              />
            </div>
          </div>
        )}
      </div>

      {/* Meteora First Buy Option */}
      {launchType === LaunchType.METEORA && (
        <div className="bg-primary-500/10 border border-primary-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={meteoraConfig.enableFirstBuy}
                  onChange={(e) =>
                    setMeteoraConfig({
                      ...meteoraConfig,
                      enableFirstBuy: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-dark-300 text-primary-500"
                  disabled={isLoading || !isWalletConnected}
                />
                <span className="font-semibold text-primary-300 text-sm">
                  Enable First Buy
                </span>
              </label>
              <p className="text-xs text-gray-400 mt-2">
                Automatically buy tokens when the pool launches (costs additional SOL)
              </p>
            </div>
          </div>
          {meteoraConfig.enableFirstBuy && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                First Buy Amount (SOL)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={meteoraConfig.initialBuyAmount}
                onChange={(e) =>
                  setMeteoraConfig({
                    ...meteoraConfig,
                    initialBuyAmount: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full bg-dark-50 border border-dark-300 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                disabled={isLoading || !isWalletConnected}
              />
            </div>
          )}
        </div>
      )}

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
                  disabled={isLoading || !isWalletConnected}
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
                  disabled={isLoading || !isWalletConnected}
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
        disabled={isLoading || !isWalletConnected}
        className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
      >
        {isLoading ? (
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
              {launchType === LaunchType.METEORA ? 'Launching on Meteora...' : 'Creating Token...'}
            </span>
          </span>
        ) : !isWalletConnected ? (
          'Connect Wallet to Create Token'
        ) : (
          launchType === LaunchType.METEORA ? 'Launch on Chad Mint' : 'Create Token'
        )}
      </button>
    </form>
  );
}