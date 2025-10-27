// ============================================================================
// OPENAI API CONTROL FLAG
// ============================================================================
// IMPORTANT: Set to false to disable all OpenAI API calls and avoid costs
// This is for internal development/testing purposes only
// When testing non-audio features, set this to false to prevent API charges
const ENABLE_OPENAI_API_CALLS = false;
// ============================================================================

export interface EnhancedDescriptionResult {
  enhancedDescription: string;
}

export interface EnhancedDescriptionError {
  error: string;
}

export interface AudioSynthesisResult {
  audioUrl: string;
  filename: string;
}

export interface AudioSynthesisError {
  error: string;
}

/**
 * Sanitize location short name for use as storage key
 * Removes punctuation and replaces spaces with hyphens
 */
const sanitizeShortName = (shortName: string): string => {
  return shortName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove punctuation
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
};

/**
 * Generate storage key for audio blob
 * Format: {sanitized-short-name}-tts-{voice}
 */
const generateStorageKey = (shortName: string, voice: string): string => {
  const sanitized = sanitizeShortName(shortName);
  return `${sanitized}-tts-${voice}`;
};

/**
 * Generate storage key for enhanced description
 * Format: {sanitized-short-name}-enhancedDescription
 */
const generateDescriptionStorageKey = (placeName: string): string => {
  const sanitized = sanitizeShortName(placeName);
  return `${sanitized}-enhancedDescription`;
};

/**
 * Store enhanced description in localStorage
 */
const storeDescriptionInLocalStorage = (
  storageKey: string,
  description: string
): void => {
  try {
    console.log('[Description Cache] 💾 Storing enhanced description in localStorage:', {
      key: storageKey,
      length: description.length,
      preview: description.substring(0, 100) + '...',
    });

    localStorage.setItem(storageKey, description);

    console.log('[Description Cache] ✅ Enhanced description stored successfully in localStorage:', {
      key: storageKey,
      characterCount: description.length,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error('[Description Cache] ❌ localStorage quota exceeded!');
      console.error('[Description Cache] 💡 Consider clearing old cached descriptions');
    } else {
      console.error('[Description Cache] ❌ Error storing description in localStorage:', error);
    }
    throw error;
  }
};

/**
 * Retrieve enhanced description from localStorage
 */
const retrieveDescriptionFromLocalStorage = (storageKey: string): string | null => {
  try {
    console.log('[Description Cache] 🔍 Checking localStorage for enhanced description:', storageKey);

    const description = localStorage.getItem(storageKey);
    if (!description) {
      console.log('[Description Cache] ❌ Cache miss - description not found in localStorage');
      return null;
    }

    console.log('[Description Cache] ✅ Cache hit - description found in localStorage!');
    console.log('[Description Cache] 📊 Retrieved description from cache:', {
      key: storageKey,
      characterCount: description.length,
      preview: description.substring(0, 100) + '...',
    });

    return description;
  } catch (error) {
    console.error('[Description Cache] ❌ Error retrieving description from localStorage:', error);
    return null;
  }
};

/**
 * Store audio blob in localStorage
 * Converts blob to base64 for storage
 */
const storeAudioInLocalStorage = async (
  storageKey: string,
  audioBlob: Blob
): Promise<void> => {
  try {
    console.log('[Audio Cache] 💾 Storing audio in localStorage:', {
      key: storageKey,
      size: audioBlob.size,
      type: audioBlob.type,
    });

    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
    });

    reader.readAsDataURL(audioBlob);
    const base64Data = await base64Promise;

    // Store in localStorage
    localStorage.setItem(storageKey, base64Data);

    console.log('[Audio Cache] ✅ Audio stored successfully in localStorage:', {
      key: storageKey,
      base64Length: base64Data.length,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error('[Audio Cache] ❌ localStorage quota exceeded!');
      console.error('[Audio Cache] 💡 Consider clearing old cached audio files');
    } else {
      console.error('[Audio Cache] ❌ Error storing audio in localStorage:', error);
    }
    throw error;
  }
};

/**
 * Retrieve audio blob from localStorage (async version)
 * Converts base64 back to blob
 */
const retrieveAudioFromLocalStorageAsync = async (storageKey: string): Promise<Blob | null> => {
  try {
    console.log('[Audio Cache] 🔍 Checking localStorage for audio:', storageKey);

    const base64Data = localStorage.getItem(storageKey);
    if (!base64Data) {
      console.log('[Audio Cache] ❌ Cache miss - audio not found in localStorage');
      return null;
    }

    console.log('[Audio Cache] ✅ Cache hit - audio found in localStorage!');

    // Convert base64 to blob
    const response = await fetch(base64Data);
    const blob = await response.blob();

    console.log('[Audio Cache] 📊 Retrieved audio from cache:', {
      key: storageKey,
      base64Length: base64Data.length,
      blobSize: blob.size,
      blobType: blob.type,
    });

    return blob;
  } catch (error) {
    console.error('[Audio Cache] ❌ Error retrieving audio from localStorage:', error);
    return null;
  }
};

