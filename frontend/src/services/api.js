import axios from 'axios';

// ✅ Base URL (Kubernetes service OR fallback)
const BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:30007';

// ✅ Axios instance
const api = axios.create({
  baseURL: `${BASE_URL}/api`,   // 🔥 IMPORTANT FIX (/api added)
  withCredentials: true,
  timeout: 15000,
});

// ─── Attach access token ─────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Auto-refresh token on 401 ───────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          })
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh');
        localStorage.setItem('accessToken', data.accessToken);

        processQueue(null, data.accessToken);

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Auth APIs ───────────────────────────────────────────────────────
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
};

// ─── Users APIs ──────────────────────────────────────────────────────
export const usersAPI = {
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.patch('/users/me', data),
  search: (q) => api.get(`/users/search?q=${encodeURIComponent(q)}`),
  getById: (id) => api.get(`/users/${id}`),
};

// ─── Chats APIs ──────────────────────────────────────────────────────
export const chatsAPI = {
  getAll: () => api.get('/chats'),
  getById: (id) => api.get(`/chats/${id}`),
  createOrGet: (memberId) => api.post('/chats', { memberId }),
  createGroup: (data) => api.post('/chats/group', data),
  updateGroup: (id, data) => api.patch(`/chats/${id}`, data),
  addMember: (id, userId) => api.post(`/chats/${id}/members`, { userId }),
  removeMember: (id, userId) =>
    api.delete(`/chats/${id}/members/${userId}`),
};

// ─── Messages APIs ───────────────────────────────────────────────────
export const messagesAPI = {
  getMessages: (chatId, page = 1, limit = 30) =>
    api.get(`/messages/${chatId}?page=${page}&limit=${limit}`),
  editMessage: (id, content) =>
    api.patch(`/messages/${id}`, { content }),
  deleteMessage: (id) => api.delete(`/messages/${id}`),
  react: (id, emoji) =>
    api.post(`/messages/${id}/react`, { emoji }),
};

// ─── Notifications APIs ──────────────────────────────────────────────
export const notificationsAPI = {
  getUnread: () => api.get('/notifications/unread'),
  markChatRead: (chatId) =>
    api.post(`/notifications/read-all/${chatId}`),
};

// ─── Media APIs ──────────────────────────────────────────────────────
export const mediaAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default api;