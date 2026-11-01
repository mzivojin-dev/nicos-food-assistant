import { ApiError, handle, json, requireAdmin } from '../../../_shared.js';

const maxImageSize = 5 * 1024 * 1024;
const imageTypes = new Map([
  ['image/jpeg', { extension: 'jpg', matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ['image/png', { extension: 'png', matches: (bytes) => bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10' }],
  ['image/webp', { extension: 'webp', matches: (bytes) => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' }],
]);

export function onRequestPost(context) {
  return handle(async () => {
    await requireAdmin(context);
    if (!context.env.IMAGES) throw new ApiError(503, 'Image uploads are not configured.');

    const contentLength = Number(context.request.headers.get('content-length') || 0);
    if (contentLength > maxImageSize + 65_536) throw new ApiError(413, 'Photo must be 5 MB or smaller.');

    let formData;
    try {
      formData = await context.request.formData();
    } catch {
      throw new ApiError(400, 'Send an image file.');
    }

    const file = formData.get('image');
    if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') {
      throw new ApiError(400, 'Choose an image file to upload.');
    }
    if (file.size < 1 || file.size > maxImageSize) {
      throw new ApiError(413, 'Photo must be between 1 byte and 5 MB.');
    }

    const type = imageTypes.get(file.type);
    if (!type) throw new ApiError(400, 'Upload a JPG, PNG, or WebP image.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!type.matches(bytes)) throw new ApiError(400, 'The uploaded file does not match its image type.');

    const key = `${crypto.randomUUID()}.${type.extension}`;
    await context.env.IMAGES.put(key, bytes, {
      httpMetadata: { contentType: file.type },
    });
    return json({ imageUrl: `/images/${key}` }, 201);
  });
}
