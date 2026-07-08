/**
 * ECHO BYTES – Admin Panel JS
 * Handles all admin panel logic: dashboard, announcements, create/edit,
 * analytics (Chart.js), viewer tracking, search history, audio recording.
 */

let currentUser      = null;
let quill            = null;
let mediaRecorder    = null;
let recordedChunks   = [];
let recordingTimer   = null;
let recordingSeconds = 0;
let recordedBlob     = null;
let uploadedFile     = null;
let existingAudioFilename = null; // Tracks original audio when editing
let audioMode        = 'record';
let editingId        = null;
let viewsChart       = null;
let allAnnouncements = [];
let isSubmitting     = false; // duplicate-submit guard

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initAdmin();
});

async function initAdmin() {
  try {
    const data = await api.get('/auth/me');
    if (!data?.user || data.user.role !== 'admin') {
      window.location.href = '/index.html'; // go directly to login, skip landing
      return;
    }
    currentUser = data.user;
    document.getElementById('user-name').textContent   = currentUser.username.split('@')[0];
    document.getElementById('user-avatar').textContent = currentUser.username[0].toUpperCase();

    // Quill init is kept separate so a CDN hiccup doesn't redirect the whole page
    try {
      initQuill();
    } catch (qErr) {
      console.warn('[ECHO BYTES] Quill init failed:', qErr.message);
      // Submit handler will retry on-demand
    }

    loadDashboard();
    loadAnnouncements();
    setDefaultPublishDate();
  } catch {
    window.location.href = '/index.html'; // auth error → go to login page
  }
}

// ── PANEL NAVIGATION ──────────────────────────────────────
function showPanel(id) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.getElementById(`panel-${id}`)?.classList.add('active');
  document.querySelector(`[data-panel="${id}"]`)?.classList.add('active');
}

// ── LOGOUT ────────────────────────────────────────────────
async function logout() {
  try { await api.post('/auth/logout', {}); } finally { window.location.href = '/'; }
}

// ── QUILL INIT ────────────────────────────────────────────
function initQuill() {
  quill = new Quill('#quill-editor', {
    theme: 'snow',
    placeholder: 'Write your announcement content here…',
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['clean']
      ]
    }
  });
}

