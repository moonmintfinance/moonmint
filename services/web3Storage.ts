/**
 * Pinata Upload Service with Wallet Signature Authentication
 * Only allows uploads from connected wallets with valid signatures
 */

import bs58 from 'bs58';

/**
 * Upload image to IPFS with wallet signature authentication
 * This prevents spam - only connected wallets can upload
 *
 * @param file - The image file to upload
 * @param signMessage - Wallet's message signing function
 * @param publicKey - Wallet's public key (base58 string)
 * @returns IPFS URL of uploaded image
 */
export async function uploadImageToIPFS(
  file: File,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey: string
): Promise<string> {
  try {
    // 1. Create authentication message with timestamp
    const message = `Moon Mint Image Upload|${Date.now()}`;
    console.log('🔐 Signing authentication message...');

    // 2. Sign message with wallet
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = await signMessage(messageBytes);
    const signature = bs58.encode(signatureBytes);

    console.log('✅ Message signed');

    // 3. Prepare form data with authentication
    const formData = new FormData();
    formData.append('file', file);
    formData.append('message', message);
    formData.append('signature', signature);
    formData.append('publicKey', publicKey);

    // 4. Upload with authentication
    console.log('📤 Uploading to IPFS with wallet authentication...');
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.url) {
      throw new Error('Invalid response from upload server');
    }

    console.log('✅ File uploaded securely:', data.url);
    return data.url;
  } catch (error) {
    console.error('❌ IPFS Upload Error:', error);
    throw error;
  }
}