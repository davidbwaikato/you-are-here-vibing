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
 * Generate an enhanced, tourist-friendly description using OpenAI ChatGPT
 * This creates engaging, audio-suitable narratives for virtual tourism
 */
export const generateEnhancedDescription = async (
  placeName: string,
  placeDescription: string,
  placeTypes: string[]
): Promise<EnhancedDescriptionResult | EnhancedDescriptionError> => {
  console.log('[OpenAI API] 🤖 Generating enhanced description for:', placeName);

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

    // ✨ LOG THE OPENAI ENHANCED DESCRIPTION
    console.log('[OpenAI API] 🎨 ===== OPENAI ENHANCED DESCRIPTION =====');
    console.log('[OpenAI API] 📍 Location:', placeName);
    console.log('[OpenAI API] 🤖 Model:', 'gpt-4o-mini');
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
 * Downloads and caches the audio file locally
 */
export const synthesizeTextToSpeech = async (
  text: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'
): Promise<AudioSynthesisResult | AudioSynthesisError> => {
  console.log('[OpenAI TTS] 🎤 Synthesizing text to speech:', {
    textLength: text.length,
    voice,
    preview: text.substring(0, 50) + '...',
  });

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
    // Generate filename from text hash
    const { generateAudioFilename, checkAudioCache, getAudioCacheUrl } = await import('../utils/audioCache');
    const filename = await generateAudioFilename(text, voice);
    
    console.log('[OpenAI TTS] 📝 Generated filename:', filename);

    // Check if audio already exists in cache
    const isCached = await checkAudioCache(filename);
    if (isCached) {
      console.log('[OpenAI TTS] ✅ Audio file found in cache, skipping synthesis');
      return {
        audioUrl: getAudioCacheUrl(filename),
        filename,
      };
    }

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

    // Create a download link to save the file
    // Note: In a real application, you would send this to a backend to save
    // For now, we'll create a blob URL and simulate the cache
    const blobUrl = URL.createObjectURL(audioBlob);
    
    console.log('[OpenAI TTS] ✅ Audio file ready:', {
      filename,
      blobUrl,
      size: audioBlob.size,
    });

    // In a production environment, you would:
    // 1. Send the blob to your backend
    // 2. Backend saves to public/audio-cache/
    // 3. Return the public URL
    
    // For development, we'll use the blob URL directly
    // and log instructions for manual caching
    console.log('[OpenAI TTS] 📋 To cache this audio file:');
    console.log(`   1. Download the audio from the blob URL`);
    console.log(`   2. Save to: public/audio-cache/${filename}`);
    console.log(`   3. The app will use the cached version on next load`);

    return {
      audioUrl: blobUrl,
      filename,
    };
  } catch (error) {
    console.error('[OpenAI TTS] ❌ Error synthesizing text to speech:', error);
    return {
      error: `Failed to synthesize text to speech: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};
