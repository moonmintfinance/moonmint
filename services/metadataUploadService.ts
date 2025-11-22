/**
 * Metadata JSON Upload Service
 * Handles creation and upload of JSON metadata to IPFS
 * Includes project links (X, Telegram, Discord, Website)
 */

import { TokenMetadata } from '@/types/token';
import { validateSecureUrl } from '@/utils/security';
import bs58 from 'bs58';

export interface ProjectLinks {
  x?: string;
  telegram?: string;
  discord?: string;
  website?: string;
}

export interface MetadataJsonPayload {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  decimals?: number;
  external_url?: string;
  social_links?: ProjectLinks;
}

/**
 * Converts IPFS URI to HTTP gateway URL for metadata JSON
 * ✅ ALWAYS uses public Pinata gateway (not private gateway)
 * ipfs://QmHash -> https://gateway.pinata.cloud/ipfs/QmHash
 *
 * Public gateways are required because wallets and external services
 * won't have access to private/custom gateways
 */
function convertIpfsToGatewayUrl(imageUri: string): string {
  if (!imageUri) return imageUri;

  // If already HTTP, return as-is
  if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
    return imageUri;
  }

  // ✅ ALWAYS use public Pinata gateway for metadata images
  // Private gateways won't work for wallets and external services
  const PUBLIC_GATEWAY = 'https://gateway.pinata.cloud';

  // Convert ipfs:// to gateway URL
  if (imageUri.startsWith('ipfs://')) {
    const hash = imageUri.replace('ipfs://', '');
    return `${PUBLIC_GATEWAY}/ipfs/${hash}`;
  }

  // If just a hash, convert to gateway URL
  return `${PUBLIC_GATEWAY}/ipfs/${imageUri}`;
}

/**
 * Validates URLs for project links using security-hardened validation
 * âœ… Prevents: XSS, SSRF, malicious schemes, suspicious domains
 * âœ… Only allows: http:// and https:// URLs
 */
function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url) return { valid: true }; // Optional field
  return validateSecureUrl(url);
}

/**
 * Creates and uploads metadata JSON to IPFS
 *
 * @param metadata - Token metadata object
 * @param imageUri - IPFS URI of uploaded image (ipfs://QmHash format)
 * @param projectLinks - Optional project links (X, Telegram, Discord, Website)
 * @param signMessage - Wallet's message signing function (REQUIRED for authentication)
 * @param publicKey - Wallet's public key (base58 string) (REQUIRED for authentication)
 * @returns ipfs://metadataHash - Ready to use as token metadata URI
 *
 * @example
 * const metadataUri = await uploadMetadataJson(
 *   {
 *     name: "My Token",
 *     symbol: "MYTOKEN",
 *     decimals: 9
 *   },
 *   "ipfs://QmImageHash",
 *   {
 *     x: "https://x.com/myproject",
 *     telegram: "https://t.me/myproject",
 *     website: "https://myproject.com"
 *   },
 *   signMessage,
 *   publicKey.toBase58()
 * );
 * // Returns: "ipfs://QmMetadataHash"
 */
export async function uploadMetadataJson(
  metadata: Partial<TokenMetadata>,
  imageUri?: string,
  projectLinks?: ProjectLinks,
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey?: string
): Promise<string> {
  try {
    console.log('📝 Creating metadata JSON...');

    // ✅ CRITICAL: Validate wallet authentication is provided
    if (!signMessage || !publicKey) {
      throw new Error('Wallet authentication required for metadata upload. Please ensure signMessage and publicKey are provided.');
    }

    // Validate project links with security-hardened validation
    if (projectLinks) {
      const xValidation = validateUrl(projectLinks.x || '');
      if (!xValidation.valid) {
        throw new Error(`Invalid X/Twitter URL: ${xValidation.error}`);
      }

      const telegramValidation = validateUrl(projectLinks.telegram || '');
      if (!telegramValidation.valid) {
        throw new Error(`Invalid Telegram URL: ${telegramValidation.error}`);
      }

      const discordValidation = validateUrl(projectLinks.discord || '');
      if (!discordValidation.valid) {
        throw new Error(`Invalid Discord URL: ${discordValidation.error}`);
      }

      const websiteValidation = validateUrl(projectLinks.website || '');
      if (!websiteValidation.valid) {
        throw new Error(`Invalid Website URL: ${websiteValidation.error}`);
      }
    }

    // 1. Create metadata JSON object following SPL standard
    const metadataJson: MetadataJsonPayload = {
      name: metadata.name || 'Unnamed Token',
      symbol: metadata.symbol || 'TOKEN',
      description: (metadata as any).description || '',
      decimals: metadata.decimals || 9,
    };

    // 2. Add image if available
    if (imageUri) {
      // ✅ CONVERT TO HTTP GATEWAY URL FOR COMPATIBILITY
      const gatewayImageUrl = convertIpfsToGatewayUrl(imageUri);
      metadataJson.image = gatewayImageUrl;
      console.log(`🖼️  Image URI (IPFS): ${imageUri}`);
      console.log(`🔗 Image URL (Gateway): ${gatewayImageUrl}`);
    } else {
      console.warn('⚠️  No image provided for metadata');
    }

    // 3. Add project links if provided
    if (projectLinks && Object.values(projectLinks).some(v => v)) {
      const cleanLinks: ProjectLinks = {};
      if (projectLinks.x) cleanLinks.x = projectLinks.x;
      if (projectLinks.telegram) cleanLinks.telegram = projectLinks.telegram;
      if (projectLinks.discord) cleanLinks.discord = projectLinks.discord;
      if (projectLinks.website) cleanLinks.website = projectLinks.website;

      metadataJson.social_links = cleanLinks;
      console.log(`🔗 Project links added:`, cleanLinks);
    }

    console.log('📋 Metadata JSON structure:', metadataJson);

    // 4. Convert to JSON string (pretty-printed for readability)
    const jsonString = JSON.stringify(metadataJson, null, 2);
    console.log('📄 JSON content (size: ' + jsonString.length + ' bytes)');

    // 5. Create File from JSON string
    const jsonBlob = new Blob([jsonString], { type: 'application/json' });
    const jsonFile = new File([jsonBlob], 'metadata.json', {
      type: 'application/json',
    });

    console.log(`📦 Created File: metadata.json (${jsonFile.size} bytes)`);

    // 6. ✅ FIXED: Sign message with wallet and upload with authentication
    console.log('📤 Uploading metadata JSON to IPFS...');

    // Create authentication message with timestamp
    const message = `Moon Mint Metadata Upload|${Date.now()}`;
    console.log('🔐 Signing authentication message...');

    // Sign message with wallet
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = await signMessage(messageBytes);
    const signature = bs58.encode(signatureBytes);

    console.log('✅ Message signed');

    // Prepare form data with authentication
    const formData = new FormData();
    formData.append('file', jsonFile);
    formData.append('message', message);
    formData.append('signature', signature);
    formData.append('publicKey', publicKey);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || `Upload failed with status ${response.status}`;
      console.error('❌ Upload error:', errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    console.log('✅ Upload response:', data);

    // 7. Extract IPFS hash from response
    let metadataHash = '';

    if (data.IpfsHash) {
      // Direct hash from Pinata
      metadataHash = data.IpfsHash;
      console.log(`📍 Got IpfsHash: ${metadataHash}`);
    } else if (data.url) {
      // Extract hash from gateway URL
      // Format: https://gateway.pinata.cloud/ipfs/QmHash or custom gateway
      const match = data.url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        metadataHash = match[1];
        console.log(`📍 Extracted hash from URL: ${metadataHash}`);
      } else {
        throw new Error(`Could not extract hash from URL: ${data.url}`);
      }
    } else {
      throw new Error('Invalid response: missing IpfsHash or url field');
    }

    // 8. Format as ipfs:// URI
    const metadataUri = `ipfs://${metadataHash}`;

    console.log('✅ Metadata JSON uploaded successfully!');
    console.log(`📍 Metadata IPFS Hash: ${metadataHash}`);
    console.log(`🔗 Metadata URI (use this as token URI): ${metadataUri}`);
    console.log('💡 This URI will be stored on-chain in your token metadata');

    return metadataUri;
  } catch (error) {
    console.error('❌ Metadata JSON upload failed:', error);
    throw error;
  }
}

