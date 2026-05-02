import { base44 } from '@/api/base44Client';

const DALLE_COST_ZAR = 0.76; // Per image at standard quality
const CACHE_DURATION_HOURS = 24;

async function getSystemSettings() {
  try {
    const settings = await base44.entities.SystemSettings.list();
    return settings?.[0] || null;
  } catch (err) {
    console.error('[ImageGenerator] Failed to fetch system settings:', err);
    return null;
  }
}

async function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function checkAndUpdateBudget(settings) {
  const currentMonth = await getCurrentMonth();
  
  // Reset budget if month changed
  if (settings.dalle_budget_month !== currentMonth) {
    await base44.entities.SystemSettings.update(settings.id, {
      dalle_budget_month: currentMonth,
      monthly_dalle_spent_zar: 0
    });
    return { budget_ok: true, new_spent: 0 };
  }

  // Check if within budget
  const projected = (settings.monthly_dalle_spent_zar || 0) + DALLE_COST_ZAR;
  if (projected > settings.monthly_dalle_budget_zar) {
    return { budget_ok: false, exceeded_by: projected - settings.monthly_dalle_budget_zar };
  }

  return { budget_ok: true, new_spent: projected };
}

async function checkCache(stylePrompt, clientId) {
  try {
    // Check for cached image from last 24 hours
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - CACHE_DURATION_HOURS * 60 * 60 * 1000);

    const cached = await base44.entities.GeneratedImage.filter({
      used_in_template_code: stylePrompt.substring(0, 50), // Rough match on prompt start
      used_for_client_id: clientId
    });

    if (cached && cached.length > 0) {
      const image = cached.find(img => new Date(img.generated_at) > oneDayAgo);
      if (image && new Date(image.expires_at) > now) {
        console.log('[ImageGenerator] Cache hit, reusing image');
        return image.image_url;
      }
    }
  } catch (err) {
    console.error('[ImageGenerator] Cache check failed:', err);
  }

  return null;
}

async function callDalleAPI(prompt) {
  const apiKey = typeof globalThis !== 'undefined' && globalThis.Deno 
    ? globalThis.Deno.env.get('OPENAI_API_KEY')
    : null;
  
  if (!apiKey) {
    console.error('[ImageGenerator] OPENAI_API_KEY not set in environment');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        size: '1024x1024',
        quality: 'standard',
        n: 1
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`DALL-E API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data?.[0]?.url || null;
  } catch (err) {
    console.error('[ImageGenerator] DALL-E API call failed:', err.message);
    return null;
  }
}

export async function generateMarketingImage({ stylePrompt, clientContext = null }) {
  try {
    const settings = await getSystemSettings();
    
    // Fallback to static image if settings not configured
    if (!settings?.openai_api_key_set) {
      console.warn('[ImageGenerator] OpenAI API key not configured, using fallback');
      return settings?.fallback_marketing_image_url || null;
    }

    // Check cache first
    const cachedUrl = await checkCache(stylePrompt, clientContext?.client_id);
    if (cachedUrl) {
      return cachedUrl;
    }

    // Check budget
    const budgetCheck = await checkAndUpdateBudget(settings);
    if (!budgetCheck.budget_ok) {
      console.warn(`[ImageGenerator] Budget exceeded by ZAR ${budgetCheck.exceeded_by}, using fallback`);
      return settings?.fallback_marketing_image_url || null;
    }

    // Build prompt with safeguards
    const fullPrompt = `Premium business marketing visual for a digital marketing agency. Modern, sophisticated, dark theme with purple-pink gradient accents. NO TEXT. NO LOGOS. NO HUMAN FACES. Abstract or scenic only. ${stylePrompt}`;

    // Call DALL-E
    const imageUrl = await callDalleAPI(fullPrompt);
    
    if (!imageUrl) {
      console.error('[ImageGenerator] DALL-E generation failed, using fallback');
      await base44.entities.SecurityEvent.create({
        event_type: 'dalle_generation_failed',
        email: 'system',
        details: `DALL-E image generation failed for prompt: ${stylePrompt.substring(0, 100)}`
      });
      return settings?.fallback_marketing_image_url || null;
    }

    // Save to cache
    try {
      await base44.entities.GeneratedImage.create({
        prompt_used: fullPrompt,
        image_url: imageUrl,
        generated_at: new Date().toISOString(),
        used_in_template_code: stylePrompt.substring(0, 50),
        used_for_client_id: clientContext?.client_id || null,
        expires_at: new Date(Date.now() + CACHE_DURATION_HOURS * 60 * 60 * 1000).toISOString(),
        generation_cost_zar: DALLE_COST_ZAR
      });

      // Update spent budget
      await base44.entities.SystemSettings.update(settings.id, {
        monthly_dalle_spent_zar: budgetCheck.new_spent
      });
    } catch (err) {
      console.error('[ImageGenerator] Failed to cache image or update budget:', err);
    }

    return imageUrl;
  } catch (err) {
    console.error('[ImageGenerator] Unexpected error:', err);
    
    // Try to return fallback
    try {
      const settings = await getSystemSettings();
      return settings?.fallback_marketing_image_url || null;
    } catch {
      return null;
    }
  }
}

// For backend use (Deno environment)
export async function generateMarketingImageBackend({ stylePrompt, clientContext = null }) {
  // Same logic but optimized for backend context
  return generateMarketingImage({ stylePrompt, clientContext });
}