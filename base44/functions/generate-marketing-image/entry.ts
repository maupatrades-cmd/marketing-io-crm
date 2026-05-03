import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    return Response.json({ error: 'Gemini API key not configured. Add GEMINI_API_KEY in Project Settings → Environment Variables.' }, { status: 503 });
  }

  const { prompt, aspect_ratio = '4:5', campaign_id = null } = await req.json();
  if (!prompt) {
    return Response.json({ error: 'prompt is required' }, { status: 400 });
  }

  const COST_ZAR = 0.75;

  // Budget check
  let settings = null;
  try {
    const settingsList = await base44.asServiceRole.entities.SystemSettings.list();
    settings = settingsList?.[0] || null;
  } catch (_) {}

  if (settings) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const settingsMonth = settings.dalle_budget_month;

    let spent = settings.monthly_dalle_spent_zar || 0;
    const budget = settings.monthly_dalle_budget_zar || 200;

    // Reset spend at month boundary
    if (settingsMonth !== currentMonth) {
      spent = 0;
      await base44.asServiceRole.entities.SystemSettings.update(settings.id, {
        monthly_dalle_spent_zar: 0,
        dalle_budget_month: currentMonth
      });
    }

    if (spent + COST_ZAR > budget) {
      console.log('[generate-marketing-image] Budget exceeded, using fallback');
      const fallbackUrl = settings.fallback_marketing_image_url || null;
      return Response.json({ image_url: fallbackUrl, fallback: true });
    }
  }

  // Brand suffix for all prompts
  const brandedPrompt = `${prompt}, Marketing iO brand colours: deep purple #a764e6 and pink #ec4899 in subtle ambient light, vertical composition, cinematic photography, no text overlays, no watermarks`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: brandedPrompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[generate-marketing-image] Gemini API error:', errText);
      throw new Error(`Gemini API returned ${geminiRes.status}: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));

    if (!imagePart) {
      throw new Error('No image returned from Gemini API');
    }

    // Convert base64 to binary and upload
    const base64Data = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || 'image/png';
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Upload to Base44 storage
    const formData = new FormData();
    formData.append('file', blob, `campaign-${Date.now()}.png`);
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
    const imageUrl = uploadResult?.file_url;

    if (!imageUrl) throw new Error('Failed to upload generated image');

    // Save to GeneratedImage entity
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.GeneratedImage.create({
      prompt_used: brandedPrompt,
      image_url: imageUrl,
      generated_at: now,
      used_in_template_code: campaign_id || '',
      used_for_client_id: '',
      generation_cost_zar: COST_ZAR,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    // Update spend
    if (settings) {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      await base44.asServiceRole.entities.SystemSettings.update(settings.id, {
        monthly_dalle_spent_zar: (settings.monthly_dalle_spent_zar || 0) + COST_ZAR,
        dalle_budget_month: currentMonth
      });
    }

    return Response.json({ image_url: imageUrl, fallback: false });

  } catch (err) {
    console.error('[generate-marketing-image] Error:', err.message);

    // Log failure
    await base44.asServiceRole.entities.SecurityEvent.create({
      event_type: 'suspicious_location',
      email: 'system',
      details: `generate-marketing-image failed: ${err.message}`
    });

    const fallbackUrl = settings?.fallback_marketing_image_url || null;
    return Response.json({ image_url: fallbackUrl, fallback: true, error: err.message });
  }
});