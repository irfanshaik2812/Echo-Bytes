/**
 * ECHO BYTES – Auth Page Logic
 */

// ── Tab switching ─────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`tab-${tab}`).setAttribute('aria-selected', 'true');
  document.getElementById(`form-${tab}`).classList.add('active');
}

// ── Password toggle ───────────────────────────────────────
function togglePw(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

// ── Show role-specific registration fields ────────────────
document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('reg-username');
  if (!usernameInput) return;

  usernameInput.addEventListener('input', detectRegRole);
  usernameInput.addEventListener('blur',  detectRegRole);
});

function detectRegRole() {
  const val = document.getElementById('reg-username').value.trim();
  const adminFields   = document.getElementById('admin-fields');
  const studentFields = document.getElementById('student-fields');

  if (val.endsWith('@mngrhereavvn26')) {
    adminFields.classList.remove('hidden');
    studentFields.classList.add('hidden');
  } else if (val.endsWith('@studavvn26')) {
    studentFields.classList.remove('hidden');
    adminFields.classList.add('hidden');
  } else {
    adminFields.classList.add('hidden');
    studentFields.classList.add('hidden');
  }
}

// ── Handle Login ──────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  const spinner = document.getElementById('login-spinner');
  const btnText = document.getElementById('login-btn-text');
  const btn     = document.getElementById('login-btn');

  errorEl.classList.remove('show');
  spinner.classList.remove('hidden');
  btnText.textContent = 'Signing in…';
  btn.disabled = true;

  try {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    const result = await api.post('/auth/login', { username, password });
    showToast('Welcome back!', result.user.username, 'success');
    setTimeout(() => {
      window.location.href = result.user.role === 'admin' ? '/admin.html' : '/student.html';
    }, 600);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.add('show');
  } finally {
    spinner.classList.add('hidden');
    btnText.textContent = 'Sign In';
    btn.disabled = false;
  }
}

// ── Handle Register ───────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const errorEl = document.getElementById('reg-error');
  const spinner = document.getElementById('reg-spinner');
  const btnText = document.getElementById('reg-btn-text');
  const btn     = document.getElementById('reg-btn');

  errorEl.classList.remove('show');
  spinner.classList.remove('hidden');
  btnText.textContent = 'Creating account…';
  btn.disabled = true;

  try {
    const payload = {
      username:      document.getElementById('reg-username').value.trim(),
      password:      document.getElementById('reg-password').value,
      manager_id:    document.getElementById('reg-manager-id')?.value.trim()   || '',
      qualification: document.getElementById('reg-qualification')?.value.trim() || '',
      role_post:     document.getElementById('reg-role-post')?.value.trim()     || '',
      roll_number:   document.getElementById('reg-roll')?.value.trim()           || '',
      class:         document.getElementById('reg-class')?.value.trim()          || '',
      section:       document.getElementById('reg-section')?.value.trim()        || '',
    };

    await api.post('/auth/register', payload);
    showToast('Account created!', 'Please sign in to continue.', 'success');
    document.getElementById('register-form').reset();
    document.getElementById('admin-fields').classList.add('hidden');
    document.getElementById('student-fields').classList.add('hidden');
    setTimeout(() => switchTab('login'), 1500);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.add('show');
  } finally {
    spinner.classList.add('hidden');
    btnText.textContent = 'Create Account';
    btn.disabled = false;
  }
}

// ── Auto-redirect if already logged in ───────────────────
(async function checkSession() {
  try {
    const data = await api.get('/auth/me');
    if (data?.user) {
      window.location.href = data.user.role === 'admin' ? '/admin.html' : '/student.html';
    }
  } catch {
    // Not logged in – stay on this page
  }
})();
