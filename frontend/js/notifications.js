/**
 * ECHO BYTES – Notification Manager (Socket.IO)
 * Used on the student page.
 * Handles: bell badge, dropdown, real-time toasts, mark-read.
 */

let notifDropdownOpen = false;
let socket = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initNotifications();
});

async function initNotifications() {
  // Wait for student auth to resolve user
  await new Promise(r => setTimeout(r, 600));
  const userEl = document.getElementById('user-name');
  if (!userEl) return;

  loadNotifications();
  connectSocket();
}

// ── SOCKET.IO ─────────────────────────────────────────────
function connectSocket() {
  try {
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      // Join room after a short delay to let auth resolve
      setTimeout(async () => {
        try {
          const data = await api.get('/auth/me');
          if (data?.user?.role === 'student') {
            socket.emit('join-student-room', data.user.id);
          }
        } catch {}
      }, 300);
    });

    socket.on('new-announcement', (data) => {
      // Show toast notification
      showToast(`📢 ${data.title}`, data.preview, 'info', 7000);
      // Refresh notification bell/dropdown
      loadNotifications();
      // Refresh the announcement feed so the new card appears immediately
      if (typeof loadFeed === 'function') {
        loadFeed();
      }
    });

    socket.on('disconnect', () => {});
  } catch (err) {
    console.warn('[Socket] Not available:', err.message);
  }
}

// ── LOAD NOTIFICATIONS ────────────────────────────────────
async function loadNotifications() {
  try {
    const [notifData, countData] = await Promise.all([
      api.get('/notifications'),
      api.get('/notifications/unread-count')
    ]);

    updateBadge(countData.count);
    renderNotifications(notifData.notifications);
  } catch {}
}

function updateBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderNotifications(notifications) {
  const list = document.getElementById('notif-list');
  if (!list) return;

  if (!notifications.length) {
    list.innerHTML = `<div class="notif-empty">No notifications yet</div>`;
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="onNotifClick(${n.id}, ${n.announcement_id})" data-id="${n.id}">
      ${!n.is_read ? '<div class="notif-dot"></div>' : '<div style="width:8px;"></div>'}
      <div class="notif-item-content">
        <div class="notif-item-title">${escHtml(n.title)}</div>
        <div class="notif-item-preview">${escHtml(n.preview || '')}</div>
        <div class="notif-item-time">${timeAgo(n.created_at)}</div>
      </div>
    </div>
  `).join('');
}

// ── DROPDOWN TOGGLE ───────────────────────────────────────
function toggleNotifDropdown() {
  const dropdown = document.getElementById('notif-dropdown');
  const bell     = document.getElementById('notif-bell');
  notifDropdownOpen = !notifDropdownOpen;
  dropdown.classList.toggle('hidden', !notifDropdownOpen);
  bell.setAttribute('aria-expanded', notifDropdownOpen.toString());

  if (notifDropdownOpen) {
    loadNotifications();
    // Close when clicking outside
    setTimeout(() => {
      document.addEventListener('click', closeDropdownOutside, { once: true });
    }, 10);
  }
}

function closeDropdownOutside(e) {
  const dropdown = document.getElementById('notif-dropdown');
  const bell     = document.getElementById('notif-bell');
  if (!dropdown?.contains(e.target) && !bell?.contains(e.target)) {
    dropdown?.classList.add('hidden');
    bell?.setAttribute('aria-expanded', 'false');
    notifDropdownOpen = false;
  }
}

// ── MARK READ ─────────────────────────────────────────────
async function onNotifClick(notifId, announcementId) {
  try {
    await api.put(`/notifications/${notifId}/read`, {});
    // Update visual
    const item = document.querySelector(`.notif-item[data-id="${notifId}"]`);
    if (item) {
      item.classList.remove('unread');
      const dot = item.querySelector('.notif-dot');
      if (dot) { dot.style.background = 'transparent'; }
    }
    loadNotifications(); // refresh badge count
  } catch {}
}

async function markAllNotifRead() {
  try {
    await api.put('/notifications/read-all', {});
    showToast('Done', 'All notifications marked as read.', 'success');
    loadNotifications();
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}