/**
 * Validates metadata JSON structure before upload
 */
export function validateMetadataJson(
  metadata: Partial<TokenMetadata>,
  imageUri?: string,
  projectLinks?: ProjectLinks
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!metadata.name || metadata.name.trim().length === 0) {
    errors.push('Token name is required');
  }

  if (!metadata.symbol || metadata.symbol.trim().length === 0) {
    errors.push('Token symbol is required');
  }

  if (metadata.name && metadata.name.length > 200) {
    errors.push('Token name exceeds maximum length (200 characters)');
  }

  if (metadata.symbol && metadata.symbol.length > 20) {
    errors.push('Token symbol exceeds maximum length (20 characters)');
  }

  // Handle description from any source
  const description = (metadata as any).description || '';
  if (description && description.length > 1000) {
    errors.push('Description exceeds maximum length (1000 characters)');
  }

  if (imageUri) {
    if (!imageUri.startsWith('ipfs://') && !imageUri.startsWith('http')) {
      errors.push('Image URI must be ipfs:// or http(s):// format');
    }
  }

  if (projectLinks) {
    const xValidation = validateUrl(projectLinks.x || '');
    if (!xValidation.valid) {
      errors.push(`Invalid X/Twitter URL: ${xValidation.error}`);
    }

    const telegramValidation = validateUrl(projectLinks.telegram || '');
    if (!telegramValidation.valid) {
      errors.push(`Invalid Telegram URL: ${telegramValidation.error}`);
    }

    const discordValidation = validateUrl(projectLinks.discord || '');
    if (!discordValidation.valid) {
      errors.push(`Invalid Discord URL: ${discordValidation.error}`);
    }

    const websiteValidation = validateUrl(projectLinks.website || '');
    if (!websiteValidation.valid) {
      errors.push(`Invalid Website URL: ${websiteValidation.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a metadata JSON object without uploading
 */
export function createMetadataJson(
  metadata: Partial<TokenMetadata>,
  imageUri?: string,
  projectLinks?: ProjectLinks
): MetadataJsonPayload {
  const jsonObj: MetadataJsonPayload = {
    name: metadata.name || 'Unnamed Token',
    symbol: metadata.symbol || 'TOKEN',
    description: (metadata as any).description || '',
    decimals: metadata.decimals || 9,
  };

  if (imageUri) {
    // ✅ CONVERT TO HTTP GATEWAY URL FOR COMPATIBILITY
    const gatewayImageUrl = convertIpfsToGatewayUrl(imageUri);
    jsonObj.image = gatewayImageUrl;
  }

  if (projectLinks && Object.values(projectLinks).some(v => v)) {
    const cleanLinks: ProjectLinks = {};
    if (projectLinks.x) cleanLinks.x = projectLinks.x;
    if (projectLinks.telegram) cleanLinks.telegram = projectLinks.telegram;
    if (projectLinks.discord) cleanLinks.discord = projectLinks.discord;
    if (projectLinks.website) cleanLinks.website = projectLinks.website;

    jsonObj.social_links = cleanLinks;
  }

  return jsonObj;
}