/**
 * Generate an enhanced, tourist-friendly description using OpenAI ChatGPT
 * This creates engaging, audio-suitable narratives for virtual tourism
 * Checks localStorage cache first before calling OpenAI API
 */
export const generateEnhancedDescription = async (
  placeName: string,
  placeDescription: string,
  placeTypes: string[]
): Promise<EnhancedDescriptionResult | EnhancedDescriptionError> => {
  console.log('[OpenAI API] 🤖 Generating enhanced description for:', placeName);

  // Generate storage key
  const storageKey = generateDescriptionStorageKey(placeName);
  console.log('[OpenAI API] 🔑 Description storage key:', storageKey);

  // Check localStorage cache first
  try {
    const cachedDescription = retrieveDescriptionFromLocalStorage(storageKey);
    if (cachedDescription) {
      console.log('[OpenAI API] ✅ Using cached enhanced description from localStorage!');
      console.log('[OpenAI API] 🎨 ===== CACHED ENHANCED DESCRIPTION =====');
      console.log('[OpenAI API] 📍 Location:', placeName);
      console.log('[OpenAI API] 💾 Source: localStorage cache');
      console.log('[OpenAI API] 📊 Stats:', {
        characterCount: cachedDescription.length,
        wordCount: cachedDescription.split(/\s+/).length,
        paragraphCount: cachedDescription.split(/\n\n/).length,
      });
      console.log('[OpenAI API] 📝 Cached Description:');
      console.log('─'.repeat(60));
      console.log(cachedDescription);
      console.log('─'.repeat(60));
      console.log('[OpenAI API] 🎨 ==========================================');
      
      return { enhancedDescription: cachedDescription };
    }
  } catch (error) {
    console.warn('[OpenAI API] ⚠️ Error checking description cache, will proceed with API call:', error);
  }

  // Check if OpenAI API calls are enabled
  if (!ENABLE_OPENAI_API_CALLS) {
    console.log('[OpenAI API] 🚫 OpenAI API calls DISABLED - Skipping enhanced description generation');
    console.log('[OpenAI API] 💡 To enable: Set ENABLE_OPENAI_API_CALLS = true in src/services/openai.ts');
    return { 
      error: 'OpenAI API calls are disabled (ENABLE_OPENAI_API_CALLS = false)' 
    };
  }

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    console.error('[OpenAI API] ❌ OpenAI API key not configured');
    return { error: 'OpenAI API key not configured' };
  }

  try {
    // Build context from place types
    const typeContext = placeTypes.length > 0 
      ? `This is a ${placeTypes.join(', ')} location.` 
      : '';

    // Craft the prompt for tourist-focused audio description
    const prompt = `You are a knowledgeable and engaging tour guide creating an audio description for tourists experiencing a location virtually through Google Street View.

Location Name: ${placeName}
Basic Description: ${placeDescription}
${typeContext}

Create a vivid, engaging description (2-3 paragraphs, approximately 150-200 words) that:
1. Captures the essence and atmosphere of this location
2. Highlights what makes it special or historically significant
3. Describes what a visitor would see, feel, and experience
4. Uses descriptive, sensory language suitable for audio narration
5. Maintains an enthusiastic but informative tone
6. Avoids overly technical jargon
7. Is suitable for a general public audience

Write in second person ("you") to make it immersive, as if speaking directly to the tourist.`;

    console.log('[OpenAI API] 📡 Sending request to ChatGPT...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert tour guide who creates engaging, vivid audio descriptions for virtual tourism experiences. Your descriptions are informative, atmospheric, and perfect for listening.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OpenAI API] ❌ API request failed:', response.status, errorData);
      return { 
        error: `OpenAI API request failed: ${response.status} ${response.statusText}` 
      };
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      console.error('[OpenAI API] ❌ No response from ChatGPT');
      return { error: 'No response generated from ChatGPT' };
    }

    const enhancedDescription = data.choices[0].message.content.trim();
    
    console.log('[OpenAI API] ✅ Enhanced description generated:', {
      length: enhancedDescription.length,
      preview: enhancedDescription.substring(0, 100) + '...',
    });

    // Store in localStorage for future use
    try {
      storeDescriptionInLocalStorage(storageKey, enhancedDescription);
      console.log('[OpenAI API] ✅ Enhanced description cached in localStorage for future use');
    } catch (cacheError) {
      console.warn('[OpenAI API] ⚠️ Failed to cache description, but continuing with result:', cacheError);
    }

    // ✨ LOG THE OPENAI ENHANCED DESCRIPTION
    console.log('[OpenAI API] 🎨 ===== OPENAI ENHANCED DESCRIPTION =====');
    console.log('[OpenAI API] 📍 Location:', placeName);
    console.log('[OpenAI API] 🤖 Model:', 'gpt-4o-mini');
    console.log('[OpenAI API] 💾 Source: OpenAI API (newly generated)');
    console.log('[OpenAI API] 📊 Stats:', {
      characterCount: enhancedDescription.length,
      wordCount: enhancedDescription.split(/\s+/).length,
      paragraphCount: enhancedDescription.split(/\n\n/).length,
    });
    console.log('[OpenAI API] 📝 Enhanced Description:');
    console.log('─'.repeat(60));
    console.log(enhancedDescription);
    console.log('─'.repeat(60));
    console.log('[OpenAI API] 🎨 ==========================================');

    return { enhancedDescription };
  } catch (error) {
    console.error('[OpenAI API] ❌ Error generating enhanced description:', error);
    return {
      error: `Failed to generate enhanced description: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Synthesize text to speech using OpenAI TTS API
 * Checks localStorage cache first, then downloads and caches the audio file
 */
export const synthesizeTextToSpeech = async (
  text: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy',
  shortName: string
): Promise<AudioSynthesisResult | AudioSynthesisError> => {
  console.log('[OpenAI TTS] 🎤 Synthesizing text to speech:', {
    textLength: text.length,
    voice,
    shortName,
    preview: text.substring(0, 50) + '...',
  });

  // Generate storage key
  const storageKey = generateStorageKey(shortName, voice);
  console.log('[OpenAI TTS] 🔑 Storage key:', storageKey);

  // Check localStorage cache first
  try {
    const cachedBlob = await retrieveAudioFromLocalStorageAsync(storageKey);
    if (cachedBlob) {
      console.log('[OpenAI TTS] ✅ Using cached audio from localStorage!');
      const blobUrl = URL.createObjectURL(cachedBlob);
      return {
        audioUrl: blobUrl,
        filename: `${storageKey}.mp3`,
      };
    }
  } catch (error) {
    console.warn('[OpenAI TTS] ⚠️ Error checking cache, will proceed with API call:', error);
  }

  // Check if OpenAI API calls are enabled
  if (!ENABLE_OPENAI_API_CALLS) {
    console.log('[OpenAI TTS] 🚫 OpenAI API calls DISABLED - Skipping text-to-speech synthesis');
    console.log('[OpenAI TTS] 💡 To enable: Set ENABLE_OPENAI_API_CALLS = true in src/services/openai.ts');
    return { 
      error: 'OpenAI API calls are disabled (ENABLE_OPENAI_API_CALLS = false)' 
    };
  }

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    console.error('[OpenAI TTS] ❌ OpenAI API key not configured');
    return { error: 'OpenAI API key not configured' };
  }

  try {
    console.log('[OpenAI TTS] 📡 Sending TTS request to OpenAI...');

    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OpenAI TTS] ❌ TTS API request failed:', response.status, errorData);
      return { 
        error: `OpenAI TTS API request failed: ${response.status} ${response.statusText}` 
      };
    }

    console.log('[OpenAI TTS] ✅ Audio synthesized, downloading...');

    // Get audio blob
    const audioBlob = await response.blob();
    
    console.log('[OpenAI TTS] 💾 Audio blob received:', {
      size: audioBlob.size,
      type: audioBlob.type,
    });

    // Store in localStorage
    try {
      await storeAudioInLocalStorage(storageKey, audioBlob);
      console.log('[OpenAI TTS] ✅ Audio cached in localStorage for future use');
    } catch (cacheError) {
      console.warn('[OpenAI TTS] ⚠️ Failed to cache audio, but continuing with blob URL:', cacheError);
    }

    // Create blob URL for immediate use
    const blobUrl = URL.createObjectURL(audioBlob);
    
    console.log('[OpenAI TTS] ✅ Audio file ready:', {
      filename: `${storageKey}.mp3`,
      blobUrl,
      size: audioBlob.size,
    });

    return {
      audioUrl: blobUrl,
      filename: `${storageKey}.mp3`,
    };
  } catch (error) {
    console.error('[OpenAI TTS] ❌ Error synthesizing text to speech:', error);
    return {
      error: `Failed to synthesize text to speech: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};
