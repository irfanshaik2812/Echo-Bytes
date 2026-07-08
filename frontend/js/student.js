/**
 * ECHO BYTES – Student Panel JS
 * Handles: announcement feed, category filter, view tracking,
 * audio playback, hide/unhide, hidden panel.
 */

let currentUser      = null;
let currentCategory  = 'All';
let activeAudios     = {};

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initStudent();
});

async function initStudent() {
  try {
    const data = await api.get('/auth/me');
    if (!data?.user || data.user.role !== 'student') {
      window.location.href = '/index.html';
      return;
    }
    currentUser = data.user;
    const displayName = currentUser.username.split('@')[0];
    document.getElementById('user-name').textContent = displayName;
    document.getElementById('user-avatar').textContent = displayName[0].toUpperCase();

    loadFeed();
  } catch {
    window.location.href = '/index.html';
  }
}

// ── PANEL SWITCHING ───────────────────────────────────────
function showStudentPanel(id) {
  document.querySelectorAll('.student-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.student-nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById(`panel-${id}`)?.classList.add('active');
  document.querySelector(`[data-panel="${id}"]`)?.classList.add('active');

  if (id === 'hidden') loadHidden();
}

// ── LOGOUT ────────────────────────────────────────────────
async function logout() {
  try { await api.post('/auth/logout', {}); } finally { window.location.href = '/'; }
}

// ── CATEGORY FILTER ───────────────────────────────────────
function filterCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.cat-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
  loadFeed();
}

// ── FEED ──────────────────────────────────────────────────
async function loadFeed() {
  const feed = document.getElementById('ann-feed');
  feed.innerHTML = `<div class="empty-state"><span class="empty-icon">📻</span><h3>Loading…</h3></div>`;
  try {
    const params = currentCategory !== 'All' ? `?category=${encodeURIComponent(currentCategory)}` : '';
    const data = await api.get(`/announcements/student/feed${params}`);
    renderFeed(data.announcements);
  } catch (err) {
    feed.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Failed to load</h3><p>${escHtml(err.message)}</p></div>`;
  }
}

function renderFeed(announcements) {
  const feed = document.getElementById('ann-feed');
  if (!announcements.length) {
    feed.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <h3>No announcements</h3>
        <p>Nothing in this category yet. Check back later!</p>
      </div>`;
    return;
  }
  feed.innerHTML = announcements.map(a => buildAnnouncementCard(a)).join('');
  setTimeout(setupViewTracking, 150);
}

function buildAnnouncementCard(a) {
  const id = `ann-${a.id}`;
  const categoryBadgeClass = {
    'Urgent': 'badge-red', 'Academic': 'badge-purple',
    'Events': 'badge-gold', 'Sports': 'badge-green'
  }[a.category] || 'badge-gray';

  const audioHtml = a.audio_file
    ? buildStudentAudioPlayer(`/uploads/audio/${a.audio_file}`, `audio-${a.id}`)
    : '';

  return `
    <article class="ann-card" id="${id}" data-id="${a.id}">
      <div class="ann-card-header">
        <div class="ann-card-left">
          <div class="ann-card-meta">
            <span class="badge ${categoryBadgeClass}">${escHtml(a.category)}</span>
            ${a.audio_file ? `<span class="badge badge-purple" title="Has audio">🎙️ Audio</span>` : ''}
          </div>
          <h2 class="ann-card-title">${escHtml(a.title)}</h2>
        </div>
        <div class="ann-card-actions">
          <button class="btn btn-ghost btn-xs" onclick="hideAnnouncement(${a.id})" title="Hide this announcement">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </button>
        </div>
      </div>

      <div class="ann-card-body">
        <div class="ann-content">${a.content}</div>
        ${audioHtml}
      </div>

      <div class="ann-card-footer">
        <span class="ann-date">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${formatDate(a.publish_date)}
        </span>
        <span class="text-xs text-muted">By ${escHtml(a.created_by_name?.split('@')[0] || 'Admin')}</span>
      </div>
    </article>
  `;
}

