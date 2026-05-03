import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { business_name, industry, package: pkg } = await req.json();

  if (!business_name) {
    return Response.json({ error: 'Missing business_name' }, { status: 400 });
  }

  try {
    const prompt = `Create a professional, modern marketing business hero image for "${business_name}", a ${industry || 'business'} company in South Africa. 
    
    Style requirements:
    - South African aesthetic with local elements (Johannesburg/Pretoria skyline, African patterns, vibrant colors)
    - Professional marketing agency feel
    - Modern, clean design with gradient backgrounds
    - Include subtle business/growth elements (graphs, connections, digital transformation)
    - Bright, energetic but corporate
    - Wide format suitable as a hero banner (16:9 aspect ratio)
    - Include subtle South African flag colors (green, gold, black, white) if it fits naturally
    
    Package level: ${pkg || 'Accelerate'} (premium, growth-focused service)
    
    Make it look like a high-end digital marketing agency designed this for them.`;

    const response = await base44.integrations.Core.GenerateImage({
      prompt
    });

    if (response?.url) {
      return Response.json({ url: response.url });
    }

    return Response.json({ url: null });
  } catch (err) {
    console.error('[generate-hero-image]', err);
    return Response.json({ url: null });
  }
});