'use client';

import { useState, useEffect, useRef } from 'react';
import { TokenMetadata, MintConfig } from '@/types/token';
import { ProjectLinks } from '@/services/metadataUploadService';
import { sanitizeInput } from '@/utils/validation';
import { SERVICE_FEE_BASE_SOL, SERVICE_FEE_AUTHORITY_SOL, METEORA_CONFIG } from '@/lib/constants';
import { uploadImageToIPFS } from '@/services/web3Storage';
import { toast } from 'react-hot-toast';
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
      <div className="bg-primary-500/10 border-2 border-primary-500/30 rounded-none p-4">
        <div className="text-sm">
          <div className="font-bold text-primary-500 mb-3 uppercase tracking-wide">Fee Breakdown</div>
          <div className="space-y-2 text-gray-300 text-sm font-mono">
            <div className="flex justify-between">
              <span>Pool creation fee:</span>
              <span className="font-bold text-primary-500">{meteoraBaseFee.toFixed(2)} SOL</span>
            </div>
            {meteoraConfig.enableFirstBuy && (
              <div className="flex justify-between">
                <span>First buy amount:</span>
                <span className="font-bold text-primary-500">{firstBuyFee.toFixed(2)} SOL</span>
              </div>
            )}
            <div className="flex justify-between border-t border-primary-500/30 pt-2 mt-2">
              <span className="font-bold">Total fee:</span>
              <span className="font-bold text-primary-500 text-lg">
                {totalFee.toFixed(2)} SOL
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const baseFee = SERVICE_FEE_BASE_SOL;
  const authorityFee = SERVICE_FEE_AUTHORITY_SOL;
  const authoritiesCost = (config.mintAuthority ? 1 : 0) + (config.freezeAuthority ? 1 : 0);
  const authoritiesFeeTotal = authoritiesCost * authorityFee;
  const totalFee = baseFee + authoritiesFeeTotal;

  return (
    <div className="bg-primary-500/10 border-2 border-primary-500/30 rounded-none p-4">
      <div className="text-sm">
        <div className="font-bold text-primary-500 mb-3 uppercase tracking-wide">Fee Breakdown</div>
        <div className="space-y-2 text-gray-300 text-sm font-mono">
          <div className="flex justify-between">
            <span>Base minting fee:</span>
            <span className="font-bold text-primary-500">{baseFee.toFixed(2)} SOL</span>
          </div>
          {config.mintAuthority && (
            <div className="flex justify-between">
              <span>Revoke mint authority:</span>
              <span className="font-bold text-primary-500">+{authorityFee.toFixed(2)} SOL</span>
            </div>
          )}
          {config.freezeAuthority && (
            <div className="flex justify-between">
              <span>Revoke freeze authority:</span>
              <span className="font-bold text-primary-500">+{authorityFee.toFixed(2)} SOL</span>
            </div>
          )}
          <div className="flex justify-between border-t border-primary-500/30 pt-2 mt-2">
            <span className="font-bold">Total fee:</span>
            <span className="font-bold text-primary-500 text-lg">
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

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (launchType === LaunchType.METEORA) {
      setFormData((prev) => ({
        ...prev,
        decimals: 6,
        initialSupply: 1000000000,
      }));
    }
  }, [launchType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (file.size > 4 * 1024 * 1024) {
        toast.error('File size must be less than 4MB');
        return;
      }

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
      className="bg-dark-200/50 border-2 border-primary-500/30 rounded-none p-8 space-y-6"
    >
      {/* Launch Type Selection */}
      <div>
        <label className="block text-sm font-bold mb-3 text-white uppercase tracking-wide">
          Launch Type <span className="text-primary-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setLaunchType(LaunchType.METEORA)}
            className={`p-4 rounded-none border-2 transition-all ${
              launchType === LaunchType.METEORA
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-primary-500/20 bg-dark-100 hover:border-primary-500/40'
            }`}
            disabled={isLoading || !isWalletConnected}
          >
            <div className="font-bold text-white mb-1 uppercase">Meteora DBC</div>
            <div className="text-xs text-gray-400">Instant trading</div>
          </button>
          <button
            type="button"
            onClick={() => setLaunchType(LaunchType.DIRECT)}
            className={`p-4 rounded-none border-2 transition-all ${
              launchType === LaunchType.DIRECT
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-primary-500/20 bg-dark-100 hover:border-primary-500/40'
            }`}
            disabled={isLoading || !isWalletConnected}
          >
            <div className="font-bold text-white mb-1 uppercase">Direct Token</div>
            <div className="text-xs text-gray-400">Custom authorities</div>
          </button>
        </div>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-bold mb-3 text-white uppercase tracking-wide">
          Token Image (Optional)
        </label>
        <div className="flex gap-4">
          <div className="flex-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-3 border-2 border-dashed border-primary-500/50 hover:border-primary-500 transition-colors text-gray-300 hover:text-primary-500 bg-dark-100 font-bold"
              disabled={isLoading || !isWalletConnected}
            >
              {imageFile ? '✓ Image selected' : 'CLICK OR DRAG IMAGE'}
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
                className="w-20 h-20 object-cover border-2 border-primary-500/50"
              />
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  setPreviewUrl(null);
                }}
                className="absolute -top-3 -right-3 bg-primary-500 text-black rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold hover:bg-primary-400"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Token Name */}
      <div>
        <label className="block text-sm font-bold mb-2 text-white uppercase tracking-wide" htmlFor="name">
          Token Name <span className="text-primary-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., My Token"
          className="w-full bg-dark-100 border-2 border-primary-500/30 text-white rounded-none px-4 py-3 focus:outline-none focus:border-primary-500 focus:shadow-lg focus:shadow-primary-500/20 transition-all font-bold"
          required
          maxLength={32}
          disabled={isLoading || !isWalletConnected}
        />
        <p className="text-xs text-gray-500 mt-1">Maximum 32 characters</p>
      </div>

      {/* Token Symbol */}
      <div>
        <label className="block text-sm font-bold mb-2 text-white uppercase tracking-wide" htmlFor="symbol">
          Token Symbol <span className="text-primary-500">*</span>
        </label>
        <input
          id="symbol"
          type="text"
          value={formData.symbol}
          onChange={(e) =>
            setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
          }
          placeholder="e.g., CHAD"
          className="w-full bg-dark-100 border-2 border-primary-500/30 text-white rounded-none px-4 py-3 focus:outline-none focus:border-primary-500 focus:shadow-lg focus:shadow-primary-500/20 transition-all font-bold uppercase"
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
            <label className="block text-sm font-bold mb-2 text-white uppercase tracking-wide" htmlFor="decimals">
              Decimals <span className="text-primary-500">*</span>
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
              className="w-full bg-dark-100 border-2 border-primary-500/30 text-white rounded-none px-4 py-3 focus:outline-none focus:border-primary-500 focus:shadow-lg focus:shadow-primary-500/20 transition-all font-bold"
              required
              disabled={isLoading || !isWalletConnected}
            />
            <p className="text-xs text-gray-500 mt-1">Standard is 9</p>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-white uppercase tracking-wide" htmlFor="supply">
              Initial Supply <span className="text-primary-500">*</span>
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
              className="w-full bg-dark-100 border-2 border-primary-500/30 text-white rounded-none px-4 py-3 focus:outline-none focus:border-primary-500 focus:shadow-lg focus:shadow-primary-500/20 transition-all font-bold"
              required
              disabled={isLoading || !isWalletConnected}
            />
            <p className="text-xs text-gray-500 mt-1">Number of tokens</p>
          </div>
        </div>
      )}

      {/* Project Links - Collapsible Section */}
      <div className="border-t border-primary-500/30 pt-6">
        <button
          type="button"
          onClick={() => setShowProjectLinks(!showProjectLinks)}
          className="flex items-center justify-between w-full text-left hover:text-primary-500 transition-colors"
          disabled={isLoading || !isWalletConnected}
        >
          <span className="text-sm font-bold text-primary-500 uppercase tracking-wide">
            🔗 Project Links (Optional)
          </span>
          <span className="text-primary-500 font-bold">
            {showProjectLinks ? '▼' : '▶'}
          </span>
        </button>

        {showProjectLinks && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-gray-400 mb-4">
              Add links to your project's social media and website.
            </p>

            <div>
              <label className="flex items-center text-sm font-bold mb-2 text-white uppercase tracking-wide" htmlFor="twitter">
                <FaXTwitter className="w-4 h-4 mr-2" />
                Twitter
              </label>
              <input
                id="twitter"
                type="url"
                value={projectLinks.x || ''}
                onChange={(e) => handleProjectLinkChange('x', e.target.value)}
                placeholder="https://x.com/yourproject"
                className="w-full bg-dark-100 border-2 border-primary-500/30 text-white rounded-none px-4 py-2 focus:outline-none focus:border-primary-500 transition-all text-sm"
                disabled={isLoading || !isWalletConnected}
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-bold mb-2 text-white uppercase tracking-wide" htmlFor="telegram">
                <FaTelegram className="w-4 h-4 mr-2" />
                Telegram
              </label>
              <input
                id="telegram"
                type="url"
                value={projectLinks.telegram || ''}
                onChange={(e) => handleProjectLinkChange('telegram', e.target.value)}
                placeholder="https://t.me/yourproject"
                className="w-full bg-dark-100 border-2 border-primary-500/30 text-white rounded-none px-4 py-2 focus:outline-none focus:border-primary-500 transition-all text-sm"
                disabled={isLoading || !isWalletConnected}
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-bold mb-2 text-white uppercase tracking-wide" htmlFor="discord">
                <FaDiscord className="w-4 h-4 mr-2" />
                Discord
              </label>
              <input
                id="discord"
                type="url"
                value={projectLinks.discord || ''}
                onChange={(e) => handleProjectLinkChange('discord', e.target.value)}
                placeholder="https://discord.gg/yourserver"
                className="w-full bg-dark-100 border-2 border-primary-500/30 text-white rounded-none px-4 py-2 focus:outline-none focus:border-primary-500 transition-all text-sm"
                disabled={isLoading || !isWalletConnected}
              />
            </div>

            <div>
              <label className="flex items-center text-sm font-bold mb-2 text-white uppercase tracking-wide" htmlFor="website">
                <FaGlobe className="w-4 h-4 mr-2" />
                Website
              </label>
              <input
                id="website"
                type="url"
                value={projectLinks.website || ''}
                onChange={(e) => handleProjectLinkChange('website', e.target.value)}
                placeholder="https://yourproject.com"
                className="w-full bg-dark-100 border-2 border-primary-500/30 text-white rounded-none px-4 py-2 focus:outline-none focus:border-primary-500 transition-all text-sm"
                disabled={isLoading || !isWalletConnected}
              />
            </div>
          </div>
        )}
      </div>

      {/* Authorities (only for Direct launch) */}
      {launchType === LaunchType.DIRECT && (
        <div className="space-y-4 border-t border-primary-500/30 pt-6">
          <div className="text-sm font-bold text-primary-500 mb-4 uppercase tracking-wide">
            Token Authorities
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={config.mintAuthority}
                  onChange={(e) => handleMintAuthorityChange(e.target.checked)}
                  className="w-5 h-5 border-2 border-primary-500/50 focus:ring-2 focus:ring-primary-500"
                  disabled={isLoading || !isWalletConnected}
                />
                <div className="text-sm font-bold text-white uppercase tracking-wide">
                  Revoke Mint Authority
                </div>
              </label>
              <span className="text-xs text-primary-500 font-bold ml-2">
                +{SERVICE_FEE_AUTHORITY_SOL.toFixed(1)} SOL
              </span>
            </div>
            <p className="text-xs text-gray-400 ml-8">
              No new additional tokens can be minted.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={config.freezeAuthority}
                  onChange={(e) => handleFreezeAuthorityChange(e.target.checked)}
                  className="w-5 h-5 border-2 border-primary-500/50 focus:ring-2 focus:ring-primary-500"
                  disabled={isLoading || !isWalletConnected}
                />
                <div className="text-sm font-bold text-white uppercase tracking-wide">
                  Revoke Freeze Authority
                </div>
              </label>
              <span className="text-xs text-primary-500 font-bold ml-2">
                +{SERVICE_FEE_AUTHORITY_SOL.toFixed(1)} SOL
              </span>
            </div>
            <p className="text-xs text-gray-400 ml-8">
              Revoke your right to freeze token transfers.
            </p>
          </div>
        </div>
      )}

      {/* Fee Breakdown */}
      <FeeBreakdown config={config} launchType={launchType} meteoraConfig={meteoraConfig} />

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !isWalletConnected}
        className="w-full bg-primary-500 hover:bg-primary-400 active:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 rounded-none transition-all uppercase tracking-wide text-lg shadow-lg shadow-primary-500/40 hover:shadow-primary-500/60"
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
              {launchType === LaunchType.METEORA ? 'Launching...' : 'Creating...'}
            </span>
          </span>
        ) : !isWalletConnected ? (
          'Connect Wallet First'
        ) : (
          launchType === LaunchType.METEORA ? 'Launch on Meteora' : 'Create Token'
        )}
      </button>
    </form>
  );
}