// ── DASHBOARD ────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await api.get('/analytics/dashboard');
    document.getElementById('stat-total').textContent    = data.totalAnnouncements;
    document.getElementById('stat-students').textContent = data.totalStudents;
    document.getElementById('stat-views').textContent    = data.totalViews;
    document.getElementById('stat-today').textContent    = data.viewsToday;

    const tbody = document.getElementById('dash-recent-body');
    if (!data.recentAnnouncements.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding:20px;">No announcements yet</td></tr>`;
      return;
    }
    tbody.innerHTML = data.recentAnnouncements.map(a => `
      <tr>
        <td class="td-title">${escHtml(a.title)}</td>
        <td><span class="badge badge-purple">${escHtml(a.category)}</span></td>
        <td class="text-sm">${formatDate(a.publish_date)}</td>
        <td><strong>${a.views}</strong></td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Dashboard error', err.message, 'error');
  }
}

// ── ANNOUNCEMENTS LIST ────────────────────────────────────
async function loadAnnouncements() {
  const q        = document.getElementById('search-input').value.trim();
  const category = document.getElementById('filter-category').value;
  const dateFrom = document.getElementById('filter-date-from').value;
  const dateTo   = document.getElementById('filter-date-to').value;

  const endpoint = (q || dateFrom || dateTo)
    ? `/announcements/admin/search?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&date_from=${dateFrom}&date_to=${dateTo}`
    : '/announcements/admin/list';

  try {
    const data = await api.get(endpoint);
    allAnnouncements = data.announcements;
    renderAnnouncementsTable(allAnnouncements);
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

function renderAnnouncementsTable(list) {
  const tbody = document.getElementById('ann-table-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">📢</span><h3>No announcements found</h3><p>Create your first announcement to get started</p></div></td></tr>`;
    return;
  }
  const now = new Date();
  tbody.innerHTML = list.map(a => {
    const published = new Date(a.publish_date) <= now;
    const status = published
      ? `<span class="badge badge-green">Published</span>`
      : `<span class="badge badge-gray">Scheduled</span>`;
    return `
      <tr>
        <td class="td-title">${escHtml(a.title)}</td>
        <td><span class="badge badge-purple">${escHtml(a.category)}</span></td>
        <td class="text-sm">${formatDate(a.publish_date)}</td>
        <td>${a.total_views} <span class="text-muted text-xs">(${a.unique_views} unique)</span></td>
        <td>${status}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-xs" onclick="editAnnouncement(${a.id})" title="Edit">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="deleteAnnouncement(${a.id})" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ── SEARCH ────────────────────────────────────────────────
let searchDebounce;
function onSearchInput() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadAnnouncements, 400);
}

function clearFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-category').value = 'All';
  document.getElementById('filter-date-from').value = '';
  document.getElementById('filter-date-to').value = '';
  loadAnnouncements();
}

// ── SEARCH HISTORY ────────────────────────────────────────
async function showSearchHistory() {
  try {
    const data = await api.get('/announcements/search/history');
    const dropdown = document.getElementById('recent-searches-dropdown');
    if (!data.history.length) { dropdown.classList.add('hidden'); return; }

    dropdown.innerHTML = `
      <div class="rs-header">
        <span>Recent Searches</span>
        <button class="btn btn-ghost btn-xs" onmousedown="clearSearchHistoryNow()">Clear</button>
      </div>
      ${data.history.map(h => `
        <div class="rs-item" onmousedown="applySearchHistory('${escHtml(h.query).replace(/'/g,"\\'")}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.38"/></svg>
          ${escHtml(h.query)}
        </div>
      `).join('')}
    `;
    dropdown.classList.remove('hidden');
  } catch {}
}

function hideSearchHistory() {
  setTimeout(() => {
    document.getElementById('recent-searches-dropdown')?.classList.add('hidden');
  }, 200);
}

function applySearchHistory(q) {
  document.getElementById('search-input').value = q;
  loadAnnouncements();
}

async function clearSearchHistoryNow() {
  try {
    await api.delete('/announcements/search/history');
    document.getElementById('recent-searches-dropdown').classList.add('hidden');
  } catch {}
}

// ── CREATE / EDIT FORM ────────────────────────────────────
function setDefaultPublishDate() {
  const el = document.getElementById('ann-publish-date');
  if (el) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    el.value = now.toISOString().slice(0, 16);
  }
}

function resetCreateForm() {
  // Stop any active recording first
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream?.getTracks().forEach(t => t.stop());
  }
  clearInterval(recordingTimer);

  // Reset state variables
  editingId        = null;
  recordedBlob     = null;
  uploadedFile     = null;
  existingAudioFilename = null;
  recordedChunks   = [];
  recordingSeconds = 0;
  audioMode        = 'record';
  isSubmitting     = false;

  // Reset form fields
  document.getElementById('create-form').reset();
  document.getElementById('edit-ann-id').value = '';

  // Reset labels
  document.getElementById('create-title').textContent    = 'New Announcement';
  document.getElementById('create-subtitle').textContent  = 'Broadcast to all students';
  document.getElementById('create-btn-text').textContent  = 'Publish Announcement';

  // Clear Quill
  if (quill) quill.setText('');

  // Reset audio recording UI
  document.getElementById('record-preview').classList.add('hidden');
  document.getElementById('record-preview').innerHTML = '';
  document.getElementById('record-status').textContent = 'Click to start recording';
  document.getElementById('record-timer').textContent  = '0:00';
  document.getElementById('record-controls').style.display = 'none';
  document.getElementById('record-btn').classList.remove('recording');

  // Reset audio upload UI
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-preview').innerHTML = '';
  const fileInput = document.getElementById('audio-file-input');
  if (fileInput) fileInput.value = ''; // clear the file input

  // Reset audio mode tabs — show record, hide upload
  document.querySelectorAll('.audio-mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mode-record').classList.add('active');
  document.getElementById('record-ui').classList.remove('hidden');
  document.getElementById('upload-ui').classList.add('hidden');

  setDefaultPublishDate();
}

async function editAnnouncement(id) {
  try {
    const data = await api.get(`/announcements/${id}`);
    const a = data.announcement;
    editingId = id;

    showPanel('create');
    document.getElementById('create-title').textContent    = 'Edit Announcement';
    document.getElementById('create-subtitle').textContent  = 'Update and republish';
    document.getElementById('create-btn-text').textContent  = 'Save Changes';
    document.getElementById('edit-ann-id').value = id;
    document.getElementById('ann-title').value    = a.title;
    document.getElementById('ann-category').value = a.category;

    // Set datetime-local in local time
    const dt = new Date(a.publish_date);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    document.getElementById('ann-publish-date').value = dt.toISOString().slice(0, 16);

    // Set Quill content
    if (quill) quill.clipboard.dangerouslyPasteHTML(a.content);

    // Show existing audio if any
    existingAudioFilename = null;
    if (a.audio_file) {
      existingAudioFilename = a.audio_file;
      const preview = document.getElementById('record-preview');
      preview.innerHTML = buildAudioPlayerWithDelete(`/uploads/audio/${a.audio_file}`, a.audio_file, 'existing');
      preview.classList.remove('hidden');
      document.getElementById('record-status').textContent = 'Existing audio attached';
    }
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

// ── SUBMIT (CREATE / UPDATE) ──────────────────────────────
async function submitAnnouncement(e) {
  e.preventDefault();

  // Duplicate-submit guard
  if (isSubmitting) return;

  // ── STEP 1: Read plain inputs FIRST, before touching Quill ──────────
  const titleEl = document.getElementById('ann-title');
  if (!titleEl) {
    showToast('Internal error', 'Title input not found (id=ann-title). Please refresh.', 'error');
    return;
  }
  const title = titleEl.value.trim();

  const categoryEl = document.getElementById('ann-category');
  const category   = categoryEl ? categoryEl.value : 'General';

  const dateEl      = document.getElementById('ann-publish-date');
  const publishDate = dateEl ? dateEl.value : '';

  // Visible in DevTools → tells us exactly what the browser actually read
  console.log('[ECHO BYTES] Submit values —',
    'title:', JSON.stringify(title),
    '| category:', category,
    '| date:', publishDate);

  // ── STEP 2: Validate plain fields ────────────────────────────────────
  if (!title) {
    showToast('Missing title', 'Please enter an announcement title.', 'error');
    titleEl.focus();
    return;
  }
  if (!publishDate) {
    showToast('Missing date', 'Please set a publish date and time.', 'error');
    return;
  }

  // ── STEP 3: Read Quill content ────────────────────────────────────────
  let content     = '';
  let contentText = '';

  if (!quill) {
    // Try a one-shot re-init — use qErr NOT e to avoid shadowing the submit event
    try { initQuill(); } catch (qErr) {
      console.warn('[ECHO BYTES] Quill re-init failed:', qErr.message);
    }
  }

  if (quill) {
    content     = quill.root.innerHTML;
    contentText = quill.getText().trim();
  } else {
    // Last-resort: read directly from .ql-editor DOM node
    const qlEditor = document.querySelector('.ql-editor');
    if (qlEditor) {
      content     = qlEditor.innerHTML;
      contentText = (qlEditor.textContent || '').trim();
    } else {
      showToast('Editor not loaded', 'Please refresh the page and try again.', 'error');
      return;
    }
  }

  const plainContent = contentText || content.replace(/<[^>]*>/g, '').trim();
  if (!plainContent) {
    showToast('Missing content', 'Please write the announcement content.', 'error');
    return;
  }

  // ── STEP 4: Loading state ─────────────────────────────────────────────
  const btn     = document.getElementById('create-submit-btn');
  const spinner = document.getElementById('create-spinner');
  const btnText = document.getElementById('create-btn-text');
  const origText = btnText ? btnText.textContent : 'Publish Announcement';

  isSubmitting = true;
  if (btn)     btn.disabled = true;
  if (spinner) spinner.classList.remove('hidden');
  if (btnText) btnText.textContent = 'Publishing\u2026';

  // ── STEP 5: Send to server ────────────────────────────────────────────
  try {
    const formData = new FormData();
    formData.append('title',        title);
    formData.append('content',      content);
    formData.append('category',     category);
    formData.append('publish_date', new Date(publishDate).toISOString());

    // Audio is optional — only one source at a time
    if (audioMode === 'record' && recordedBlob) {
      formData.append('audio', recordedBlob, 'recording.webm');
    } else if (audioMode === 'upload' && uploadedFile) {
      formData.append('audio', uploadedFile);
    }

    const editId = document.getElementById('edit-ann-id') ? document.getElementById('edit-ann-id').value : '';
    if (editId) {
      if (!existingAudioFilename) {
        formData.append('delete_audio', 'true');
      }
      await api.put('/announcements/' + editId, formData);
      showToast('Updated \u2713', 'Announcement updated successfully.', 'success');
    } else {
      await api.post('/announcements', formData);
      showToast('Published \u2713', 'Announcement sent to all students.', 'success');
    }

    resetCreateForm();
    showPanel('announcements');
    loadAnnouncements();
    loadDashboard();

  } catch (submitErr) {
    console.error('[ECHO BYTES] Publish error:', submitErr);
    showToast('Publish failed', submitErr.message || 'Server error. Please try again.', 'error');
  } finally {
    isSubmitting = false;
    if (btn)     btn.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = editingId ? origText : 'Publish Announcement';
  }
}



async function deleteAnnouncement(id) {
  showConfirm('This announcement will be permanently deleted. Students will no longer see it.', async () => {
    try {
      await api.delete(`/announcements/${id}`);
      showToast('Deleted', 'Announcement removed.', 'success');
      loadAnnouncements();
      loadDashboard();
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  }, 'Delete Announcement');
}

// ── AUDIO MODE SWITCHING ──────────────────────────────────
function setAudioMode(mode) {
  audioMode = mode;
  document.querySelectorAll('.audio-mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`mode-${mode}`).classList.add('active');
  document.getElementById('record-ui').classList.toggle('hidden', mode !== 'record');
  document.getElementById('upload-ui').classList.toggle('hidden', mode !== 'upload');

  // Only one audio source at a time — clear the other
  if (mode === 'record') {
    removeUploadedFile();
  } else {
    removeRecording();
  }
}

// ── REMOVE RECORDED AUDIO ─────────────────────────────────
function removeRecording() {
  // Stop microphone if still active
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream?.getTracks().forEach(t => t.stop());
  }
  clearInterval(recordingTimer);
  recordingSeconds = 0;

  recordedBlob   = null;
  recordedChunks = [];

  document.getElementById('record-btn').classList.remove('recording');
  document.getElementById('record-status').textContent = 'Click to start recording';
  document.getElementById('record-timer').textContent  = '0:00';
  document.getElementById('record-controls').style.display = 'none';
  document.getElementById('record-preview').classList.add('hidden');
  document.getElementById('record-preview').innerHTML = '';
}

// ── REMOVE UPLOADED FILE ──────────────────────────────────
function removeUploadedFile() {
  uploadedFile = null;
  const fileInput = document.getElementById('audio-file-input');
  if (fileInput) fileInput.value = '';
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-preview').innerHTML = '';
}

// ── REMOVE EXISTING AUDIO (EDIT MODE) ─────────────────────
function removeExistingAudio() {
  existingAudioFilename = null;
  document.getElementById('record-status').textContent = 'Click to start recording';
  document.getElementById('record-preview').classList.add('hidden');
  document.getElementById('record-preview').innerHTML = '';
}

// ── AUDIO RECORDING ───────────────────────────────────────
async function toggleRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    await startRecording();
  } else {
    stopRecording();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    recordedBlob   = null;

    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = finalizeRecording;
    mediaRecorder.start();

    document.getElementById('record-btn').classList.add('recording');
    document.getElementById('record-status').textContent = 'Recording…';
    document.getElementById('record-controls').style.display = 'flex';
    document.getElementById('record-preview').classList.add('hidden');

    recordingSeconds = 0;
    document.getElementById('record-timer').textContent = '0:00';
    recordingTimer = setInterval(() => {
      recordingSeconds++;
      const m = Math.floor(recordingSeconds / 60);
      const s = recordingSeconds % 60;
      document.getElementById('record-timer').textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);
  } catch (err) {
    showToast('Microphone error', 'Please allow microphone access and try again.', 'error');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  clearInterval(recordingTimer);
  document.getElementById('record-btn').classList.remove('recording');
  document.getElementById('record-controls').style.display = 'none';
  document.getElementById('record-status').textContent = 'Recording saved ✓';
}

// Called by mediaRecorder.onstop
function finalizeRecording() {
  recordedBlob = new Blob(recordedChunks, { type: 'audio/webm' });
  const url    = URL.createObjectURL(recordedBlob);
  const label  = `Recording (${document.getElementById('record-timer').textContent})`;

  const preview = document.getElementById('record-preview');
  preview.innerHTML = `
    <div class="audio-file-row">
      <div class="audio-file-name">🎙️ ${escHtml(label)}</div>
      <button type="button" class="btn btn-danger btn-xs audio-remove-btn"
              onclick="removeRecording()" title="Delete this recording">
        ✕ Delete Recording
      </button>
    </div>
    ${buildAudioPlayer(url, label)}
  `;
  preview.classList.remove('hidden');
}

// Legacy alias so discardRecording button in HTML still works
function discardRecording() { removeRecording(); }

// ── FILE UPLOAD ───────────────────────────────────────────
function onAudioFileSelected(input) {
  const file = input.files[0];
  if (!file) return;

  // Validate it's audio
  if (!file.type.startsWith('audio/')) {
    showToast('Invalid file', 'Please select an audio file (mp3, wav, ogg, etc.).', 'error');
    input.value = '';
    return;
  }

  uploadedFile = file;
  const url = URL.createObjectURL(file);

  const preview = document.getElementById('upload-preview');
  preview.innerHTML = `
    <div class="audio-file-row">
      <div class="audio-file-name">📎 ${escHtml(file.name)}</div>
      <button type="button" class="btn btn-danger btn-xs audio-remove-btn"
              onclick="removeUploadedFile()" title="Remove this file">
        ✕ Remove File
      </button>
    </div>
    ${buildAudioPlayer(url, file.name)}
  `;
  preview.classList.remove('hidden');
}

// ── AUDIO PLAYER HTML ─────────────────────────────────────
function buildAudioPlayer(src, label) {
  const id = 'audio-' + Math.random().toString(36).slice(2, 7);
  return `
    <audio id="${id}-el" src="${src}" preload="metadata" style="display:none;"></audio>
    <div class="audio-player">
      <button type="button" class="audio-play-btn" onclick="toggleAudio('${id}')" aria-label="Play/pause">
        <svg id="${id}-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <input type="range" class="audio-progress" id="${id}-prog" value="0" min="0" max="100" step="0.1"
             oninput="seekAudio('${id}', this.value)" aria-label="Audio progress">
      <span class="audio-time" id="${id}-time">0:00</span>
    </div>
  `;
}

// Alias used in editAnnouncement for existing audio (admin can remove on save)
function buildAudioPlayerWithDelete(src, filename, type) {
  const id = 'audio-' + Math.random().toString(36).slice(2, 7);
  return `
    <div class="audio-file-row">
      <div class="audio-file-name">🎵 ${escHtml(filename)}</div>
      <button type="button" class="btn btn-danger btn-xs audio-remove-btn"
              onclick="removeExistingAudio()" title="Remove audio">
        ✕ Remove Audio
      </button>
    </div>
    <audio id="${id}-el" src="${src}" preload="metadata" style="display:none;"></audio>
    <div class="audio-player">
      <button type="button" class="audio-play-btn" onclick="toggleAudio('${id}')" aria-label="Play/pause">
        <svg id="${id}-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <input type="range" class="audio-progress" id="${id}-prog" value="0" min="0" max="100" step="0.1"
             oninput="seekAudio('${id}', this.value)" aria-label="Audio progress">
      <span class="audio-time" id="${id}-time">0:00</span>
    </div>
  `;
}

function toggleAudio(id) {
  const el = document.getElementById(`${id}-el`);
  if (!el) return;
  if (el.paused) {
    el.play();
    el.ontimeupdate = () => updateAudioProgress(id, el);
    el.onended = () => {
      document.getElementById(`${id}-icon`).innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
      document.getElementById(`${id}-prog`).value = 0;
    };
    document.getElementById(`${id}-icon`).innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  } else {
    el.pause();
    document.getElementById(`${id}-icon`).innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
  }
}

function updateAudioProgress(id, el) {
  const pct = el.duration ? (el.currentTime / el.duration) * 100 : 0;
  document.getElementById(`${id}-prog`).value = pct;
  const m = Math.floor(el.currentTime / 60);
  const s = Math.floor(el.currentTime % 60);
  document.getElementById(`${id}-time`).textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function seekAudio(id, pct) {
  const el = document.getElementById(`${id}-el`);
  if (el && el.duration) el.currentTime = (pct / 100) * el.duration;
}

// ── ANALYTICS ────────────────────────────────────────────
async function loadAnalyticsList() {
  try {
    const data = await api.get('/announcements/admin/list');
    const sel = document.getElementById('analytics-ann-select');
    sel.innerHTML = `<option value="">— Select an Announcement —</option>` +
      data.announcements.map(a => `<option value="${a.id}">${escHtml(a.title)}</option>`).join('');
  } catch {}
}

async function loadAnalyticsData() {
  const id       = document.getElementById('analytics-ann-select').value;
  const dateFrom = document.getElementById('analytics-date-from').value;
  const dateTo   = document.getElementById('analytics-date-to').value;

  const exportBtn = document.getElementById('export-csv-btn');
  exportBtn.disabled = !id;
  if (!id) {
    document.getElementById('analytics-content').innerHTML = `<div class="empty-state"><span class="empty-icon">📊</span><h3>Select an Announcement</h3></div>`;
    return;
  }

  try {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    const data = await api.get(`/analytics/announcement/${id}?${params}`);

    document.getElementById('analytics-content').innerHTML = `
      <div class="analytics-stats">
        <div class="analytics-stat"><div class="analytics-stat-value">${data.totalViews}</div><div class="analytics-stat-label">Total Views</div></div>
        <div class="analytics-stat"><div class="analytics-stat-value">${data.uniqueViewers}</div><div class="analytics-stat-label">Unique Viewers</div></div>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">Views Over Time</div>
        <canvas id="views-chart" height="120"></canvas>
      </div>
    `;

    if (viewsChart) { viewsChart.destroy(); viewsChart = null; }

    const ctx = document.getElementById('views-chart').getContext('2d');
    viewsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.viewsByDate.map(d => d.date),
        datasets: [{
          label: 'Views',
          data: data.viewsByDate.map(d => d.count),
          backgroundColor: 'rgba(201,162,39,0.35)',
          borderColor: '#c9a227',
          borderWidth: 2,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { color: '#8a7aaa' } },
          y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { color: '#8a7aaa', stepSize: 1 } }
        }
      }
    });
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

async function exportAnalyticsCSV() {
  const id = document.getElementById('analytics-ann-select').value;
  if (!id) return;
  try {
    const blob = await api.get(`/analytics/announcement/${id}/csv`);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `analytics_${id}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('Export ready', 'CSV downloaded successfully.', 'success');
  } catch (err) {
    showToast('Export error', err.message, 'error');
  }
}

