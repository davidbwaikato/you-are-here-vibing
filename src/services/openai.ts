export interface EnhancedDescriptionResult {
  enhancedDescription: string;
}

export interface EnhancedDescriptionError {
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

    return { enhancedDescription };
  } catch (error) {
    console.error('[OpenAI API] ❌ Error generating enhanced description:', error);
    return {
      error: `Failed to generate enhanced description: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};
