/**
 * Image utility functions
 */

/**
 * Generate optimized image URL
 */
export function getOptimizedImageUrl(url: string, width?: number, height?: number): string {
  // In production, use an image optimization service like Cloudinary or Imgix
  if (width || height) {
    return `${url}?w=${width || 'auto'}&h=${height || 'auto'}`;
  }
  return url;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 5MB.' };
  }

  return { valid: true };
}
