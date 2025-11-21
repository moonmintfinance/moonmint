/**
 * Security Utilities for Token Minter
 * Provides XSS prevention, rate limiting, and transaction safety
 */

import { PublicKey, Transaction } from '@solana/web3.js';

/**
 * Enhanced XSS Prevention
 * Removes all potentially dangerous characters and patterns
 */
export function sanitizeUserInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script patterns
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    // Remove dangerous characters
    .replace(/[<>'"`;(){}[\]\\]/g, '')
    // Remove null bytes
    .replace(/\0/g, '')
    // Limit length
    .substring(0, maxLength);
}

/**
 * URL Security Validation
 * Prevents SSRF and malicious URL schemes
 */
export function validateSecureUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: true }; // Empty URLs are optional
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /file:/i,
    /about:/i,
    /<script/i,
    /onclick/i,
    /onerror/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url)) {
      return { valid: false, error: 'URL contains suspicious content' };
    }
  }

  // Validate URL structure
  try {
    const urlObj = new URL(url);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    // Block localhost and private IPs (basic SSRF prevention)
    const hostname = urlObj.hostname.toLowerCase();
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254',
      '10.',
      '172.16.',
      '192.168.',
    ];

    if (blockedHosts.some((blocked) => hostname.includes(blocked))) {
      return { valid: false, error: 'Local and private URLs are not allowed' };
    }

    // Check URL length
    if (url.length > 200) {
      return { valid: false, error: 'URL exceeds maximum length (200 characters)' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Double-Submit Prevention
 * Prevents accidental double-clicking during transaction processing
 * This is the only "rate limiting" that makes sense on frontend
 */
export class DoubleSubmitPrevention {
  private processing: Set<string> = new Set();

  isProcessing(key: string): boolean {
    return this.processing.has(key);
  }

  markProcessing(key: string): boolean {
    if (this.processing.has(key)) {
      return false; // Already processing
    }
    this.processing.add(key);
    return true;
  }

  markComplete(key: string): void {
    this.processing.delete(key);
  }
}

// Global instance for preventing double-submits
export const submitGuard = new DoubleSubmitPrevention();

/**
 * Transaction Security Validator
 * Validates transaction before signing
 */
export function validateTransaction(
  transaction: Transaction,
  expectedSigners: PublicKey[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!transaction) {
    errors.push('Transaction is null or undefined');
    return { valid: false, errors };
  }

  if (!transaction.instructions || transaction.instructions.length === 0) {
    errors.push('Transaction has no instructions');
  }

  if (transaction.instructions.length > 20) {
    errors.push('Transaction has suspiciously many instructions (>20)');
  }

  if (!transaction.recentBlockhash) {
    errors.push('Transaction missing recent blockhash');
  }

  if (!transaction.feePayer) {
    errors.push('Transaction missing fee payer');
  }

  // Validate expected signers
  if (expectedSigners.length > 0) {
    const hasExpectedSigner = expectedSigners.some((signer) =>
      transaction.feePayer?.equals(signer)
    );

    if (!hasExpectedSigner) {
      errors.push('Transaction fee payer does not match expected wallet');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Solana address format and detect potential scams
 */
export function validateSolanaAddress(
  address: string,
  type: 'wallet' | 'token' = 'wallet'
): { valid: boolean; error?: string; warning?: string } {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' };
  }

  // Check length
  if (address.length < 32 || address.length > 44) {
    return { valid: false, error: 'Invalid address length' };
  }

  // Check for valid base58 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(address)) {
    return { valid: false, error: 'Address contains invalid characters' };
  }

  // Try to create PublicKey to validate
  try {
    new PublicKey(address);
  } catch (error) {
    return { valid: false, error: 'Invalid Solana address format' };
  }

  // Check for common scam patterns (vanity addresses that look suspicious)
  const suspiciousPatterns = [
    /^1{8,}/, // Too many 1s at start
    /^[A-Z]{8,}/, // Too many capital letters
    /pump/i, // Pump scheme related
    /scam/i,
    /rug/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(address)) {
      return {
        valid: true,
        warning: 'Address contains suspicious patterns. Verify carefully.',
      };
    }
  }

  return { valid: true };
}

/**
 * Detect potentially dangerous token metadata patterns
 */
export function detectScamPatterns(metadata: {
  name: string;
  symbol: string;
  // description removed
}): string[] {
  const warnings: string[] = [];

  const scamKeywords = [
    'official',
    'verified',
    'elon',
    'musk',
    'binance',
    'coinbase',
    'airdrop',
    'giveaway',
    'free',
    'double',
    'profit',
    'guaranteed',
    'investment',
    'return',
  ];

  // Removed description from check
  const allText = `${metadata.name} ${metadata.symbol}`.toLowerCase();

  for (const keyword of scamKeywords) {
    if (allText.includes(keyword)) {
      warnings.push(`Contains suspicious keyword: "${keyword}"`);
    }
  }

  // Check for excessive emojis
  const emojiCount = (allText.match(/[\p{Emoji}]/gu) || []).length;
  if (emojiCount > 3) {
    warnings.push('Excessive emoji usage detected');
  }

  // Check for ALL CAPS
  if (metadata.name === metadata.name.toUpperCase() && metadata.name.length > 3) {
    warnings.push('All caps name may indicate low-quality token');
  }

  return warnings;
}

/**
 * Secure random string generator for transaction IDs
 */
export function generateSecureId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate numeric input to prevent overflow and injection
 */
export function validateNumericInput(
  value: number,
  min: number,
  max: number,
  fieldName: string
): { valid: boolean; error?: string } {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  if (!Number.isFinite(value)) {
    return { valid: false, error: `${fieldName} must be a finite number` };
  }

  if (!Number.isSafeInteger(value)) {
    return { valid: false, error: `${fieldName} exceeds safe integer range` };
  }

  if (value < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (value > max) {
    return { valid: false, error: `${fieldName} must not exceed ${max}` };
  }

  return { valid: true };
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return sanitizeUserInput(error, 200);
  }

  if (error instanceof Error) {
    // Remove sensitive information from error messages
    let message = error.message;

    // Remove wallet addresses from error messages
    message = message.replace(/[1-9A-HJ-NP-Za-km-z]{32,44}/g, '[ADDRESS]');

    // Remove private key patterns (just in case)
    message = message.replace(/[0-9a-fA-F]{64}/g, '[REDACTED]');

    // Remove API keys
    message = message.replace(/[a-zA-Z0-9_-]{32,}/g, '[REDACTED]');

    return sanitizeUserInput(message, 200);
  }

  return 'An unknown error occurred';
}

/**
 * Environment validation on startup
 */
export function validateEnvironmentSecurity(): string[] {
  const warnings: string[] = [];

  // Check if service fee wallet is configured
  const serviceFeeWallet = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (serviceFeeWallet === 'mainnet-beta') {
    warnings.push(
      '⚠️  Running on MAINNET - ensure service fee wallet is correctly configured'
    );
  }

  // Warn about devnet
  if (serviceFeeWallet === 'devnet') {
    warnings.push('ℹ️  Running on DEVNET - tokens have no real value');
  }

  return warnings;
}