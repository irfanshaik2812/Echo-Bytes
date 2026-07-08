/**
 * ECHO BYTES – API Client
 * A thin fetch wrapper that sends cookies and handles common errors.
 */

const API = '/api';

async function apiFetch(endpoint, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

  const config = {
    credentials: 'include',
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  };

  if (!isFormData && config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(API + endpoint, config);

  // Handle 401 – redirect to login (except on auth page itself)
  if (res.status === 401 && !window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
    window.location.href = '/';
    return;
  }

  // CSV download: return blob
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/csv')) {
    const blob = await res.blob();
    return blob;
  }

  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const api = {
  get:    (url)         => apiFetch(url, { method: 'GET' }),
  post:   (url, body)   => apiFetch(url, { method: 'POST',   body }),
  put:    (url, body)   => apiFetch(url, { method: 'PUT',    body }),
  delete: (url)         => apiFetch(url, { method: 'DELETE' }),
};

// ── Toast ────────────────────────────────────────────────
function showToast(title, body = '', type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <div class="toast-title">${escHtml(title)}</div>
    ${body ? `<div class="toast-body">${escHtml(body)}</div>` : ''}
  `;
  container.appendChild(el);
  el.onclick = () => dismissToast(el);
  setTimeout(() => dismissToast(el), duration);
}

function dismissToast(el) {
  if (!el.isConnected) return;
  el.classList.add('toast-exit');
  setTimeout(() => el.remove(), 300);
}

// ── Confirm Dialog ────────────────────────────────────────
function showConfirm(message, onConfirm, title = 'Confirm Action') {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <h3>${escHtml(title)}</h3>
      <p>${escHtml(message)}</p>
      <div class="confirm-actions">
        <button class="btn btn-ghost" id="cf-cancel">Cancel</button>
        <button class="btn btn-danger" id="cf-ok">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#cf-cancel').onclick = () => overlay.remove();
  overlay.querySelector('#cf-ok').onclick = () => { overlay.remove(); onConfirm(); };
}

// ── Helpers ───────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
