/**
 * Convert relative image URL to absolute URL
 * @param {string} imageUrl - Relative or absolute image URL or just filename
 * @returns {string} - Full absolute URL
 */
export const getImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  
  // If already an absolute URL (starts with http:// or https://), return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If it's a data URL (base64), return as-is
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  
  // If it's just a filename (like '1.jpg', '5.jpg'), prepend /uploads/
  if (!imageUrl.startsWith('/') && !imageUrl.includes('/')) {
    imageUrl = `/uploads/${imageUrl}`;
  }
  
  // If it's a relative URL starting with /uploads, prepend the backend URL
  if (imageUrl.startsWith('/uploads')) {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    // If API_BASE_URL is relative, use current origin with port 5000
    if (apiBaseUrl.startsWith('/')) {
      return `http://localhost:5000${imageUrl}`;
    }
    // If API_BASE_URL is absolute, extract the base and append the image path
    try {
      const url = new URL(apiBaseUrl);
      return `${url.origin}${imageUrl}`;
    } catch {
      return `http://localhost:5000${imageUrl}`;
    }
  }
  
  // For any other relative path, try to resolve it
  return `http://localhost:5000${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
};

/**
 * Get multiple image URLs
 * @param {string[]} images - Array of image URLs
 * @returns {string[]} - Array of absolute URLs
 */
export const getImageUrls = (images = []) => {
  return images.map(getImageUrl);
};
