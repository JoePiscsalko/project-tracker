/* reLink Medical — Project Tracker
   Vanilla JS, no build step, no dependencies. */

(function () {
  'use strict';

  const KEY = 'relink_project_tracker_v1';       // localStorage cache key
  const AUTHOR_KEY = 'relink_tracker_author';     // this person's display name for comments
  const STATUSES = ['Not Started', 'In Progress', 'In Review', 'Blocked', 'On Hold', 'Complete', 'Cancelled'];
  const SCLASS = {
    'Not Started': 's-ns', 'In Progress': 's-ip', 'In Review': 's-rv',
    'Blocked': 's-bl', 'On Hold': 's-hd', 'Complete': 's-cp', 'Cancelled': 's-cx'
  };
  const SORDER = {
    'Not Started': 0, 'In Progress': 1, 'In Review': 2, 'Blocked': 3,
    'On Hold': 4, 'Complete': 5, 'Cancelled': 6
  };
  const PORDER = { High: 0, Medium: 1, Low: 2 };

  let tasks = [];
  let activeFilter = 'All';
  let searchQuery = '';
  let editingId = null;

  const $ = (id) => document.getElementById(id);

  /* ---------- helpers ---------- */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function today0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function parseDate(s) { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function daysLeft(t) { if (!t.deadline) return null; return Math.round((parseDate(t.deadline) - today0()) / 86400000); }
  function fmtDate(s) {
    if (!s) return '—';
    return parseDate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Ensure every task has the fields we rely on (id, numeric pct, comments array).
  function normalize(list) {
    return (Array.isArray(list) ? list : []).map((t) => ({
      ...t,
      id: t.id || uid(),
      pct: Number(t.pct) || 0,
      comments: Array.isArray(t.comments) ? t.comments : []
    }));
  }

  // The name shown on this person's comments. Asked once, then remembered per browser.
  function getAuthor() {
    let a = '';
    try { a = localStorage.getItem(AUTHOR_KEY) || ''; } catch (e) { /* ignore */ }
    if (!a) {
      a = (window.prompt('Your name (shown on your comments):') || '').trim();
      if (a) { try { localStorage.setItem(AUTHOR_KEY, a); } catch (e) { /* ignore */ } }
      else a = 'Anonymous';
    }
    return a;
  }

  /* ---------- persistence (shared via Netlify Blobs) ----------
     The board lives in one shared store on the server so everyone who opens
     the page sees the same tasks. localStorage is kept only as a fast cache
     and an offline fallback — it is no longer the source of truth. */
  const API = '/.netlify/functions/store';
  let saveTimer = null;
  let lastLocalWrite = 0;

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch (e) { /* private mode */ }
    lastLocalWrite = Date.now();
    const snapshot = JSON.stringify(tasks);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: snapshot
      }).catch(() => { /* offline: the local cache still holds this */ });
    }, 400);
  }

  function loadCache() {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
    return null;
  }

  async function fetchShared() {
    const res = await fetch(API, { cache: 'no-store' });
    if (!res.ok) throw new Error('load failed');
    return await res.json();
  }

  function seed() {
    const t = today0();
    const iso = (n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    return [
      { id: uid(), task: 'Draft project brief',        owner: 'Alex',   status: 'Complete',    priority: 'High',   start: iso(-14), deadline: iso(-7), pct: 100, notes: 'Signed off by leadership', comments: [] },
      { id: uid(), task: 'Stakeholder kickoff meeting', owner: 'Sam',    status: 'Complete',    priority: 'Medium', start: iso(-6),  deadline: iso(-5), pct: 100, notes: '', comments: [] },
      { id: uid(), task: 'Design mockups',             owner: 'Jordan', status: 'In Review',   priority: 'High',   start: iso(-4),  deadline: iso(5),  pct: 80,  notes: 'Second draft in review', comments: [] },
      { id: uid(), task: 'Build prototype',            owner: 'Alex',   status: 'In Progress', priority: 'High',   start: iso(-2),  deadline: iso(12), pct: 30,  notes: '', comments: [] },
      { id: uid(), task: 'User testing round 1',       owner: 'Priya',  status: 'Not Started', priority: 'Medium', start: iso(13),  deadline: iso(20), pct: 0,   notes: 'Recruit 6 participants', comments: [] },
      { id: uid(), task: 'Finalize documentation',     owner: 'Sam',    status: 'Blocked',     priority: 'Low',    start: iso(2),   deadline: iso(9),  pct: 0,   notes: 'Waiting on final specs', comments: [] }
    ];
  }

  /* ---------- render ---------- */
  function render() {
    renderBoard();
    renderFilters();

    const sort = $('sort').value;
    const rows = tasks
      .filter((t) => activeFilter === 'All' || t.status === activeFilter)
      .filter((t) => {
        if (!searchQuery) return true;
        const hay = [t.task, t.owner, t.notes, ...(t.comments || []).map((c) => c.text)]
          .join(' ').toLowerCase();
        return hay.includes(searchQuery);
      })
      .sort((a, b) => {
        if (sort === 'deadline') return (a.deadline || '9999-99-99') < (b.deadline || '9999-99-99') ? -1 : 1;
        if (sort === 'priority') return PORDER[a.priority] - PORDER[b.priority];
        if (sort === 'status')   return SORDER[a.status] - SORDER[b.status];
        if (sort === 'name')     return a.task.localeCompare(b.task);
        if (sort === 'pct')      return b.pct - a.pct;
        return 0;
      });

    const tb = $('tbody');

    if (!rows.length) {
      tb.innerHTML =
        '<tr><td colspan="10"><div class="empty"><b>No tasks here</b>' +
        (tasks.length ? 'Nothing matches your search or filter.' : 'Add your first task to get started.') +
        '</div></td></tr>';
      return;
    }

    tb.innerHTML = rows.map((t, i) => {
      const dl = daysLeft(t);
      let dCls = 'd-ok', dTxt = '—';
      if (t.status === 'Complete')      { dCls = 'd-done'; dTxt = 'Done'; }
      else if (t.status === 'Cancelled'){ dCls = 'd-ok';   dTxt = '—'; }
      else if (dl === null)             { dCls = 'd-ok';   dTxt = '—'; }
      else if (dl < 0)                  { dCls = 'd-over'; dTxt = Math.abs(dl) + 'd overdue'; }
      else if (dl <= 3)                 { dCls = 'd-soon'; dTxt = dl + 'd left'; }
      else                              { dCls = 'd-ok';   dTxt = dl + 'd left'; }

      const opts = STATUSES.map((s) => `<option ${s === t.status ? 'selected' : ''}>${s}</option>`).join('');

      const cs = t.comments || [];
      const last = cs.length ? cs[cs.length - 1] : null;
      const cmtCount = cs.length ? `<span class="cmt-count">${cs.length}</span>` : '';
      const cmtPreview = last
        ? `<span class="cmt-preview">${esc(last.text)}</span>`
        : `<span class="cmt-preview empty">Add comment</span>`;

      const nameCls = 'task-name' + (t.status === 'Cancelled' ? ' cx' : '');

      return `<tr>
        <td class="col-num mono">${i + 1}</td>
        <td>
          <div class="${nameCls}">${esc(t.task)}</div>
          ${t.notes ? `<div class="task-notes">${esc(t.notes)}</div>` : ''}
        </td>
        <td>${esc(t.owner) || '—'}</td>
        <td><select class="status-sel ${SCLASS[t.status]}" data-act="status" data-id="${t.id}" aria-label="Status for ${esc(t.task)}">${opts}</select></td>
        <td><span class="prio p-${t.priority}">${t.priority}</span></td>
        <td class="mono">${fmtDate(t.deadline)}</td>
        <td><span class="days ${dCls}">${dTxt}</span></td>
        <td class="pct-cell">
          <div class="pct-track"><div class="pct-bar" style="width:${t.pct}%"></div></div>
          <div class="pct-label">${t.pct}%</div>
        </td>
        <td class="comments-cell">
          <button class="cmt-open" data-act="comments" data-id="${t.id}" aria-label="Comments for ${esc(t.task)}">
            ${cmtCount}${cmtPreview}
          </button>
        </td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-act="edit" data-id="${t.id}">Edit</button>
            <button class="icon-btn del" data-act="del" data-id="${t.id}">Delete</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function renderBoard() {
    const count = (s) => tasks.filter((t) => t.status === s).length;
    const overdue = tasks.filter((t) => t.status !== 'Complete' && t.status !== 'Cancelled' && t.deadline && daysLeft(t) < 0).length;
    const counted = tasks.filter((t) => t.status !== 'Cancelled');
    const overall = counted.length
      ? Math.round(counted.reduce((a, t) => a + Number(t.pct || 0), 0) / counted.length)
      : 0;

    $('board').innerHTML = `
      <div class="stat"><div class="k">Total</div><div class="v">${tasks.length}</div></div>
      <div class="stat"><div class="k"><span class="dot" style="background:var(--ip)"></span>In progress</div><div class="v">${count('In Progress')}</div></div>
      <div class="stat"><div class="k"><span class="dot" style="background:var(--rv)"></span>In review</div><div class="v">${count('In Review')}</div></div>
      <div class="stat"><div class="k"><span class="dot" style="background:var(--bl)"></span>Blocked</div><div class="v">${count('Blocked')}</div></div>
      <div class="stat"><div class="k"><span class="dot" style="background:var(--cp)"></span>Complete</div><div class="v">${count('Complete')} ${overdue ? `<small>${overdue} overdue</small>` : ''}</div></div>
      <div class="stat accent">
        <div class="k">Overall</div>
        <div class="v">${overall}%</div>
        <div class="progress-track"><div class="progress-fill" style="width:${overall}%"></div></div>
      </div>`;
  }

  function renderFilters() {
    $('filters').innerHTML = ['All', ...STATUSES]
      .map((f) => `<button class="chip ${f === activeFilter ? 'on' : ''}" data-act="filter" data-val="${f}">${f}</button>`)
      .join('');
  }

  function renderThread(t) {
    const box = $('cmt-thread');
    if (!box) return;
    const cs = t.comments || [];
    if (!cs.length) {
      box.innerHTML = '<div class="cmt-empty">No comments yet. Start the conversation below.</div>';
      return;
    }
    box.innerHTML = cs.map((c) => `
      <div class="cmt">
        <div class="cmt-meta">
          <span class="cmt-author">${esc(c.author || 'Anonymous')}</span>
          <span class="cmt-time">${fmtTime(c.ts)}</span>
        </div>
        <div class="cmt-text">${esc(c.text)}</div>
      </div>`).join('');
    box.scrollTop = box.scrollHeight;
  }

  /* ---------- actions ---------- */
  function changeStatus(id, val) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    t.status = val;
    if (val === 'Complete') t.pct = 100;
    save(); render();
  }

  function delTask(id) {
    const t = tasks.find((x) => x.id === id);
    if (t && confirm(`Delete “${t.task}”? This can't be undone.`)) {
      tasks = tasks.filter((x) => x.id !== id);
      save(); render();
    }
  }

  function openModal(id) {
    editingId = id || null;
    $('modal-title').textContent = id ? 'Edit task' : 'Add task';
    $('form-error').hidden = true;

    const t = id
      ? tasks.find((x) => x.id === id)
      : { task: '', owner: '', status: 'Not Started', priority: 'Medium', start: '', deadline: '', pct: '', notes: '', comments: [] };

    $('f-task').value = t.task || '';
    $('f-owner').value = t.owner || '';
    $('f-status').value = t.status;
    $('f-priority').value = t.priority;
    $('f-pct').value = t.pct === '' ? '' : t.pct;
    $('f-start').value = t.start || '';
    $('f-deadline').value = t.deadline || '';
    $('f-notes').value = t.notes || '';

    // Comments only make sense on a task that already exists.
    const isEdit = !!id;
    $('cmt-section').hidden = !isEdit;
    if (isEdit) { renderThread(t); $('cmt-input').value = ''; }

    $('overlay').hidden = false;
    $('f-task').focus();
  }

  function closeModal() { $('overlay').hidden = true; editingId = null; }

  function saveTask() {
    const name = $('f-task').value.trim();
    if (!name) {
      const err = $('form-error');
      err.textContent = 'Enter a task name to save.';
      err.hidden = false;
      $('f-task').focus();
      return;
    }

    let pct = parseInt($('f-pct').value, 10);
    if (isNaN(pct)) pct = 0;
    pct = Math.max(0, Math.min(100, pct));

    const status = $('f-status').value;
    if (status === 'Complete' && pct === 0) pct = 100;

    const data = {
      task: name,
      owner: $('f-owner').value.trim(),
      status,
      priority: $('f-priority').value,
      start: $('f-start').value,
      deadline: $('f-deadline').value,
      pct,
      notes: $('f-notes').value.trim()
    };

    if (editingId) Object.assign(tasks.find((x) => x.id === editingId), data);
    else tasks.push({ id: uid(), ...data, comments: [] });

    save(); closeModal(); render();
  }

  function addComment() {
    if (!editingId) return;
    const t = tasks.find((x) => x.id === editingId);
    const input = $('cmt-input');
    const text = input.value.trim();
    if (!t || !text) return;
    if (!Array.isArray(t.comments)) t.comments = [];
    t.comments.push({ id: uid(), author: getAuthor(), text, ts: Date.now() });
    input.value = '';
    save();
    renderThread(t);
    render();       // refresh the table preview + count
    input.focus();
  }

  /* ---------- import / export ---------- */
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() { download('project-tracker.json', JSON.stringify(tasks, null, 2), 'application/json'); }

  function exportCSV() {
    const head = ['Task', 'Owner', 'Status', 'Priority', 'Start', 'Deadline', '% Complete', 'Notes', 'Comments'];
    const rows = tasks.map((t) => {
      const comments = (t.comments || [])
        .map((c) => `${c.author || 'Anonymous'} (${fmtTime(c.ts)}): ${c.text}`)
        .join('  |  ');
      return [t.task, t.owner, t.status, t.priority, t.start, t.deadline, t.pct, t.notes, comments]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
    });
    download('project-tracker.csv', [head.join(','), ...rows].join('\n'), 'text/csv');
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('bad shape');
        tasks = normalize(data);
        save(); render();
      } catch (err) {
        alert('That file isn’t a saved tracker. Pick a project-tracker.json file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  /* ---------- wiring ---------- */
  $('btn-add').addEventListener('click', () => openModal());
  $('btn-cancel').addEventListener('click', closeModal);
  $('btn-close').addEventListener('click', closeModal);
  $('btn-savetask').addEventListener('click', saveTask);
  $('btn-addcmt').addEventListener('click', addComment);
  $('btn-csv').addEventListener('click', exportCSV);
  $('btn-save').addEventListener('click', exportJSON);
  $('btn-load').addEventListener('click', () => $('importer').click());
  $('importer').addEventListener('change', importJSON);
  $('sort').addEventListener('change', render);
  $('search').addEventListener('input', (e) => { searchQuery = e.target.value.trim().toLowerCase(); render(); });

  // Ctrl/Cmd+Enter posts a comment
  $('cmt-input').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); addComment(); }
  });

  $('overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('overlay').hidden) closeModal(); });

  // Event delegation for dynamically rendered rows + filters
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'edit')     openModal(el.dataset.id);
    if (act === 'comments') openModal(el.dataset.id);
    if (act === 'del')      delTask(el.dataset.id);
    if (act === 'filter')   { activeFilter = el.dataset.val; render(); }
  });

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act="status"]');
    if (el) changeStatus(el.dataset.id, el.value);
  });

  /* ---------- background sync ----------
     Pull the shared board every 15s so other people's changes appear.
     Paused while a modal is open, and skipped right after a local save. */
  let pollTimer = null;
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!$('overlay').hidden) return;                  // don't refresh mid-edit
      if (Date.now() - lastLocalWrite < 3000) return;    // just wrote — let it settle
      try {
        const shared = await fetchShared();
        if (Array.isArray(shared) && JSON.stringify(shared) !== JSON.stringify(tasks)) {
          tasks = normalize(shared);
          try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch (e) { /* ignore */ }
          render();
        }
      } catch (e) { /* transient network issue — try again next tick */ }
    }, 15000);
  }

  /* ---------- init ---------- */
  async function init() {
    let shared;
    try {
      shared = await fetchShared();          // array | null
    } catch (e) {
      shared = undefined;                    // server unreachable
    }

    if (Array.isArray(shared)) {
      tasks = normalize(shared);
    } else if (shared === null) {
      const cache = loadCache();
      if (cache && cache.length) {
        tasks = normalize(cache);
        save();
      } else {
        tasks = normalize(seed());
        save();
      }
    } else {
      tasks = normalize(loadCache() || seed());
    }

    render();
    startPolling();
  }

  init();
})();
