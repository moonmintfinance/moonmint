import { TokenMetadata, TokenValidationResult } from '@/types/token';
import { TOKEN_CONSTRAINTS } from '@/lib/constants';
import { PublicKey } from '@solana/web3.js';
import {
  sanitizeUserInput,
  validateSecureUrl,
  validateNumericInput,
  detectScamPatterns,
} from './security';

/**
 * Security validation utilities for token creation
 * Ensures all inputs meet security and protocol requirements
 */

/**
 * Validates token metadata before minting
 */
export function validateTokenMetadata(
  metadata: TokenMetadata
): TokenValidationResult {
  const errors: string[] = [];

  // Validate name
  if (!metadata.name || metadata.name.trim().length === 0) {
    errors.push('Token name is required');
  } else if (metadata.name.length < TOKEN_CONSTRAINTS.MIN_NAME_LENGTH) {
    errors.push(
      `Token name must be at least ${TOKEN_CONSTRAINTS.MIN_NAME_LENGTH} character`
    );
  } else if (metadata.name.length > TOKEN_CONSTRAINTS.MAX_NAME_LENGTH) {
    errors.push(
      `Token name must not exceed ${TOKEN_CONSTRAINTS.MAX_NAME_LENGTH} characters`
    );
  }

  // Validate symbol
  if (!metadata.symbol || metadata.symbol.trim().length === 0) {
    errors.push('Token symbol is required');
  } else if (metadata.symbol.length < TOKEN_CONSTRAINTS.MIN_SYMBOL_LENGTH) {
    errors.push(
      `Token symbol must be at least ${TOKEN_CONSTRAINTS.MIN_SYMBOL_LENGTH} character`
    );
  } else if (metadata.symbol.length > TOKEN_CONSTRAINTS.MAX_SYMBOL_LENGTH) {
    errors.push(
      `Token symbol must not exceed ${TOKEN_CONSTRAINTS.MAX_SYMBOL_LENGTH} characters`
    );
  }

  // Validate symbol format (alphanumeric only)
  if (metadata.symbol && !/^[A-Z0-9]+$/i.test(metadata.symbol)) {
    errors.push('Token symbol must contain only letters and numbers');
  }

  // Validate decimals using security utility
  const decimalsValidation = validateNumericInput(
    metadata.decimals,
    TOKEN_CONSTRAINTS.MIN_DECIMALS,
    TOKEN_CONSTRAINTS.MAX_DECIMALS,
    'Decimals'
  );
  if (!decimalsValidation.valid) {
    errors.push(decimalsValidation.error!);
  }

  // Validate initial supply using security utility
  const supplyValidation = validateNumericInput(
    metadata.initialSupply,
    TOKEN_CONSTRAINTS.MIN_SUPPLY,
    TOKEN_CONSTRAINTS.MAX_SUPPLY,
    'Initial supply'
  );
  if (!supplyValidation.valid) {
    errors.push(supplyValidation.error!);
  }

  // Validate image URL if provided using security utility
  if (metadata.imageUrl) {
    const urlValidation = validateSecureUrl(metadata.imageUrl);
    if (!urlValidation.valid) {
      errors.push(urlValidation.error || 'Invalid image URL');
    }

    // Additional image-specific validation
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const lowerUrl = metadata.imageUrl.toLowerCase();
    const hasValidExtension = imageExtensions.some((ext) =>
      lowerUrl.includes(ext)
    );

    if (!hasValidExtension) {
      errors.push(
        'Image URL should point to a valid image (JPG, PNG, GIF, WebP, or SVG)'
      );
    }

    if (metadata.imageUrl.length > 200) {
      errors.push('Image URL must be less than 200 characters');
    }
  }

  // Check for potential scam patterns
  const scamWarnings = detectScamPatterns(metadata);
  if (scamWarnings.length > 0) {
    // Add as warnings, not errors (don't block creation, just warn)
    console.warn('⚠️ Potential scam patterns detected:', scamWarnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitizes user input to prevent injection attacks and XSS
 * Uses enhanced security utility
 */
export function sanitizeInput(input: string): string {
  return sanitizeUserInput(input, 1000);
}

/**
 * Validates Solana public key format
 */
export function isValidPublicKey(address: string): boolean {
  try {
    if (!address || typeof address !== 'string') {
      return false;
    }

    // Try to create a PublicKey - this validates the format
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates service fee wallet address
 */
export function isValidServiceFeeWallet(address: string | undefined): boolean {
  // Empty string is valid (means no fee)
  if (!address || address.trim() === '') {
    return true;
  }

  return isValidPublicKey(address);
}

/**
 * Validates image URL (maintained for backward compatibility)
 */
export function isValidImageUrl(
  url: string
): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: true }; // URL is optional
  }

  // Use the enhanced security validation
  const securityValidation = validateSecureUrl(url);
  if (!securityValidation.valid) {
    return securityValidation;
  }

  // Check common image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const lowerUrl = url.toLowerCase();
  const hasValidExtension = imageExtensions.some((ext) =>
    lowerUrl.includes(ext)
  );

  if (!hasValidExtension) {
    return {
      valid: false,
      error:
        'Image URL should point to a valid image (JPG, PNG, GIF, WebP, or SVG)',
    };
  }

  // Check URL length (max 200 chars for on-chain storage)
  if (url.length > 200) {
    return {
      valid: false,
      error: 'Image URL must be less than 200 characters',
    };
  }

  return { valid: true };
}

/**
 * Calculates estimated transaction cost
 */
export function estimateTransactionCost(
  lamportsPerSignature: number = 5000,
  accountCreationCost: number = 2039280
): number {
  // Transaction fee + account creation + token account creation + service fee
  const signatureCost = lamportsPerSignature * 2; // Usually 2 signatures
  const totalCost = signatureCost + accountCreationCost * 2;

  return totalCost;
}

/**
 * Formats lamports to SOL
 */
export function lamportsToSol(lamports: number): string {
  const sol = lamports / 1_000_000_000;
  return sol.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 9,
  });
}

/**
 * Formats token amount with decimals
 */
export function formatTokenAmount(amount: number, decimals: number): string {
  if (decimals < 0 || decimals > 20) {
    return amount.toString();
  }

  const formattedAmount = amount / Math.pow(10, decimals);
  return formattedAmount.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });
}