/**
 * Pinata Upload Service with Wallet Signature Authentication
 * Only allows uploads from connected wallets with valid signatures
 */

import bs58 from 'bs58';

/**
 * Upload image to IPFS with wallet signature authentication
 * This prevents spam - only connected wallets can upload
 *
 * ✅ CRITICAL: Returns ipfs:// URI (not HTTP gateway URL)
 * This follows IPFS Foundation best practices for token metadata URIs
 * Token metadata should reference content by hash, not by specific gateway
 * Clients can use ANY gateway to fetch the content
 *
 * @param file - The image file to upload
 * @param signMessage - Wallet's message signing function
 * @param publicKey - Wallet's public key (base58 string)
 * @returns ipfs:// URI of uploaded image (not HTTP gateway URL)
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

    // ✅ CRITICAL: Extract IPFS hash and return ipfs:// URI
    // Pinata returns either 'url' (gateway URL) or 'IpfsHash' (content hash)
    let ipfsHash = '';

    if (data.IpfsHash) {
      // Pinata API response
      ipfsHash = data.IpfsHash;
    } else if (data.url) {
      // Extract hash from gateway URL
      // Format: https://gateway.pinata.cloud/ipfs/{hash} or https://custom.mypinata.cloud/ipfs/{hash}
      const match = data.url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (match) {
        ipfsHash = match[1];
      } else {
        // Fallback to returning the URL if we can't extract hash
        console.warn('⚠️ Could not extract IPFS hash from URL, returning gateway URL as fallback');
        return data.url;
      }
    } else {
      throw new Error('Invalid response from upload server - missing IpfsHash or url');
    }

    // ✅ Return ipfs:// URI (follows IPFS Foundation best practices)
    const ipfsUri = `ipfs://${ipfsHash}`;

    console.log('✅ File uploaded to IPFS');
    console.log(`📍 IPFS Hash: ${ipfsHash}`);
    console.log(`🔗 IPFS URI (for on-chain metadata): ${ipfsUri}`);
    console.log('💡 This URI works with ANY IPFS gateway - future-proof and decentralized!');

    return ipfsUri;
  } catch (error) {
    console.error('❌ IPFS Upload Error:', error);
    throw error;
  }
}