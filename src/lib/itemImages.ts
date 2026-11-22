export const DEMO_ITEM_IMAGES: Record<string, string> = {
  'Cordless power drill': '/src/assets/images/item_power_drill_1795298891489.jpg',
  'Extension ladder': '/src/assets/images/item_extension_ladder_1795298892017.jpg',
  '4-person camping tent': '/src/assets/images/item_camping_tent_1795298891497.jpg',
  'HD projector': '/src/assets/images/item_hd_projector_1795298891584.jpg',
  'Home tool kit': '/src/assets/images/item_home_toolkit_1795298892107.jpg',
  'Folding chairs (set of 6)': '/src/assets/images/item_folding_chairs_1795298891705.jpg',
  'Scientific calculator': '/src/assets/images/item_calculator_1795298891504.jpg',
  Football: '/src/assets/images/item_football_1795298891439.jpg',
  'Portable speaker': '/src/assets/images/item_portable_speaker_1795298891809.jpg',
  'Countertop blender': '/src/assets/images/item_blender_1795298892105.jpg',
  'Study books bundle': '/src/assets/images/item_study_books_1795298894414.jpg',
  'Bicycle pump': '/src/assets/images/item_bicycle_pump_1795298892045.jpg',
};

export function isValidStoredImageSource(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/src/assets/')) {
    return true;
  }
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return true;
  }
  if (/^https?:\/\/.+/i.test(trimmed)) {
    return true;
  }
  return false;
}

const MAX_DIMENSION = 960;
const MAX_PNG_DATA_URL_LENGTH = 550_000;

export async function fileToOptimizedImageDataUrl(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined') {
    return rawDataUrl;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('This file could not be decoded as an image.'));
    el.src = rawDataUrl;
  });

  let width = img.naturalWidth || img.width || 800;
  let height = img.naturalHeight || img.height || 600;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return rawDataUrl;
  }

  ctx.drawImage(img, 0, 0, width, height);

  if (file.type === 'image/png') {
    const pngData = canvas.toDataURL('image/png');
    if (pngData.length <= MAX_PNG_DATA_URL_LENGTH) {
      return pngData;
    }
    // If lossless PNG is very large (e.g. photo saved as PNG), keep compact WebP/JPEG fallback
    const webpData = canvas.toDataURL('image/webp', 0.86);
    if (webpData.startsWith('data:image/webp') && webpData.length <= MAX_PNG_DATA_URL_LENGTH) {
      return webpData;
    }
  }

  const webp = canvas.toDataURL('image/webp', 0.86);
  if (webp.startsWith('data:image/webp') && webp.length <= MAX_PNG_DATA_URL_LENGTH) {
    return webp;
  }

  return canvas.toDataURL('image/jpeg', 0.86);
}