// ── VIEW TRACKING ─────────────────────────────────────────
// Track view when card enters viewport using IntersectionObserver
function setupViewTracking() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.dataset.id;
        if (id) {
          api.post(`/announcements/${id}/view`, {}).catch(() => {});
          observer.unobserve(entry.target);
        }
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.ann-card[data-id]').forEach(card => observer.observe(card));
}

// ── HIDE ──────────────────────────────────────────────────
async function hideAnnouncement(id) {
  try {
    await api.post(`/announcements/${id}/hide`, {});
    const card = document.getElementById(`ann-${id}`);
    if (card) {
      card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      card.style.opacity    = '0';
      card.style.transform  = 'scale(0.95)';
      setTimeout(() => card.remove(), 300);
    }
    showToast('Hidden', 'Announcement removed from your feed.', 'info');
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

// ── HIDDEN PANEL ──────────────────────────────────────────
async function loadHidden() {
  const container = document.getElementById('hidden-feed');
  try {
    const data = await api.get('/announcements/student/hidden');
    if (!data.announcements.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🙈</span>
          <h3>Nothing hidden</h3>
          <p>Announcements you hide will appear here</p>
        </div>`;
      return;
    }
    container.innerHTML = data.announcements.map(a => `
      <div class="hidden-card" id="hc-${a.id}">
        <div class="hidden-card-info">
          <div class="hidden-card-title">${escHtml(a.title)}</div>
          <div class="hidden-card-meta">${escHtml(a.category)} · Hidden ${timeAgo(a.hidden_at)}</div>
        </div>
        <button class="btn btn-ghost btn-xs" onclick="restoreAnnouncement(${a.id})" title="Restore to feed">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.38"/></svg>
          Restore
        </button>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Failed to load</h3></div>`;
  }
}

async function restoreAnnouncement(id) {
  try {
    await api.delete(`/announcements/${id}/hide`);
    const el = document.getElementById(`hc-${id}`);
    if (el) { el.style.opacity = '0'; setTimeout(() => { el.remove(); loadHidden(); }, 300); }
    showToast('Restored', 'Announcement is back in your feed.', 'success');
    loadFeed();
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

// ── AUDIO PLAYER ──────────────────────────────────────────
function buildStudentAudioPlayer(src, uid) {
  return `
    <audio id="${uid}-el" src="${src}" preload="metadata" style="display:none;"></audio>
    <div class="audio-player">
      <button type="button" class="audio-play-btn" onclick="toggleStudentAudio('${uid}')" aria-label="Play/pause audio">
        <svg id="${uid}-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <input type="range" class="audio-progress" id="${uid}-prog" value="0" min="0" max="100" step="0.1"
             oninput="seekStudentAudio('${uid}', this.value)" aria-label="Audio progress">
      <span class="audio-time" id="${uid}-time">0:00</span>
    </div>
  `;
}

function toggleStudentAudio(uid) {
  const el = document.getElementById(`${uid}-el`);
  if (!el) return;

  // Pause any other playing audio
  Object.keys(activeAudios).forEach(k => {
    if (k !== uid && activeAudios[k]) {
      activeAudios[k].pause();
      document.getElementById(`${k}-icon`).innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
  });

  if (el.paused) {
    el.play();
    activeAudios[uid] = el;
    el.ontimeupdate = () => {
      const pct = el.duration ? (el.currentTime / el.duration) * 100 : 0;
      document.getElementById(`${uid}-prog`).value = pct;
      const m = Math.floor(el.currentTime / 60);
      const s = Math.floor(el.currentTime % 60);
      document.getElementById(`${uid}-time`).textContent = `${m}:${s.toString().padStart(2,'0')}`;
    };
    el.onended = () => {
      document.getElementById(`${uid}-icon`).innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
      document.getElementById(`${uid}-prog`).value = 0;
      document.getElementById(`${uid}-time`).textContent = '0:00';
    };
    document.getElementById(`${uid}-icon`).innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  } else {
    el.pause();
    document.getElementById(`${uid}-icon`).innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
  }
}

function seekStudentAudio(uid, pct) {
  const el = document.getElementById(`${uid}-el`);
  if (el && el.duration) el.currentTime = (pct / 100) * el.duration;
}