// ── VIEWER TRACKING ───────────────────────────────────────
async function loadViewersList() {
  try {
    const data = await api.get('/announcements/admin/list');
    const sel = document.getElementById('viewers-ann-select');
    sel.innerHTML = `<option value="">— Select an Announcement —</option>` +
      data.announcements.map(a => `<option value="${a.id}">${escHtml(a.title)}</option>`).join('');
  } catch {}
}

async function loadViewersData() {
  const id = document.getElementById('viewers-ann-select').value;
  const container = document.getElementById('viewers-content');
  if (!id) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">👁️</span><h3>Select an Announcement</h3></div>`;
    return;
  }
  try {
    const data = await api.get(`/announcements/${id}/viewers`);
    if (!data.viewers.length) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">👁️</span><h3>No views yet</h3><p>No students have viewed this announcement</p></div>`;
      return;
    }
    container.innerHTML = `
      <div class="viewers-table-wrap">
        <table class="data-table">
          <thead><tr><th>Username</th><th>Roll Number</th><th>Class</th><th>Section</th><th>Viewed At</th></tr></thead>
          <tbody>
            ${data.viewers.map(v => `
              <tr>
                <td><strong>${escHtml(v.username.split('@')[0])}</strong></td>
                <td>${escHtml(v.roll_number || '—')}</td>
                <td>${escHtml(v.class || '—')}</td>
                <td>${escHtml(v.section || '—')}</td>
                <td class="text-sm">${formatDate(v.viewed_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}
