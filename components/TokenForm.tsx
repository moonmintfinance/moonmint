'use client';

import { useState } from 'react';
import { TokenMetadata, MintConfig } from '@/types/token';
import { sanitizeInput, isValidImageUrl } from '@/utils/validation';
import { SERVICE_FEE_BASE_SOL, SERVICE_FEE_AUTHORITY_SOL, METEORA_CONFIG } from '@/lib/constants';

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
    const meteoraBaseFee = 0.05;
    const firstBuyFee = meteoraConfig.enableFirstBuy ? meteoraConfig.initialBuyAmount : 0;
    const totalFee = meteoraBaseFee + firstBuyFee;

    return (
      <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
        <div className="text-sm">
          <div className="font-medium text-primary-400 mb-3">Fee Breakdown (Meteora)</div>
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

  const [launchType, setLaunchType] = useState<LaunchType>(LaunchType.DIRECT);
  const [meteoraConfig, setMeteoraConfig] = useState({
    enableFirstBuy: false,
    initialBuyAmount: 0.1,
  });

  const [imageUrlError, setImageUrlError] = useState<string | null>(null);

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value.trim();
    setFormData({ ...formData, imageUrl: url });

    if (url) {
      const validation = isValidImageUrl(url);
      setImageUrlError(validation.error || null);
    } else {
      setImageUrlError(null);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWalletConnected) {
      return;
    }

    if (formData.imageUrl) {
      const urlValidation = isValidImageUrl(formData.imageUrl);
      if (!urlValidation.valid) {
        setImageUrlError(urlValidation.error || 'Invalid image URL');
        return;
      }
    }

    const sanitizedMetadata: TokenMetadata = {
      ...formData,
      name: sanitizeInput(formData.name),
      symbol: sanitizeInput(formData.symbol).toUpperCase(),
      description: formData.description
        ? sanitizeInput(formData.description)
        : undefined,
      imageUrl: formData.imageUrl ? formData.imageUrl.trim() : undefined,
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
                disabled={isLoading || !isWalletConnected}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-300 mb-1">
                  Direct Token 2022 Launch
                </div>
                <p className="text-xs text-gray-400">
                  Create token directly on-chain with fixed supply (standard method)
                </p>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer p-4 rounded-lg border border-dark-300 hover:border-primary-500/50 transition-colors">
              <input
                type="radio"
                checked={launchType === LaunchType.METEORA}
                onChange={() => setLaunchType(LaunchType.METEORA)}
                className="w-5 h-5 text-primary-500 mt-0.5"
                disabled={isLoading || !isWalletConnected}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-300 mb-1">
                  Meteora Bonding Curve 🌊
                </div>
                <p className="text-xs text-gray-400">
                  Launch on Meteora's dynamic bonding curve for automated price discovery
                </p>
              </div>
            </label>

            {launchType === LaunchType.METEORA && (
              <div className="ml-8 space-y-4 bg-primary-500/5 p-4 rounded-lg border border-primary-500/20">
                <div className="flex items-start space-x-2">
                  <div className="text-primary-400 text-sm">ℹ️</div>
                  <p className="text-xs text-gray-300">
                    Meteora bonding curves automatically manage token pricing based on supply and demand.
                    The price increases as more tokens are bought from the curve.
                  </p>
                </div>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={meteoraConfig.enableFirstBuy}
                    onChange={(e) => setMeteoraConfig({
                      ...meteoraConfig,
                      enableFirstBuy: e.target.checked
                    })}
                    className="w-5 h-5 rounded border-dark-300 text-primary-500"
                    disabled={isLoading || !isWalletConnected}
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
                      disabled={isLoading || !isWalletConnected}
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

      {/* Image URL */}
      <div>
        <label
          className="block text-sm font-medium mb-3 text-gray-300"
          htmlFor="imageUrl"
        >
          Image URL <span className="text-gray-500">(Optional)</span>
        </label>
        <input
          id="imageUrl"
          type="url"
          value={formData.imageUrl}
          onChange={handleImageUrlChange}
          placeholder="e.g., https://example.com/token.png"
          className={`w-full bg-dark-50 border ${
            imageUrlError ? 'border-red-500' : 'border-dark-300'
          } text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
          disabled={isLoading || !isWalletConnected}
          maxLength={200}
        />
        {imageUrlError && (
          <p className="text-xs text-red-400 mt-2">{imageUrlError}</p>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Stores directly on-chain. Max 200 characters. Supports: JPG, PNG, GIF, WebP, SVG
        </p>
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

      {/* Decimals and Initial Supply */}
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
          disabled={isLoading || !isWalletConnected}
        />
      </div>

      {/* Authorities (only for Direct launch) */}
      {launchType === LaunchType.DIRECT && (
        <div className="space-y-4 border-t border-dark-200 pt-6">
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
            <div className="ml-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex gap-2">
                <span className="text-yellow-500 font-semibold text-sm flex-shrink-0">
                  Recommend!
                </span>
                <p className="text-xs text-gray-300">
                  We recommend you revoke the right to mint new coins, this shows investors that your coin supply is fixed and cannot grow.
                </p>
              </div>
            </div>
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
            <div className="ml-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex gap-2">
                <span className="text-yellow-500 font-semibold text-sm flex-shrink-0">
                  Recommend!
                </span>
                <p className="text-xs text-gray-300">
                  We recommend that you revoke freeze authority, this will make your coin safer for potential buyers.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fee Breakdown */}
      <FeeBreakdown config={config} launchType={launchType} meteoraConfig={meteoraConfig} />

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !isWalletConnected || !!imageUrlError}
        className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
        title={
          !isWalletConnected
            ? 'Please connect your wallet first'
            : imageUrlError
              ? imageUrlError
              : ''
        }
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
          launchType === LaunchType.METEORA ? 'Launch on Meteora' : 'Create Token'
        )}
      </button>
    </form>
  );
}