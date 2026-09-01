// Resizes/compresses an image file in the browser before upload, so large
// phone photos don't get sent (and billed as Cloudinary bandwidth) at full size.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const SKIP_BELOW_BYTES = 300 * 1024;

const loadImage = (file) => new Promise((resolve, reject) => {
  const img = new window.Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = URL.createObjectURL(file);
});

// Returns a compressed File, or the original file if compression isn't
// applicable (animated GIF, already small, or no size improvement).
export const compressImage = async (file) => {
  if (!file || !file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }
  if (file.size <= SKIP_BELOW_BYTES) {
    return file;
  }

  let img;
  try {
    img = await loadImage(file);
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(img.src);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob || blob.size >= file.size) {
    return file;
  }

  const newName = file.name.replace(/\.\w+$/, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg' });
};

export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};
