import axios from 'axios';

const axiosClient = axios.create({
  baseURL: 'http://localhost:5000/api/v1',
});

// attach token automatically to every request if it exists
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;