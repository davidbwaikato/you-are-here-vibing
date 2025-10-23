/**
 * Generate MD5 hash for text content
 * Uses Web Crypto API for hashing
 */
export const generateMD5Hash = async (text: string): Promise<string> => {
  // Convert text to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Generate SHA-256 hash (MD5 not available in Web Crypto API)
  // We'll use SHA-256 and take first 32 characters for similar behavior
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert hash to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return first 32 characters (similar to MD5 length)
  return hashHex.substring(0, 32);
};

/**
 * Generate audio filename from text and voice
 */
export const generateAudioFilename = async (
  text: string,
  voice: string
): Promise<string> => {
  const hash = await generateMD5Hash(text);
  return `${hash}-${voice}.mp3`;
};

/**
 * Check if audio file exists in cache
 */
export const checkAudioCache = async (filename: string): Promise<boolean> => {
  try {
    const response = await fetch(`/audio-cache/${filename}`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Get audio file URL from cache
 */
export const getAudioCacheUrl = (filename: string): string => {
  return `/audio-cache/${filename}`;
};
