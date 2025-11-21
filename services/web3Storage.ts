/**
 * Pinata Upload Service
 * Simplifies file uploads to IPFS via Pinata
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

    console.log('✅ File uploaded via Pinata:', data.url);
    return data.url;
  } catch (error) {
    console.error('❌ IPFS Upload Service Error:', error);
    throw error;
  }
}