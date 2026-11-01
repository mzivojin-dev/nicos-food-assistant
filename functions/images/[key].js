export async function onRequestGet({ env, params }) {
  const key = params.key;
  if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(key)) {
    return new Response('Not found.', { status: 404 });
  }
  if (!env.IMAGES) {
    return new Response('Image storage is not configured.', { status: 503 });
  }

  const image = await env.IMAGES.get(key);
  if (!image) return new Response('Not found.', { status: 404 });

  return new Response(image.body, {
    headers: {
      'Content-Type': image.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      ETag: image.httpEtag,
    },
  });
}
