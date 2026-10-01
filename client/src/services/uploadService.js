import api from './api.js';

export const uploadService = {
  uploadImages: async (files) => {
    const formData = new FormData();
    
    // Append each file to FormData
    Array.from(files).forEach((file) => {
      formData.append('images', file);
    });

    // Get token and ensure it's included in the request
    const token = localStorage.getItem('accessToken');
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    // Make request with explicit headers
    const response = await api.post('/upload/images', formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let browser set it with boundary
      },
    });
    
    return response.data;
  },

  deleteImage: async (imageUrl) => {
    const response = await api.delete('/upload/images', {
      data: { imageUrl },
    });
    return response.data;
  },
};

