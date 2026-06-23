/* ═══════════════════════════════════════════
   Minor Surgery Ward — Patient Management
   script.js
═══════════════════════════════════════════ */

'use strict';

// ─── Constants ────────────────────────────
const STORAGE_KEY   = 'msw_patients';
const SESSION_KEY   = 'msw_session';
const CREDENTIALS   = { username: 'admin', password: 'admin123' };

// ─── Helpers ──────────────────────────────
function getPatients() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function savePatients(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function todayStr() {
  return new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function nowTimeStr() {
  return new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function shortTimeStr() {
  return new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
}

function isoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getShift() {
  const h = new Date().getHours();
  return (h >= 7 && h < 19) ? 'Day' : 'Night';
}

function woundBadge(status) {
  const map = {
    'Fresh Wound':   'badge-fresh',
    'Healing Wound': 'badge-healing',
    'Infected Wound':'badge-infected',
    'Follow-up':     'badge-followup',
  };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

function shiftBadge(shift) {
  return `<span class="badge ${shift === 'Day' ? 'badge-day' : 'badge-night'}">${shift}</span>`;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ─── Clock / Date ─────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById('topbarClock').textContent = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  document.getElementById('topbarDate').textContent  = now.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
}

setInterval(updateClock, 1000);

// ─── Session ──────────────────────────────
function isLoggedIn() {
  return localStorage.getItem(SESSION_KEY) === 'true';
}

function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const err  = document.getElementById('loginError');

  if (user === CREDENTIALS.username && pass === CREDENTIALS.password) {
    localStorage.setItem(SESSION_KEY, 'true');
    err.classList.add('hidden');
    showApp();
  } else {
    err.classList.remove('hidden');
    document.getElementById('loginPass').value = '';
  }
}

function doLogout() {
  localStorage.removeItem(SESSION_KEY);
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  updateClock();
  showPage('dashboard');
}

// Allow Enter key on login
document.getElementById('loginPass')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('loginUser')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('loginPass').focus();
});

// ─── Navigation ───────────────────────────
const PAGE_TITLES = {
  dashboard:   'Dashboard',
  newPatient:  'New Patient',
  records:     'Patient Records',
  shiftReport: 'Shift Report',
};

function showPage(name) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  const nav = document.querySelector(`.nav-item[data-page="${name}"]`);
  if (nav) nav.classList.add('active');

  document.getElementById('pageTitle').textContent = PAGE_TITLES[name] || '';

  // Page-specific initialisation
  if (name === 'dashboard')    renderDashboard();
  if (name === 'newPatient')   initNewPatientForm();
  if (name === 'records')      renderRecords();
  if (name === 'shiftReport')  initShiftReport();

  // Close sidebar on mobile after nav
  if (window.innerWidth <= 700) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

// ─── Sidebar ──────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 700) {
    sb.classList.toggle('open');
  } else {
    sb.classList.toggle('collapsed');
    document.querySelector('.main-content').style.marginLeft =
      sb.classList.contains('collapsed') ? '0' : 'var(--sidebar-w)';
  }
}

// ─── Dashboard ────────────────────────────
function renderDashboard() {
  const patients = getPatients();
  const today    = isoDate();
  const todayPts = patients.filter(p => p.dateISO === today);

  document.getElementById('statToday').textContent  = todayPts.length;
  document.getElementById('statTotal').textContent  = patients.length;
  document.getElementById('statDay').textContent    = todayPts.filter(p => p.shift === 'Day').length;
  document.getElementById('statNight').textContent  = todayPts.filter(p => p.shift === 'Night').length;

  const tbody  = document.getElementById('recentBody');
  const recent = [...patients].reverse().slice(0, 10);

  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No patients recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(p => `
    <tr>
      <td><code>${escHtml(p.patientId)}</code></td>
      <td>${escHtml(p.fullName)}</td>
      <td>${escHtml(p.age)}</td>
      <td>${escHtml(p.sex)}</td>
      <td>${woundBadge(p.woundStatus)}</td>
      <td>${escHtml(p.timeSeen)}</td>
      <td>${shiftBadge(p.shift)}</td>
    </tr>
  `).join('');
}

