/**
 * Web3.Storage Upload Service (Client-Side Wrapper)
 * * This service now delegates the actual upload logic to the server-side API route
 * /api/upload to ensure the Delegation Proof (W3_PROOF) remains secure and
 * is never exposed to the browser.
 */

/**
 * Uploads a file to IPFS via the server-side proxy
 * Returns the HTTP gateway URL (immutable)
 */
export async function uploadImageToIPFS(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // Call our secure internal API route
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

    console.log('✅ File uploaded via API:', data.url);
    return data.url;
  } catch (error) {
    console.error('❌ IPFS Upload Service Error:', error);
    throw error; // Re-throw so the UI can handle the error state
  }
}