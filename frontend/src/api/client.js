import {
  applyMockTimewarp,
  createMockDeck,
  getMockDeckById,
  getMockDeckPath,
  getMockDecks,
  getMockDueCards,
  getMockHealth,
  getMockStats,
  resetMockTimewarp,
  submitMockCardGrade,
  submitMockExplainAnswer,
  updateMockSettings,
} from '../mocks/fixtures.js';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(path, options);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error?.message || 'Request could not be completed. Check that the local server is running.';
    const code = payload?.error?.code || 'request_failed';
    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function isUsingMocks() {
  return USE_MOCKS;
}

export async function fetchHealth() {
  if (USE_MOCKS) {
    await delay(120);
    return getMockHealth();
  }
  return request('/api/health');
}

export async function fetchStats() {
  if (USE_MOCKS) {
    await delay(160);
    return getMockStats();
  }
  return request('/api/stats');
}

export async function updateSettings(dailyGoal) {
  if (USE_MOCKS) {
    await delay(180);
    return updateMockSettings(dailyGoal);
  }
  return request('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_goal: dailyGoal }),
  });
}

export async function fetchDecks() {
  if (USE_MOCKS) {
    await delay(220);
    return getMockDecks();
  }
  return request('/api/decks');
}

export async function fetchDeck(deckId) {
  if (USE_MOCKS) {
    await delay(200);
    return getMockDeckById(deckId);
  }
  return request(`/api/decks/${encodeURIComponent(deckId)}`);
}

export async function uploadDeck(file) {
  if (USE_MOCKS) {
    await delay(300);
    return createMockDeck(file);
  }
  const formData = new FormData();
  formData.append('file', file);
  return request('/api/decks', {
    method: 'POST',
    body: formData,
  });
}

export async function fetchDeckPath(deckId) {
  if (USE_MOCKS) {
    await delay(220);
    return getMockDeckPath(deckId);
  }
  return request(`/api/decks/${encodeURIComponent(deckId)}/path`);
}

export async function fetchDueCards({ deckId, limit = 15 } = {}) {
  if (USE_MOCKS) {
    await delay(220);
    return getMockDueCards(deckId, limit);
  }
  const params = new URLSearchParams();
  if (deckId) {
    params.set('deck_id', deckId);
  }
  if (limit) {
    params.set('limit', String(limit));
  }
  const query = params.toString();
  return request(`/api/review/due${query ? `?${query}` : ''}`);
}

export async function submitCardGrade(cardId, grade) {
  if (USE_MOCKS) {
    await delay(180);
    return submitMockCardGrade(cardId, grade);
  }
  return request(`/api/review/${encodeURIComponent(cardId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grade }),
  });
}

export async function submitExplainAnswer(cardId, answer) {
  if (USE_MOCKS) {
    await delay(950);
    return submitMockExplainAnswer(cardId, answer);
  }
  return request(`/api/review/${encodeURIComponent(cardId)}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer }),
  });
}

export async function timewarp(days) {
  if (USE_MOCKS) {
    await delay(200);
    return applyMockTimewarp(days);
  }
  return request('/api/debug/timewarp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
}

export async function resetTimewarp() {
  if (USE_MOCKS) {
    await delay(180);
    return resetMockTimewarp();
  }
  return request('/api/debug/reset', {
    method: 'POST',
  });
}

