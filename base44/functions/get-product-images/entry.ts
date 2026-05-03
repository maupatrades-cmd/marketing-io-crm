import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const settings = await base44.asServiceRole.entities.SystemSettings.filter({});
    const settingsRecord = Array.isArray(settings) ? settings[0] : settings;

    // Try product_images_json first (legacy), then product_images (current)
    if (settingsRecord?.product_images_json) {
      try {
        const images = JSON.parse(settingsRecord.product_images_json);
        return Response.json(images, { status: 200 });
      } catch (_) {}
    }

    if (settingsRecord?.product_images) {
      const images = typeof settingsRecord.product_images === 'string' 
        ? JSON.parse(settingsRecord.product_images)
        : settingsRecord.product_images;
      return Response.json(images, { status: 200 });
    }

    return Response.json({}, { status: 200 });
  } catch (err) {
    console.error('[get-product-images] Error:', err.message);
    return Response.json({}, { status: 200 });
  }
});