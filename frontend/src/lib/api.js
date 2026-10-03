/**
 * Centralized API client for DatePilot.
 * Uses VITE_API_URL or defaults to localhost:8000.
 */
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let errDetail = 'Request failed';
    try {
      const errJson = await res.json();
      errDetail = errJson.detail || errJson.message || errDetail;
    } catch {
      // ignore
    }
    throw new Error(errDetail);
  }

  return res.json();
}

export const api = {
  // Session
  createSession: (payload) =>
    request('/sessions/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getSession: (token) => request(`/sessions/${token}`),

  setPartnerBLimits: (tokenB, limits) =>
    request(`/sessions/${tokenB}/limits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(limits),
    }),

  getMatchSummary: (token) => request(`/sessions/${token}/match-summary`),

  // Taste
  uploadTasteFile: async (token, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request(`/taste/${token}/upload`, {
      method: 'POST',
      body: formData,
    });
  },

  submitTasteQuiz: (token, answers) =>
    request(`/taste/${token}/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    }),

  confirmTasteCard: (token, card) =>
    request(`/taste/${token}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    }),

  getConfirmedTaste: (token) => request(`/taste/${token}`),

  deleteMyData: (token) =>
    request(`/taste/${token}`, {
      method: 'DELETE',
    }),

  // Plan
  generatePlan: (tokenA) =>
    request(`/plan/${tokenA}/generate`, {
      method: 'POST',
    }),

  getCurrentPlan: (token) => request(`/plan/${token}/current`),

  swapStop: (token, planIndex, stopIndex) =>
    request(`/plan/${token}/swap/${planIndex}/${stopIndex}`, {
      method: 'POST',
    }),

  triggerRainMode: (token, planIndex) =>
    request(`/plan/${token}/rain-mode/${planIndex}`, {
      method: 'POST',
    }),

  // Memory & Feedback
  rateStop: (token, feedback) =>
    request(`/memory/${token}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback),
    }),

  getMemoryInsights: (token) => request(`/memory/${token}/insights`),
};
