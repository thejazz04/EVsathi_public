import axios from 'axios';
import { API_BASE_URL } from '../utils/constants.js';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    const isPublicAuthRoute = config.url?.includes('/auth/login') || config.url?.includes('/auth/register');

    // Always set Authorization header if token exists
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (!isPublicAuthRoute) {
      // Quiet warn for protected requests when unauthenticated
    }
    
    // Don't set Content-Type for FormData - let browser set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};

    if (error.code === 'ECONNABORTED') {
      error.userMessage = 'Server is taking too long to respond. Please try again.';
      return Promise.reject(error);
    }

    if (!error.response) {
      error.userMessage = 'Unable to reach server. Please check your internet and backend server.';
      return Promise.reject(error);
    }

    const requestUrl = String(originalRequest.url || '');
    const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register') || requestUrl.includes('/auth/refresh');
    const hasAccessToken = !!localStorage.getItem('accessToken');

    if (error.response?.status === 401 && !originalRequest._retry && hasAccessToken && !isAuthRequest) {
      originalRequest._retry = true;

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          withCredentials: true,
        });

        const { accessToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