// ─── New Patient Form ─────────────────────
function initNewPatientForm() {
  const editId = document.getElementById('editId').value;
  if (!editId) {
    // Fresh form: update auto fields in real-time
    refreshAutoFields();
  }
  document.getElementById('formSuccess').classList.add('hidden');
}

function refreshAutoFields() {
  document.getElementById('autoDate').value  = todayStr();
  document.getElementById('autoTime').value  = shortTimeStr();
  document.getElementById('autoShift').value = getShift();
}

// Keep time current while the form is open
let autoFieldTimer;
document.addEventListener('visibilitychange', () => {
  if (document.getElementById('page-newPatient')?.classList.contains('active')) {
    refreshAutoFields();
  }
});

function savePatient(event) {
  event.preventDefault();

  const editId = document.getElementById('editId').value;
  const patients = getPatients();

  const now = new Date();

  const record = {
    id:            editId || String(Date.now()),
    patientId:     document.getElementById('patientId').value.trim(),
    fullName:      document.getElementById('fullName').value.trim(),
    age:           document.getElementById('age').value.trim(),
    sex:           document.getElementById('sex').value,
    woundStatus:   document.getElementById('woundStatus').value,
    daysSinceInjury: document.getElementById('daysSinceInjury').value.trim(),
    gpConsultation:document.getElementById('gpConsultation').value,
    notes:         document.getElementById('notes').value.trim(),
    date:          editId ? document.getElementById('autoDate').value : todayStr(),
    dateISO:       editId ? (patients.find(p=>p.id===editId)?.dateISO || isoDate()) : isoDate(),
    timeSeen:      editId ? document.getElementById('autoTime').value : shortTimeStr(),
    shift:         editId ? document.getElementById('autoShift').value : getShift(),
  };

  if (editId) {
    const idx = patients.findIndex(p => p.id === editId);
    if (idx !== -1) patients[idx] = record;
  } else {
    patients.push(record);
  }

  savePatients(patients);

  document.getElementById('formSuccess').classList.remove('hidden');
  setTimeout(() => document.getElementById('formSuccess').classList.add('hidden'), 3000);

  if (!editId) {
    clearForm();
  } else {
    // After editing, go back to records
    document.getElementById('editId').value = '';
    document.getElementById('saveBtn').innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      Save Patient`;
    setTimeout(() => showPage('records'), 800);
  }
}

function clearForm() {
  document.getElementById('patientForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('formSuccess').classList.add('hidden');
  refreshAutoFields();
  document.getElementById('saveBtn').innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
    Save Patient`;
}

// ─── Patient Records ──────────────────────
function renderRecords() {
  const patients = getPatients();
  const query    = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const tbody    = document.getElementById('recordsBody');
  const countEl  = document.getElementById('recordCount');

  let filtered = patients;
  if (query) {
    filtered = patients.filter(p =>
      p.patientId?.toLowerCase().includes(query) ||
      p.fullName?.toLowerCase().includes(query)
    );
  }

  countEl.textContent = `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">${query ? 'No patients match your search.' : 'No records found.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = [...filtered].reverse().map(p => `
    <tr>
      <td><code>${escHtml(p.patientId)}</code></td>
      <td>${escHtml(p.fullName)}</td>
      <td>${escHtml(p.age)}</td>
      <td>${escHtml(p.sex)}</td>
      <td>${woundBadge(p.woundStatus)}</td>
      <td>${escHtml(p.daysSinceInjury)}</td>
      <td>${escHtml(p.gpConsultation)}</td>
      <td>${escHtml(p.timeSeen)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-icon btn-view" onclick="viewPatient('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View
          </button>
          <button class="btn-icon btn-edit" onclick="editPatient('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn-icon btn-del" onclick="deletePatient('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function viewPatient(id) {
  const p = getPatients().find(pt => pt.id === id);
  if (!p) return;

  document.getElementById('viewModalBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">Patient ID</span>
        <span class="detail-value"><code>${escHtml(p.patientId)}</code></span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Full Name</span>
        <span class="detail-value">${escHtml(p.fullName)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Age</span>
        <span class="detail-value">${escHtml(p.age)} years</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Sex</span>
        <span class="detail-value">${escHtml(p.sex)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Wound Status</span>
        <span class="detail-value">${woundBadge(p.woundStatus)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Days Since Injury</span>
        <span class="detail-value">${escHtml(p.daysSinceInjury)} day(s)</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">GP Consultation</span>
        <span class="detail-value">${escHtml(p.gpConsultation)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Shift</span>
        <span class="detail-value">${shiftBadge(p.shift)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Date Attended</span>
        <span class="detail-value">${escHtml(p.date)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Time Seen</span>
        <span class="detail-value">${escHtml(p.timeSeen)}</span>
      </div>
      ${p.notes ? `
      <div class="detail-item full">
        <span class="detail-label">Notes</span>
        <span class="detail-value">${escHtml(p.notes)}</span>
      </div>` : ''}
    </div>
  `;

  document.getElementById('viewModal').classList.remove('hidden');
}

function editPatient(id) {
  const p = getPatients().find(pt => pt.id === id);
  if (!p) return;

  showPage('newPatient');

  document.getElementById('editId').value            = p.id;
  document.getElementById('patientId').value         = p.patientId;
  document.getElementById('fullName').value          = p.fullName;
  document.getElementById('age').value               = p.age;
  document.getElementById('sex').value               = p.sex;
  document.getElementById('woundStatus').value       = p.woundStatus;
  document.getElementById('daysSinceInjury').value   = p.daysSinceInjury;
  document.getElementById('gpConsultation').value    = p.gpConsultation;
  document.getElementById('notes').value             = p.notes || '';
  document.getElementById('autoDate').value          = p.date;
  document.getElementById('autoTime').value          = p.timeSeen;
  document.getElementById('autoShift').value         = p.shift;

  document.getElementById('saveBtn').innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
    Update Patient`;
}

function deletePatient(id) {
  const p = getPatients().find(pt => pt.id === id);
  if (!p) return;

  if (!confirm(`Delete patient "${p.fullName}" (${p.patientId})?\n\nThis action cannot be undone.`)) return;

  const updated = getPatients().filter(pt => pt.id !== id);
  savePatients(updated);
  renderRecords();
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

// ─── Shift Report ─────────────────────────
function initShiftReport() {
  document.getElementById('reportDate').value = todayStr();
  renderReport();
}

function renderReport() {
  const nurseName = document.getElementById('nurseName')?.value.trim() || '—';
  const shiftType = document.getElementById('shiftType')?.value || 'Day';
  const today     = isoDate();

  document.getElementById('reportNurseName').textContent   = nurseName || '—';
  document.getElementById('reportShiftType').textContent   = `${shiftType} Shift`;
  document.getElementById('reportDateDisplay').textContent = todayStr();
  document.getElementById('reportPrintedAt').textContent   = shortTimeStr();

  const patients = getPatients().filter(p => p.dateISO === today);
  const tbody    = document.getElementById('reportBody');

  document.getElementById('reportSummary').textContent = `Total patients today: ${patients.length}`;

  if (!patients.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No patients recorded for today.</td></tr>';
    return;
  }

  tbody.innerHTML = patients.map(p => `
    <tr>
      <td>${escHtml(p.patientId)}</td>
      <td>${escHtml(p.fullName)}</td>
      <td>${escHtml(p.age)}</td>
      <td>${escHtml(p.sex)}</td>
      <td>${woundBadge(p.woundStatus)}</td>
      <td>${escHtml(p.daysSinceInjury)}</td>
      <td>${escHtml(p.gpConsultation)}</td>
      <td>${escHtml(p.timeSeen)}</td>
    </tr>
  `).join('');
}

// Live-update report as nurse types their name or changes shift
document.getElementById('nurseName')?.addEventListener('input', renderReport);
document.getElementById('shiftType')?.addEventListener('change', renderReport);

function printReport() {
  renderReport();
  window.print();
}

function exportPDF() {
  renderReport();
  // Inform the user: in a frontend-only build, Ctrl+P → Save as PDF is the standard approach
  alert('To export as PDF:\n\n1. Click "Print Report"\n2. In the print dialog, choose "Save as PDF" as the destination.\n\nThis produces a clean PDF of the shift report.');
}

// ─── Boot ─────────────────────────────────
(function init() {
  if (isLoggedIn()) {
    showApp();
  } else {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden');
  }
  updateClock();
})();
