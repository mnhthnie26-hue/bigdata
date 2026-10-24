import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor - always attach demo token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token') || 'demo_token_123'
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    localStorage.setItem('access_token', token)
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - no redirects on 401/403
api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error)
  }
)

export { api }