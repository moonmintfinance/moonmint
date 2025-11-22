/**
 * Metadata JSON Upload Service
 * Handles creation and upload of JSON metadata to IPFS
 * Includes project links (X, Telegram, Discord, Website)
 */

import { TokenMetadata } from '@/types/token';
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
 * Validates URLs for project links
 */
function validateUrl(url: string): boolean {
  if (!url) return true; // Optional field
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
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

    // Validate project links
    if (projectLinks) {
      if (projectLinks.x && !validateUrl(projectLinks.x)) {
        throw new Error('Invalid X/Twitter URL');
      }
      if (projectLinks.telegram && !validateUrl(projectLinks.telegram)) {
        throw new Error('Invalid Telegram URL');
      }
      if (projectLinks.discord && !validateUrl(projectLinks.discord)) {
        throw new Error('Invalid Discord URL');
      }
      if (projectLinks.website && !validateUrl(projectLinks.website)) {
        throw new Error('Invalid Website URL');
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
      // Ensure it's in ipfs:// format
      let formattedImageUri = imageUri;

      if (!formattedImageUri.startsWith('ipfs://') && !formattedImageUri.startsWith('http')) {
        // If it's just a hash, prepend ipfs://
        formattedImageUri = `ipfs://${formattedImageUri}`;
      }

      metadataJson.image = formattedImageUri;
      console.log(`🖼️  Image URI: ${formattedImageUri}`);
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
    if (projectLinks.x && !validateUrl(projectLinks.x)) {
      errors.push('Invalid X/Twitter URL');
    }
    if (projectLinks.telegram && !validateUrl(projectLinks.telegram)) {
      errors.push('Invalid Telegram URL');
    }
    if (projectLinks.discord && !validateUrl(projectLinks.discord)) {
      errors.push('Invalid Discord URL');
    }
    if (projectLinks.website && !validateUrl(projectLinks.website)) {
      errors.push('Invalid Website URL');
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
    const formattedUri = imageUri.startsWith('ipfs://') || imageUri.startsWith('http')
      ? imageUri
      : `ipfs://${imageUri}`;
    jsonObj.image = formattedUri;
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