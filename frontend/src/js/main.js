import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect, signInWithEmailAndPassword, createUserWithEmailAndPassword, EmailAuthProvider, linkWithCredential, getRedirectResult, signOut, onAuthStateChanged, updateProfile, updateEmail }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, query, where, arrayUnion, arrayRemove, addDoc, orderBy }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ══════════════════════════════════════════
//  Folders storage
// ══════════════════════════════════════════
const loadFolders  = () => { try { return JSON.parse(localStorage.getItem(lsFKey())) || []; } catch { return []; } };
let storeFolders = f  => localStorage.setItem(lsFKey(), JSON.stringify(f));

async function createFolder() {
  const name = await _showPrompt('اسم الملف الجديد');
  if (!name) return;
  const folders = loadFolders();
  folders.unshift({ id: uid(), name: name.trim(), open: true, lastModified: Date.now() });
  renderHome();
  await storeFolders(folders);
}

async function renameFolder(fid) {
  const folders = loadFolders();
  const f = folders.find(f => f.id === fid);
  if (!f) return;
  const name = await _showPrompt('اسم جديد', f.name);
  if (!name) return;
  f.name = name.trim();
  f.lastModified = Date.now();
  renderHome();
  await storeFolders(folders);
}

async function deleteFolder(fid) {
  if (!await _showConfirm('حذف الملف؟ ستبقى التصاوير داخله بدون ملف.', { destructive: true, confirmLabel: 'حذف' })) return;
  const all = loadLS();
  const affected = [];
  all.forEach(p => { if (p.folderId === fid) { p.folderId = null; p.lastModified = Date.now(); affected.push(p); } });
  storeLS(all);
  affected.forEach(p => saveProject(p).catch(()=>{}));
  renderHome();
  await storeFolders(loadFolders().filter(f => f.id !== fid));
}



function toggleFolderOpen(fid) {
  const folders = loadFolders();
  const f = folders.find(f => f.id === fid);
  if (f) f.open = !f.open;
  storeFolders(folders);
  const grid = document.getElementById('fg-' + fid);
  const btn  = document.getElementById('ft-' + fid);
  if (grid) grid.style.display = f.open ? '' : 'none';
  if (btn)  btn.classList.toggle('closed', !f.open);
}

// Move-to-folder modal
let mfPid = null, mfSelected = null;

function showMoveModal(pid) {
  mfPid = pid; mfSelected = getP(pid)?.folderId || null;
  const folders = loadFolders();
  const opts = [{ id: null, name: 'بدون ملف', icon: '—' }, ...folders.map(f => ({...f, icon: '📁'}))];
  document.getElementById('mfOptions').innerHTML = opts.map(f => `
    <div class="mf-option ${mfSelected===f.id?'selected':''}" onclick="selectMfOption(this,'${f.id||''}')">
      <span>${f.icon}</span>
      <span class="mf-option-name">${esc(f.name)}</span>
    </div>`).join('');
  document.getElementById('mfOverlay').style.display = 'flex';
}

function selectMfOption(el, fid) {
  mfSelected = fid || null;
  document.querySelectorAll('.mf-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function closeMoveModal() {
  document.getElementById('mfOverlay').style.display = 'none';
  mfPid = null; mfSelected = null;
}

function confirmMove() {
  if (!mfPid) return;
  const all = loadLS();
  const p = all.find(p => p.id === mfPid);
  if (p) {
    p.folderId = mfSelected || null;
    p.lastModified = Date.now();
    storeLS(all);
    saveProject(p).catch(()=>{});
  }
  closeMoveModal();
  renderHome();
}

// ══════════════════════════════════════════
//  Storage (localStorage)
// ══════════════════════════════════════════
const lsKey   = () => `sm_v3_${fbUser?.uid || 'guest'}`;
const lsFKey  = () => `sm_folders_${fbUser?.uid || 'guest'}`;
const lsTKey  = () => `sm_trash_${fbUser?.uid || 'guest'}`;
const loadLS  = () => { try { return JSON.parse(localStorage.getItem(lsKey())) || []; } catch { return []; } };
const storeLS = l => localStorage.setItem(lsKey(), JSON.stringify(l));
const getP    = id => loadLS().find(p => p.id === id) || null;
const upsertLS = p => { const l=loadLS(); const i=l.findIndex(x=>x.id===p.id); i>=0?l[i]=p:l.unshift(p); storeLS(l); };
const delLS   = id => storeLS(loadLS().filter(p => p.id !== id));
// Trash helpers
const loadTrash  = () => { try { return JSON.parse(localStorage.getItem(lsTKey())) || []; } catch { return []; } };
const storeTrash = l => localStorage.setItem(lsTKey(), JSON.stringify(l));
const moveToTrash = p => {
  delLS(p.id);
  const t = loadTrash().filter(x => x.id !== p.id);
  t.unshift({ ...p, _deletedAt: Date.now() });
  storeTrash(t);
};
const restoreFromTrash = id => {
  const t = loadTrash();
  const p = t.find(x => x.id === id);
  if (!p) return;
  storeTrash(t.filter(x => x.id !== id));
  const { _deletedAt, ...clean } = p;
  upsertLS(clean);
  saveProject(clean).catch(()=>{});
};
const permDeleteFromTrash = id => storeTrash(loadTrash().filter(x => x.id !== id));

// ══════════════════════════════════════════
//  Unified project ops (overridden by Firebase section below)
// ══════════════════════════════════════════
let saveProject    = async (p) => { upsertLS(p); };
let deleteProject  = async (p) => { delLS(p.id); };
export let getAllProjects  = async ()  => loadLS();


// ══════════════════════════════════════════
//  Utilities
// ══════════════════════════════════════════
export const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
// Cryptographically-random id for capability URLs (share links). Math.random()
// is predictable and must not gate access to shared data.
const secureId = () => (self.crypto && crypto.randomUUID)
  ? crypto.randomUUID().replace(/-/g,'')
  : (uid() + Math.random().toString(36).slice(2) + Date.now().toString(36));
const today = () => new Date().toISOString().split('T')[0];
const pad   = n  => String(n).padStart(2,'0');
// Escapes every character that can break out of HTML text or single/double
// quoted attribute contexts (including inline event handlers).
const esc   = s  => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') : '';
const xesc  = s  => esc(s);

// Allow-list sanitizer for stored rich-text (contentRich) before it is written
// to innerHTML. contentRich originates from contenteditable and, in shared
// projects, from other users — so it is untrusted. We keep only formatting
// tags, drop every event handler / script / dangerous element, and neutralise
// javascript: URLs. Anything not on the allow-list is unwrapped or removed.
const RICH_ALLOWED_TAGS = new Set(['P','BR','DIV','SPAN','B','STRONG','I','EM','U','S','STRIKE','SUB','SUP','FONT','BLOCKQUOTE','UL','OL','LI','H1','H2','H3','H4','H5','H6','A','MARK','SMALL']);
const RICH_ALLOWED_ATTRS = new Set(['style','color','align','dir']);
function sanitizeRichHTML(html) {
  if (!html) return '';
  const docp = new DOMParser().parseFromString(String(html), 'text/html');
  const walk = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === 1) { // element
        // Uppercase-normalise: SVG/MathML foreign content reports a lowercase
        // tagName, which must not slip past the allow-list.
        const tag = String(child.tagName).toUpperCase();
        if (!RICH_ALLOWED_TAGS.has(tag)) {
          // Drop dangerous containers entirely; unwrap benign unknowns.
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' ||
              tag === 'OBJECT' || tag === 'EMBED' || tag === 'LINK' ||
              tag === 'META' || tag === 'SVG' || tag === 'MATH') {
            child.remove();
          } else {
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            child.remove();
          }
          continue;
        }
        // Strip disallowed attributes and neutralise dangerous values.
        for (const attr of Array.from(child.attributes)) {
          const name = attr.name.toLowerCase();
          const val = attr.value;
          if (!RICH_ALLOWED_ATTRS.has(name)) { child.removeAttribute(attr.name); continue; }
          if (name === 'style' && /url\s*\(|expression|javascript:|@import|behavior:/i.test(val)) {
            child.removeAttribute(attr.name);
          }
        }
        if (tag === 'A') {
          const href = (child.getAttribute('href') || '').trim();
          if (/^\s*javascript:/i.test(href) || /^\s*data:/i.test(href)) child.removeAttribute('href');
          child.setAttribute('rel', 'noopener noreferrer nofollow');
        }
        walk(child);
      } else if (child.nodeType === 8) { // comment
        child.remove();
      }
    }
  };
  walk(docp.body);
  return docp.body.innerHTML;
}
const fmtDate = d => { try { return new Date(d).toLocaleDateString('ar',{year:'numeric',month:'short',day:'numeric'}); } catch { return d||''; }};
const ago = ts => { if(!ts) return ''; const m=Math.floor((Date.now()-ts)/60000); if(m<1) return 'الآن'; if(m<60) return `${m}د`; const h=Math.floor(m/60); if(h<24) return `${h}س`; return `${Math.floor(h/24)}ي`; };

function formatTC(ms, fps) {
  fps=fps||(cur?cur.fps:25)||25;
  const tf=Math.floor(ms/1000*fps),f=tf%fps,ts=Math.floor(tf/fps);
  return pad(Math.floor(ts/3600))+':'+pad(Math.floor(ts/60)%60)+':'+pad(ts%60)+':'+pad(f);
}
function tcFrames(tc,fps){ const p=tc.split(':').map(Number); return p[0]*3600*fps+p[1]*60*fps+p[2]*fps+(p[3]||0); }

// ══════════════════════════════════════════
//  State
// ══════════════════════════════════════════
let cur    = null;
let timers = {};

// ── Save indicator (dot-only; hover/click reveals last save time) ──
let lastSaveAt    = null;
let lastSaveState = '';

function _saveStatusMsg() {
  const t = lastSaveAt ? lastSaveAt.toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}) : '';
  if (lastSaveState === 'saving') return 'جارٍ الحفظ...';
  if (lastSaveState === 'failed') return t ? 'لم يُحفظ — آخر حفظ ناجح: ' + t : 'لم يُحفظ — تحقق من الاتصال';
  if (t) return 'آخر حفظ: ' + t;
  return 'لم يتم الحفظ بعد';
}

function showSave(state) {
  const el=document.getElementById('savePill'); if(!el) return;
  const sf=document.getElementById('sfSyncPill');
  if (state === 'saved') lastSaveAt = new Date();
  // 'failed' persists until the next successful save — clearing it silently
  // would make a failed network write look identical to "nothing changed".
  lastSaveState = (state==='saving' || state==='failed') ? state : (lastSaveAt ? 'saved' : '');
  const msg = _saveStatusMsg();
  el.className = 'save-pill' + (lastSaveState ? ' ' + lastSaveState : '');
  el.title = msg;
  if (sf) {
    sf.className = 'sf-sync-pill' + (lastSaveState ? ' ' + lastSaveState : '');
    sf.title = msg;
  }
}

function _onSavePillClick() {
  _showToast(_saveStatusMsg(), lastSaveState === 'failed' ? 'error' : 'info', 3000);
}

// ══════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════
async function showHome() {
  stopAllTimers(); cur=null; timers={}; _editShareId=null;
  _openFolder = null;
  Object.keys(_segChatUnsubs).forEach(k => { _segChatUnsubs[k](); delete _segChatUnsubs[k]; });
  document.getElementById('homePage').classList.add('active');
  document.getElementById('projectPage').classList.remove('active');
  document.getElementById('topLeft').innerHTML=`<div class="brand"><div class="brand-icon">🎬</div>مِرصاد</div>`;
  _cleanupTopbarMenus();
  document.getElementById('topRight').innerHTML=``;
  await renderHome();
}

let _homeViewMode = localStorage.getItem('homeViewMode') || 'kanban';
if (_homeViewMode === 'grid') _homeViewMode = 'files';

// Currently opened file (folder) in the "files" browse view.
// null = showing the folder list (root). Otherwise { id, shared }.
let _openFolder = null;
// View mode for the projects shown inside an opened file: 'list' | 'kanban'
let _folderViewMode = localStorage.getItem('folderViewMode') || 'kanban';

function setFolderViewMode(mode) {
  _folderViewMode = mode;
  localStorage.setItem('folderViewMode', mode);
  renderHome();
}

function setHomeViewMode(mode) {
  _homeViewMode = mode;
  localStorage.setItem('homeViewMode', mode);
  _openFolder = null;
  const content = document.getElementById('homeContent');
  if (content) content.classList.toggle('list-view', mode === 'list');
  const fBtn = document.getElementById('homeViewFiles');
  const lBtn = document.getElementById('homeViewList');
  const kBtn = document.getElementById('homeViewKanban');
  if (fBtn) fBtn.classList.toggle('active', mode === 'files');
  if (lBtn) lBtn.classList.toggle('active', mode === 'list');
  if (kBtn) kBtn.classList.toggle('active', mode === 'kanban');
  renderHome();
}

function openFolderView(fid, shared=false) {
  _openFolder = { id: fid, shared: !!shared };
  renderHome();
}

function closeFolderView() {
  _openFolder = null;
  renderHome();
}

const KANBAN_COLS = [
  { key: 'writing', label: 'كتابة' },
  { key: 'ready',   label: 'جاهز للتصوير' },
  { key: 'editing', label: 'في التحرير' },
  { key: 'done',    label: 'تم' },
];

function kanbanStatusLabel(status) {
  const c = KANBAN_COLS.find(c => c.key === status);
  return c ? c.label : '';
}

async function setKanbanStatus(projId, status) {
  document.body.classList.remove('kanban-dragging');
  const p = getP(projId);
  if (!p) return;
  p.kanbanStatus = status;
  p.lastModified = Date.now();
  upsertLS(p);
  try { await saveProject(p); } catch(e) { console.error('kanban save:', e); }
  await renderHome();
}

async function shiftKanbanCard(projId, direction) {
  const all = await getAllProjects();
  const p = all.find(x => x.id === projId);
  if (!p) return;
  const col = p.kanbanStatus || 'writing';
  const colCards = all
    .filter(x => (x.kanbanStatus || 'writing') === col)
    .sort((a, b) => (a.kanbanOrder ?? 0) - (b.kanbanOrder ?? 0));
  const idx = colCards.findIndex(x => x.id === projId);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= colCards.length) return;
  colCards.splice(idx, 1);
  colCards.splice(newIdx, 0, p);
  const saves = colCards.map((x, i) => {
    x.kanbanOrder = i;
    upsertLS(x);
    return saveProject(x).catch(e => console.error('kanban order save:', e));
  });
  await Promise.all(saves);
  await renderHome();
}

async function reorderKanbanCard(dragProjId, targetProjId, insertBefore) {
  const all = await getAllProjects();
  const dragged = all.find(p => p.id === dragProjId);
  if (!dragged) return;
  const col = dragged.kanbanStatus || 'writing';
  const colCards = all
    .filter(p => (p.kanbanStatus || 'writing') === col)
    .sort((a, b) => (a.kanbanOrder ?? 0) - (b.kanbanOrder ?? 0));
  const fromIdx = colCards.findIndex(p => p.id === dragProjId);
  if (fromIdx !== -1) colCards.splice(fromIdx, 1);
  const toIdx = colCards.findIndex(p => p.id === targetProjId);
  if (toIdx === -1) return;
  colCards.splice(insertBefore ? toIdx : toIdx + 1, 0, dragged);
  const saves = colCards.map((p, i) => {
    p.kanbanOrder = i;
    upsertLS(p);
    return saveProject(p).catch(e => console.error('kanban order save:', e));
  });
  await Promise.all(saves);
  await renderHome();
}



function kanbanBoardHTML(projects, isShared, folderId) {
  return KANBAN_COLS.map(col => {
    const cards = projects
      .filter(p => (p.kanbanStatus||'writing') === col.key)
      .sort((a, b) => (a.kanbanOrder ?? 0) - (b.kanbanOrder ?? 0));
    const prefix = folderId ? folderId : 'ungrouped';
    const dk = col.key;
    const cardEls = cards.map(p => {
      const allSh = (p.segments||[]).flatMap(s=>s.shots||[]).concat(p.shots||[]);
      const total = allSh.length, done2 = allSh.filter(s=>s.done).length;
      const pct = total ? Math.round(done2/total*100) : 0;
      const statusOpts = KANBAN_COLS.map(c =>
        `<option value="${c.key}" ${p.kanbanStatus===c.key?'selected':''}>${c.label}</option>`
      ).join('');
      return `<div class="kanban-card" data-proj-id="${p.id}" data-shared="${isShared}">
        <div class="kanban-card-title">${esc(p.name||'بدون عنوان')}</div>
        <div class="kanban-card-meta">
          ${p.date ? `<span>${fmtDate(p.date)}</span>` : ''}
          <div class="kanban-card-progress">
            <div class="kanban-card-track"><div class="kanban-card-fill" style="width:${pct}%"></div></div>
            <span style="color:var(--green);font-size:10px;font-weight:600">${done2}/${total}</span>
          </div>
        </div>
        ${!isShared ? `<div class="kanban-card-actions">
          <button class="kanban-menu-btn" data-proj-id="${p.id}">⋯</button>
          <div class="kanban-dropdown" data-proj-id="${p.id}">
            <div class="kanban-dropdown-item danger" role="button" tabindex="0" data-action="delete" data-proj-id="${p.id}">🗑 حذف التصوير</div>
            <div class="kanban-dropdown-item" role="button" tabindex="0" data-action="move" data-proj-id="${p.id}">📁 نقل إلى ملف</div>
            <div class="kanban-dropdown-sep"></div>
            <div class="kanban-dropdown-item" role="button" tabindex="0" data-action="move-up" data-proj-id="${p.id}">↑ نقل لأعلى</div>
            <div class="kanban-dropdown-item" role="button" tabindex="0" data-action="move-down" data-proj-id="${p.id}">↓ نقل لأسفل</div>
            <div class="kanban-dropdown-sep"></div>
            <div class="kanban-dropdown-label">تغيير الحالة</div>
            ${KANBAN_COLS.map(c => `<div class="kanban-dropdown-item status-item${(p.kanbanStatus||'writing')===c.key?' active':''}" role="button" tabindex="0" data-action="status" data-proj-id="${p.id}" data-status="${c.key}">${(p.kanbanStatus||'writing')===c.key?'✓ ':''}${c.label}</div>`).join('')}
          </div>
        </div>` : ''}
      </div>`;
    }).join('');
    return `<div class="kanban-col" data-col="${dk}" data-folder="${prefix}">
      <div class="kanban-col-header">
        <span class="col-dot"></span>
        ${col.label}
        <span class="col-count">${cards.length}</span>
      </div>
      <div class="kanban-cards">${cardEls}</div>
      ${!isShared && col.key==='writing' ? `<button class="kanban-add-col" onclick="createProject(${folderId ? `'${folderId}'` : 'null'})">+ تصوير جديد</button>` : ''}
    </div>`;
  }).join('');
}

function initKanbanDrag() {
  // Remove old document handlers if re-initializing
  if (window._kanbanMouseMove) document.removeEventListener('mousemove',   window._kanbanMouseMove);
  if (window._kanbanMouseUp)   document.removeEventListener('mouseup',     window._kanbanMouseUp);
  if (window._kanbanTouchEnd)  document.removeEventListener('touchend',    window._kanbanTouchEnd);
  if (window._kanbanTouchEnd)  document.removeEventListener('touchcancel', window._kanbanTouchEnd);

  let dragCard = null, dragProjId = null, ghost = null;
  let startX = 0, startY = 0, isDragging = false;
  let touchTimer = null;

  function getColUnder(x, y) {
    for (const col of document.querySelectorAll('.kanban-col')) {
      const r = col.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return col;
    }
    return null;
  }

  function getCardDropTarget(x, y) {
    for (const card of document.querySelectorAll('.kanban-card')) {
      if (card === dragCard) continue;
      const r = card.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const insertBefore = y < r.top + r.height / 2;
        return { card, insertBefore };
      }
    }
    return null;
  }

  function clearDropIndicators() {
    document.querySelectorAll('.kanban-card.drag-above, .kanban-card.drag-below')
      .forEach(c => { c.classList.remove('drag-above'); c.classList.remove('drag-below'); });
  }

  function startGhost(cx, cy) {
    isDragging = true;
    dragCard.classList.add('dragging');
    document.body.classList.add('kanban-dragging');
    ghost = dragCard.cloneNode(true);
    Object.assign(ghost.style, {
      position:'fixed', pointerEvents:'none', zIndex:'9999', opacity:'0.88',
      width: dragCard.offsetWidth + 'px', margin:'0',
      transform:'rotate(2deg) scale(1.03)',
      boxShadow:'0 16px 40px rgba(0,0,0,0.5)', transition:'none',
      left: (cx - dragCard.offsetWidth/2) + 'px',
      top:  (cy - 30) + 'px',
    });
    document.body.appendChild(ghost);
  }

  function moveGhost(cx, cy) {
    ghost.style.left = (cx - dragCard.offsetWidth/2) + 'px';
    ghost.style.top  = (cy - 30) + 'px';
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
    clearDropIndicators();
    const col = getColUnder(cx, cy);
    if (col) {
      const target = getCardDropTarget(cx, cy);
      if (target) {
        target.card.classList.add(target.insertBefore ? 'drag-above' : 'drag-below');
      } else {
        col.classList.add('drag-over');
      }
    }
  }

  function finishDrag(cx, cy) {
    const wasDragging = isDragging;
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over'));
    clearDropIndicators();
    if (dragCard) dragCard.classList.remove('dragging');
    document.body.classList.remove('kanban-dragging');
    if (ghost) { ghost.remove(); ghost = null; }
    if (wasDragging && dragProjId) {
      const col = getColUnder(cx, cy);
      if (col) {
        const target = getCardDropTarget(cx, cy);
        if (target && target.card.dataset.projId !== dragProjId) {
          const draggedCol = dragCard.closest('.kanban-col');
          if (draggedCol === col) {
            reorderKanbanCard(dragProjId, target.card.dataset.projId, target.insertBefore);
          } else {
            setKanbanStatus(dragProjId, col.dataset.col);
          }
        } else if (!target) {
          setKanbanStatus(dragProjId, col.dataset.col);
        }
      }
    }
    dragCard = null; dragProjId = null; isDragging = false;
  }

  document.querySelectorAll('.kanban-card').forEach(card => {
    const id = card.dataset.projId;
    const shared = card.dataset.shared === 'true';

    card.addEventListener('mousedown', e => {
      if (e.target.closest('.kanban-card-actions')) return;
      e.preventDefault();
      dragCard = card; dragProjId = id; startX = e.clientX; startY = e.clientY; isDragging = false;
    });

    card.addEventListener('click', e => {
      if (isDragging) return;
      if (e.target.closest('.kanban-card-actions')) return;
      openSharedOrLocal(id, shared);
    });

    // Touch: long-press (400ms) initiates drag; early movement cancels to allow scroll
    card.addEventListener('touchstart', e => {
      if (e.target.closest('.kanban-card-actions')) return;
      const touch = e.touches[0];
      dragCard = card; dragProjId = id;
      startX = touch.clientX; startY = touch.clientY;
      isDragging = false;
      touchTimer = setTimeout(() => {
        touchTimer = null;
        if (navigator.vibrate) navigator.vibrate(30);
        startGhost(startX, startY);
        document.addEventListener('touchmove', window._kanbanTouchMove, { passive: false });
      }, 400);
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      if (!touchTimer) return;
      const touch = e.touches[0];
      if (Math.abs(touch.clientX - startX) > 8 || Math.abs(touch.clientY - startY) > 8) {
        clearTimeout(touchTimer); touchTimer = null;
        dragCard = null; dragProjId = null;
      }
    }, { passive: true });
  });

  window._kanbanMouseMove = e => {
    if (!dragCard) return;
    if (!isDragging && (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6)) {
      startGhost(e.clientX, e.clientY);
    }
    if (!isDragging) return;
    moveGhost(e.clientX, e.clientY);
  };

  window._kanbanMouseUp = e => {
    if (!dragCard) return;
    finishDrag(e.clientX, e.clientY);
  };

  window._kanbanTouchMove = e => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    moveGhost(touch.clientX, touch.clientY);
  };

  window._kanbanTouchEnd = e => {
    if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
    document.removeEventListener('touchmove', window._kanbanTouchMove);
    if (!dragCard) return;
    const touch = e.changedTouches[0];
    finishDrag(touch.clientX, touch.clientY);
  };

  document.addEventListener('mousemove',   window._kanbanMouseMove);
  document.addEventListener('mouseup',     window._kanbanMouseUp);
  document.addEventListener('touchend',    window._kanbanTouchEnd);
  document.addEventListener('touchcancel', window._kanbanTouchEnd);

  // Kanban card menu delegation
  const homeContent = document.getElementById('homeContent');
  if (homeContent) {
    if (homeContent._kanbanClickHandler) homeContent.removeEventListener('click', homeContent._kanbanClickHandler);
    homeContent._kanbanClickHandler = e => {
      const menuBtn = e.target.closest('.kanban-menu-btn');
      if (menuBtn) {
        e.stopPropagation();
        const pid = menuBtn.dataset.projId;
        const drop = homeContent.querySelector(`.kanban-dropdown[data-proj-id="${pid}"]`);
        const wasOpen = drop?.classList.contains('open');
        homeContent.querySelectorAll('.kanban-dropdown.open').forEach(d => d.classList.remove('open'));
        if (drop && !wasOpen) drop.classList.add('open');
        return;
      }
      const item = e.target.closest('.kanban-dropdown-item');
      if (item) {
        e.stopPropagation();
        homeContent.querySelectorAll('.kanban-dropdown.open').forEach(d => d.classList.remove('open'));
        const action = item.dataset.action, pid = item.dataset.projId;
        if (action === 'delete') confirmDel(pid);
        else if (action === 'move') showMoveModal(pid);
        else if (action === 'status') setKanbanStatus(pid, item.dataset.status);
        else if (action === 'move-up') shiftKanbanCard(pid, -1);
        else if (action === 'move-down') shiftKanbanCard(pid, 1);
        return;
      }
      homeContent.querySelectorAll('.kanban-dropdown.open').forEach(d => d.classList.remove('open'));
    };
    homeContent.addEventListener('click', homeContent._kanbanClickHandler);
    if (homeContent._kanbanKeyHandler) homeContent.removeEventListener('keydown', homeContent._kanbanKeyHandler);
    homeContent._kanbanKeyHandler = e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const item = e.target.closest('.kanban-dropdown-item');
      if (item) { e.preventDefault(); item.click(); }
    };
    homeContent.addEventListener('keydown', homeContent._kanbanKeyHandler);
  }
}

function projCardHTML(p, isShared=false) {
  const allSh=(p.segments||[]).flatMap(s=>s.shots||[]).concat(p.shots||[]);
  const total=allSh.length, done=allSh.filter(s=>s.done).length;
  const pct=total?Math.round(done/total*100):0;
  return `
    <div class="proj-card" onclick="openSharedOrLocal('${p.id}',${isShared})">
      ${!isShared ? `<button class="pc-del" onclick="event.stopPropagation();confirmDel('${p.id}')" title="حذف">✕</button>` : ''}
      ${!isShared ? `<button class="pc-dup" onclick="event.stopPropagation();duplicateProject('${p.id}')" title="نسخ التصوير">⧉</button>` : ''}
      ${p.kanbanStatus ? `<div class="pc-status ${p.kanbanStatus}">${kanbanStatusLabel(p.kanbanStatus)}</div>` : ''}
      <div class="pc-title">${esc(p.name||'بدون عنوان')}</div>
      <div class="pc-meta">
        ${p.date?'<span>'+fmtDate(p.date)+'</span>':''}
        ${p.location?'<span>'+esc(p.location)+'</span>':''}
      </div>
      <div class="pc-bar-row">
        <div class="pc-track"><div class="pc-fill" style="width:${pct}%"></div></div>
        <span class="pc-count">${done}/${total}</span>
      </div>
      <div class="pc-footer">
        ${!isShared ? `<span class="pc-open" onclick="event.stopPropagation();showMoveModal('${p.id}')" title="نقل إلى ملف" style="color:var(--subtext);font-size:11px">📁</span>` : ''}
        <span class="pc-open">فتح ←</span>
        <span class="pc-time">${ago(p.lastModified)}</span>
      </div>
    </div>`;
}

function openSharedOrLocal(id, isShared) {
  if (isShared) {
    // Find project in shared folders
    for (const sf of _sharedFolders) {
      const p = sf.projects.find(p => p.id === id);
      if (p) { openSharedProject(p, sf); return; }
    }
  }
  openProject(id);
}

async function renderHome() {
  const all     = await getAllProjects();
  const folders = loadFolders();
  const content = document.getElementById('homeContent');
  const actionsEl = document.getElementById('homeActions');
  const folderActionsEl = document.getElementById('folderActions');
  const homeHeroEl = document.querySelector('.home-hero');
  if (_openFolder) {
    if (homeHeroEl) homeHeroEl.classList.add('folder-open');
    if (actionsEl) actionsEl.style.display = 'none';
    if (folderActionsEl) {
      const fvm = _folderViewMode;
      folderActionsEl.innerHTML = `
        <button class="files-back" style="margin-bottom:0" onclick="closeFolderView()">‹ الملفات</button>
        <div class="home-view-toggle">
          <button class="home-view-btn ${fvm==='list'?'active':''}"   onclick="setFolderViewMode('list')"   title="قائمة">☰</button>
          <button class="home-view-btn ${fvm==='kanban'?'active':''}" onclick="setFolderViewMode('kanban')" title="كان بان">⊟</button>
        </div>`;
      folderActionsEl.style.display = 'flex';
    }
  } else {
    if (homeHeroEl) homeHeroEl.classList.remove('folder-open');
    if (actionsEl) actionsEl.style.display = '';
    if (folderActionsEl) folderActionsEl.style.display = 'none';
  }
  const sharedCount = _sharedFolders.reduce((n,sf) => n + sf.projects.length, 0);
  document.getElementById('homeSubtitle').textContent = (all.length + sharedCount) > 0 ? `${all.length + sharedCount} تصوير` : '';

  let html = '';

  // Guest banner (not logged in)
  if (!fbUser) {
    html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:16px">
      <div>
        <div style="font-weight:700;margin-bottom:4px">🔒 غير مسجّل الدخول</div>
        <div style="font-size:13px;color:var(--subtext)">سجّل دخولك لحفظ بياناتك ومزامنتها على جميع أجهزتك</div>
      </div>
      <button class="btn btn-filled" onclick="signInLocal()" style="white-space:nowrap;flex-shrink:0">تسجيل الدخول</button>
    </div>`;
  }

  const knownFolderIds0 = new Set(folders.map(f => f.id));
  const ungroupedAll = all.filter(p => !p.folderId || !knownFolderIds0.has(p.folderId));
  const titleEl = document.getElementById('homeTitle');

  if (_homeViewMode === 'files') {
    // ── Files (folder browser) view ──
    if (!_openFolder) {
      // Root: show folders as icons
      if (titleEl) titleEl.textContent = 'الملفات';
      html += '<div class="folder-grid files-grid">';
      folders.forEach(f => {
        const cnt = all.filter(p => p.folderId === f.id).length;
        html += `
          <div class="file-card" role="button" tabindex="0" aria-label="فتح ملف ${esc(f.name)}" onclick="openFolderView('${f.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openFolderView('${f.id}')}">
            <button class="file-del" onclick="event.stopPropagation();deleteFolder('${f.id}')" title="حذف" aria-label="حذف ملف ${esc(f.name)}">✕</button>
            <button class="file-edit" onclick="event.stopPropagation();renameFolder('${f.id}')" title="تعديل" aria-label="تعديل اسم ملف ${esc(f.name)}">✎</button>
            ${fbUser ? `<div class="file-badge" onclick="event.stopPropagation();openFolderShare('${f.id}')" style="cursor:pointer">👥 مشاركة</div>` : '<div class="file-badge">&nbsp;</div>'}
            <div class="file-icon">📁</div>
            <div class="file-name">${esc(f.name)}</div>
            <div class="file-count">${cnt} تصوير</div>
          </div>`;
      });
      if (ungroupedAll.length) {
        html += `
          <div class="file-card" role="button" tabindex="0" aria-label="فتح تصويرات بدون ملف" onclick="openFolderView('__ungrouped__')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openFolderView('__ungrouped__')}">
            <div class="file-badge">&nbsp;</div>
            <div class="file-icon">🗂</div>
            <div class="file-name">بدون ملف</div>
            <div class="file-count">${ungroupedAll.length} تصوير</div>
          </div>`;
      }
      _sharedFolders.forEach(sf => {
        html += `
          <div class="file-card" role="button" tabindex="0" aria-label="فتح ملف ${esc(sf.folderName)} المشارَك" onclick="openFolderView('${sf.folderId}',true)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openFolderView('${sf.folderId}',true)}">
            <div class="file-badge">مشارَكة معي</div>
            <div class="file-icon">📁</div>
            <div class="file-name">${esc(sf.folderName)}</div>
            <div class="file-count">${sf.projects.length} تصوير</div>
          </div>`;
      });
      html += `
        <div class="new-card file-new" onclick="createFolder()">
          <div class="new-icon">📁</div><div class="new-label">ملف جديد</div>
        </div>`;
      html += '</div>';
    } else {
      // Inside a file: show the shots (projects) within it, in list or kanban
      const fvm = _folderViewMode;
      const renderBody = (projs, isShared, fid, newCards) => {
        if (fvm === 'kanban') {
          return `<div class="kanban-board">${kanbanBoardHTML(projs, isShared, fid)}</div>${newCards||''}`;
        }
        return `<div class="folder-grid">
          ${projs.map(p => projCardHTML(p, isShared)).join('')}
          ${newCards||''}
        </div>`;
      };
      // "تصوير جديد" card shown only in list view (kanban has its own add button)
      const newCardHTML = (onclick) => fvm === 'kanban' ? '' :
        `<div class="new-card" onclick="${onclick}"><div class="new-icon">+</div><div class="new-label">تصوير جديد</div></div>`;
      if (_openFolder.shared) {
        const sf = _sharedFolders.find(s => s.folderId === _openFolder.id);
        if (!sf) { _openFolder = null; return renderHome(); }
        if (titleEl) titleEl.textContent = sf.folderName;
        const sfNew = sf.role === 'editor' ? newCardHTML(`createSharedProject('${sf.folderId}','${sf.ownerUid}')`) : '';
        html += renderBody(sf.projects, true, sf.folderId, sfNew);
      } else if (_openFolder.id === '__ungrouped__') {
        if (titleEl) titleEl.textContent = 'بدون ملف';
        html += renderBody(ungroupedAll, false, null, newCardHTML('createProject()'));
      } else {
        const f = folders.find(f => f.id === _openFolder.id);
        if (!f) { _openFolder = null; return renderHome(); }
        if (titleEl) titleEl.textContent = f.name;
        const fps = all.filter(p => p.folderId === f.id);
        html += renderBody(fps, false, f.id, newCardHTML(`createProjectInFolder('${f.id}')`));
      }
    }
  } else if (_homeViewMode === 'kanban') {
    if (titleEl) titleEl.textContent = 'التصاوير';
    // ── Kanban view ──
    const knownFolderIds = new Set(folders.map(f => f.id));
    const ungrouped = all.filter(p => !p.folderId || !knownFolderIds.has(p.folderId));
    const isKanbanEmpty = ungrouped.length === 0 && folders.length === 0 && _sharedFolders.length === 0;

    if (isKanbanEmpty) {
      html += `<div class="home-empty">
        <div class="home-empty-icon">🎬</div>
        <h2>ابدأ أول تصوير</h2>
        <p>نظّم مشاهدك، وتابع التقدم، وتحكم في كل تصويرك من مكان واحد</p>
        <div class="home-empty-actions">
          <button class="btn btn-filled" onclick="createProject()">+ تصوير جديد</button>
          <button class="btn btn-glass" onclick="importExcel()">📊 استيراد Excel</button>
        </div>
      </div>`;
    } else {
      folders.forEach(f => {
        const fps = all.filter(p => p.folderId === f.id);
        html += `
          <div class="kanban-section">
            <div class="kanban-section-title">
              <span>📁</span> ${esc(f.name)}
              <span style="font-size:11px;color:var(--text-3);font-weight:400">${fps.length} تصوير</span>
            </div>
            <div class="kanban-board">${kanbanBoardHTML(fps, false, f.id)}</div>
          </div>`;
      });

      if (ungrouped.length || folders.length === 0) {
        const label = folders.length > 0 ? 'بدون ملف' : 'التصاوير';
        html += `
          <div class="kanban-section">
            ${folders.length > 0 ? `<div class="kanban-section-title">${label}</div>` : ''}
            <div class="kanban-board">${kanbanBoardHTML(ungrouped, false, null)}</div>
          </div>`;
      }
    }

    if (_sharedFolders.length > 0) {
      _sharedFolders.forEach(sf => {
        html += `
          <div class="kanban-section">
            <div class="kanban-section-title">
              <span>📁</span> ${esc(sf.folderName)}
              <span style="font-size:11px;color:var(--accent);font-weight:400">مشارَكة معي</span>
            </div>
            <div class="kanban-board">${kanbanBoardHTML(sf.projects, true, sf.folderId)}</div>
          </div>`;
      });
    }

  } else {
    // ── Grid / List view ──
    if (titleEl) titleEl.textContent = 'التصاوير';

    folders.forEach(f => {
      const fps = all.filter(p => p.folderId === f.id);
      const isOpen = f.open !== false;
      html += `
        <div class="folder-section">
          <div class="folder-header">
            <button class="folder-toggle ${isOpen?'':'closed'}" id="ft-${f.id}" onclick="toggleFolderOpen('${f.id}')">▼</button>
            <span class="folder-icon">📁</span>
            <span class="folder-name-text" ondblclick="renameFolder('${f.id}')">${esc(f.name)}</span>
            <span class="folder-count">${fps.length} تصوير</span>
            <div class="folder-btns">
              ${fbUser ? `<button class="folder-btn share" onclick="openFolderShare('${f.id}')">👥 مشاركة</button>` : ''}
              <button class="folder-btn" onclick="renameFolder('${f.id}')">تعديل</button>
              <button class="folder-btn del" onclick="deleteFolder('${f.id}')">حذف</button>
            </div>
          </div>
          <div class="folder-grid" id="fg-${f.id}" style="${isOpen?'':'display:none'}">
            ${fps.map(p => projCardHTML(p)).join('')}
            <div class="new-cards-row">
              <div class="new-card" onclick="createProjectInFolder('${f.id}')"><div class="new-icon">+</div><div class="new-label">تصوير جديد</div></div>
              <div class="new-card" onclick="openTextImport(true,'${f.id}')"><div class="new-icon">📝</div><div class="new-label">من نص</div></div>
            </div>
          </div>
        </div>`;
    });

    const knownFolderIds = new Set(folders.map(f => f.id));
    const ungrouped = all.filter(p => !p.folderId || !knownFolderIds.has(p.folderId));
    const isCompletelyEmpty = ungrouped.length === 0 && folders.length === 0 && _sharedFolders.length === 0;
    if (isCompletelyEmpty) {
      html += `<div class="home-empty">
        <div class="home-empty-icon">🎬</div>
        <h2>ابدأ أول تصوير</h2>
        <p>نظّم مشاهدك، وتابع التقدم، وتحكم في كل تصويرك من مكان واحد</p>
        <div class="home-empty-actions">
          <button class="btn btn-filled" onclick="createProject()">+ تصوير جديد</button>
          <button class="btn btn-glass" onclick="createFolder()">📁 ملف جديد</button>
          <button class="btn btn-glass" onclick="importExcel()">📊 استيراد Excel</button>
        </div>
      </div>`;
    } else if (ungrouped.length || folders.length === 0) {
      if (folders.length > 0) html += `<div class="ungrouped-label">بدون ملف</div>`;
      html += `<div class="folder-grid">
        ${ungrouped.map(p => projCardHTML(p)).join('')}
        <div class="new-cards-row">
          <div class="new-card" onclick="createProject()"><div class="new-icon">+</div><div class="new-label">تصوير جديد</div></div>
          <div class="new-card" onclick="openTextImport(true)"><div class="new-icon">📝</div><div class="new-label">من نص</div></div>
        </div>
      </div>`;
    }

    if (_sharedFolders.length > 0) {
      html += `<div class="ungrouped-label" style="margin-top:8px">مشارَكة معي</div>`;
      _sharedFolders.forEach(sf => {
        const isOpen = sf.open !== false;
        const roleLabel = sf.role === 'editor' ? 'محرر' : 'مشاهد';
        html += `
          <div class="folder-section shared-section">
            <div class="folder-header">
              <button class="folder-toggle ${isOpen?'':'closed'}" id="ft-sf-${sf.folderId}" onclick="toggleSharedFolderOpen('${sf.folderId}')">▼</button>
              <span class="folder-icon">📁</span>
              <span class="folder-name-text">${esc(sf.folderName)}</span>
              <span class="folder-shared-badge">${roleLabel}</span>
              <span class="folder-count" style="margin-right:4px">${sf.projects.length} تصوير · ${esc(sf.ownerName||sf.ownerEmail)}</span>
            </div>
            <div class="folder-grid" id="fg-sf-${sf.folderId}" style="${isOpen?'':'display:none'}">
              ${sf.projects.map(p => projCardHTML(p, true)).join('')}
              ${sf.role === 'editor' ? `<div class="new-card" onclick="createSharedProject('${sf.folderId}','${sf.ownerUid}')"><div class="new-icon">+</div><div class="new-label">تصوير جديد</div></div>` : ''}
            </div>
          </div>`;
      });
    }
  }

  // Trash section (shown in all view modes)
  const trash = loadTrash();
  if (trash.length > 0) {
    html += `
    <div class="trash-section" id="trashSection">
      <div class="trash-header" role="button" tabindex="0" aria-expanded="false" aria-controls="trashBody" onclick="this.setAttribute('aria-expanded',document.getElementById('trashBody').classList.toggle('open').toString())" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
        <span>🗑 المحذوفات (${trash.length})</span>
        <span class="trash-chevron">▾</span>
        <button class="btn btn-glass btn-sm" style="margin-right:auto;font-size:11px" onclick="event.stopPropagation();trashEmptyAll()">حذف الكل نهائياً</button>
      </div>
      <div class="trash-body" id="trashBody">
        ${trash.map(p => {
          const daysAgo = Math.floor((Date.now() - (p._deletedAt||0)) / 86400000);
          const dateStr = daysAgo === 0 ? 'اليوم' : `منذ ${daysAgo} يوم`;
          const shots = (p.segments||[]).reduce((n,s)=>n+(s.shots?.length||0),0);
          return `<div class="trash-item">
            <div class="trash-item-info">
              <div class="trash-item-name">${esc(p.name||'بدون عنوان')}</div>
              <div class="trash-item-meta">${dateStr} · ${(p.segments||[]).length} مقطع · ${shots} مشهد</div>
            </div>
            <div class="trash-item-btns">
              <button class="btn btn-glass btn-sm" onclick="trashRestoreProject('${p.id}')">↩ استعادة</button>
              <button class="btn btn-sm" style="background:rgba(255,59,48,0.12);color:#ff3b30;border:none" onclick="trashPermDelete('${p.id}')">✕</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  content.innerHTML = html;
  const inFolderList = _homeViewMode === 'files' && _openFolder && _folderViewMode === 'list';
  content.classList.toggle('list-view', _homeViewMode === 'list' || inFolderList);
  const fBtn = document.getElementById('homeViewFiles');
  const lBtn = document.getElementById('homeViewList');
  const kBtn = document.getElementById('homeViewKanban');
  if (fBtn) fBtn.classList.toggle('active', _homeViewMode === 'files');
  if (lBtn) lBtn.classList.toggle('active', _homeViewMode === 'list');
  if (kBtn) kBtn.classList.toggle('active', _homeViewMode === 'kanban');
  const inFolderKanban = _homeViewMode === 'files' && _openFolder && _folderViewMode === 'kanban';
  if (_homeViewMode === 'kanban' || inFolderKanban) initKanbanDrag();
}

async function confirmDel(id) {
  const p = getP(id); if (!p) return;
  moveToTrash(p);
  if (fbUser) {
    try { await deleteDoc(doc(projsCol(), p.id)); }
    catch(e) { console.error('confirmDel: Firestore delete failed', e); }
  }
  renderHome();
  showSave('saved');
}
function trashRestoreProject(id) {
  restoreFromTrash(id);
  renderHome();
  showSave('saved');
  _showToast('تم استعادة التصوير', 'success', 2500);
}
async function trashPermDelete(id) {
  if (!await _showConfirm('حذف نهائياً؟ لا يمكن التراجع.', { destructive: true, confirmLabel: 'حذف نهائياً' })) return;
  permDeleteFromTrash(id);
  renderHome();
}
async function trashEmptyAll() {
  if (!await _showConfirm('حذف جميع المحذوفات نهائياً؟', { destructive: true, confirmLabel: 'حذف الكل' })) return;
  storeTrash([]);
  renderHome();
}

async function createProject(folderId=null) {
  const p={id:uid(),name:'',date:today(),location:'',notes:'',fps:25,segments:[],folderId:folderId||null,lastModified:Date.now()};
  // saveProject already wrote it to localStorage before it can throw, so the
  // project is safe to open locally even if the cloud write failed — only
  // warn, don't block navigation on a network error.
  try { await saveProject(p); } catch(e) { _showToast('تعذّر رفع التصوير للسحابة — تحقق من الاتصال', 'error', 4000); }
  openProject(p.id);
}

async function createProjectInFolder(fid) {
  createProject(fid);
}

async function duplicateProject(id) {
  const p = getP(id);
  if (!p) return;
  const clone = JSON.parse(JSON.stringify(p));
  clone.id = uid();
  clone.name = (clone.name || 'بدون عنوان') + ' — نسخة';
  clone.lastModified = Date.now();
  delete clone.shareId; delete clone.shareMode;
  try {
    await saveProject(clone);
    _showToast('تم نسخ التصوير', 'success', 2500);
  } catch(e) {
    _showToast('نُسخ محلياً لكن تعذّر رفعه للسحابة — تحقق من الاتصال', 'error', 4000);
  }
  renderHome();
}

async function openProject(id) {
  const p = getP(id);
  if (!p) return;
  cur=JSON.parse(JSON.stringify(p)); timers={};
  _shotFilter = { done: 'all', face: '', rukn: '', chrono: false };
  // ── Migrate old flat shots → one segment ──
  if(!cur.segments && cur.shots) {
    cur.segments=[{id:uid(),title:'المشاهد',collapsed:false,shots:cur.shots}];
    delete cur.shots;
  } else if(!cur.segments) {
    cur.segments=[];
  }
  document.getElementById('homePage').classList.remove('active');
  document.getElementById('projectPage').classList.add('active');
  fillForm(); renderShots(); updateProgress(); renderTopProject();
  _syncViewToggle();
  if ((cur.kanbanStatus || 'writing') === 'writing') openContentEditor();
}

function onTopTitleInput() {
  if(!cur) return;
  const el = document.getElementById('topbarTitle');
  if(!el) return;
  cur.name = el.textContent.trim();
  const pn = document.getElementById('pName'); if(pn) pn.value = cur.name;
  const headName = document.getElementById('infoHeadName');
  if(headName) headName.textContent = cur.name || 'بدون اسم';
}
function onTopTitleBlur() {
  if(!cur) return;
  const el = document.getElementById('topbarTitle');
  if(el && !el.textContent.trim()) el.textContent = cur.name || 'بدون عنوان';
  autoSave();
}
function onTopTitlePaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
}

function renderTopProject() {
  _cleanupTopbarMenus();
  const name=cur.name||'بدون عنوان';
  const localFolder = cur.folderId ? loadFolders().find(f => f.id === cur.folderId) : null;
  const sharedFolder = cur.folderId && !localFolder ? _sharedFolders.find(s => s.folderId === cur.folderId) : null;
  const folderName = localFolder?.name?.trim() || sharedFolder?.folderName?.trim() || '';
  const backLabel = folderName || 'التصاوير';
  document.getElementById('topLeft').innerHTML=`
    <button class="back-btn" onclick="goToFolder()">‹ ${esc(backLabel)}</button>
    <div class="tb-divider"></div>
    <span class="topbar-title" id="topbarTitle" contenteditable="true" spellcheck="false" role="textbox" aria-label="اسم التصوير" title="اضغط للتعديل"
      oninput="onTopTitleInput()"
      onpaste="onTopTitlePaste(event)"
      onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
      onblur="onTopTitleBlur()">${esc(name)}</span>`;
  document.getElementById('topRight').innerHTML=`
    <span class="save-pill" id="savePill" title="حالة الحفظ" role="status" aria-label="حالة الحفظ" onclick="_onSavePillClick()"></span>
    <div class="publish-dd" id="viewDd" style="position:relative">
      <button class="btn btn-glass btn-sm" onclick="toggleViewMenu(event)" aria-haspopup="true" aria-expanded="false">👁 ▾</button>
      <div class="kanban-dropdown" id="viewMenu" style="position:fixed">
        <div class="kanban-dropdown-item" onclick="closeViewMenu();openContentEditor()">📄 محرر النص</div>
        <div class="kanban-dropdown-sep"></div>
        <div class="kanban-dropdown-item" onclick="closeViewMenu();toggleTableView(true)">▦ العرض كجدول</div>
        <div class="kanban-dropdown-item" onclick="closeViewMenu();toggleTableView(false)">🪟 العرض كنوافذ</div>
        <div class="kanban-dropdown-sep"></div>
        <div class="kanban-dropdown-item" onclick="closeViewMenu();openFirstShotFull()">⛶ العرض الكامل للمشهد</div>
      </div>
    </div>
    <div class="publish-dd" id="publishDd" style="position:relative">
      <button class="btn btn-glass btn-sm" onclick="togglePublishMenu(event)" aria-haspopup="true" aria-expanded="false">📤 ▾</button>
      <div class="kanban-dropdown" id="publishMenu" style="position:fixed">
        <div class="kanban-dropdown-item" onclick="closePublishMenu();openShareModal()">🔗 مشاركة</div>
        <div class="kanban-dropdown-item" onclick="closePublishMenu();exportJSON()">⬇ تصدير JSON</div>
        <div class="kanban-dropdown-sep"></div>
        <div class="kanban-dropdown-item" onclick="closePublishMenu();exportFCP()" style="color:var(--green,#2d8a50);font-weight:600">🪄 Final Cut Pro ⬆</div>
      </div>
    </div>`;
}

// The topbar dropdowns get moved to <body> while open (to escape the topbar's
// overflow/backdrop-filter clipping). Any topbar re-render then creates a fresh
// copy inside #topRight, leaving the old one orphaned in <body> with the same id
// — getElementById would hit the wrong node and the visible menu could never be
// closed. Call this before every #topRight rewrite to drop the orphans.
function _cleanupTopbarMenus() {
  document.removeEventListener('click', _closePublishOnOutside);
  document.removeEventListener('click', _closeViewOnOutside);
  document.querySelectorAll('body > #viewMenu, body > #publishMenu').forEach(m => m.remove());
}

function togglePublishMenu(event) {
  event.stopPropagation();
  const menu = document.getElementById('publishMenu');
  if (!menu) return;
  const btn = event.currentTarget;
  if (menu.classList.contains('open')) { closePublishMenu(); return; }
  closeViewMenu();
  menu.classList.add('open');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  // Move to body so it isn't clipped by the topbar's overflow/backdrop-filter
  if (menu.parentElement !== document.body) document.body.appendChild(menu);
  menu.style.zIndex = '1000';
  const r = btn.getBoundingClientRect();
  menu.style.top = (r.bottom + 4) + 'px';
  menu.style.right = (window.innerWidth - r.right) + 'px';
  menu.style.left = 'auto';
  document.addEventListener('click', _closePublishOnOutside);
}
function _closePublishOnOutside(e) {
  const dd = document.getElementById('publishDd');
  const menu = document.getElementById('publishMenu');
  if ((dd && dd.contains(e.target)) || (menu && menu.contains(e.target))) return;
  closePublishMenu();
}
function closePublishMenu() {
  // querySelectorAll so a stray duplicate can never keep a menu stuck open
  document.querySelectorAll('#publishMenu').forEach(m => m.classList.remove('open'));
  const btn = document.querySelector('#publishDd button[aria-haspopup]');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', _closePublishOnOutside);
}

function toggleViewMenu(event) {
  event.stopPropagation();
  const menu = document.getElementById('viewMenu');
  if (!menu) return;
  const btn = event.currentTarget;
  if (menu.classList.contains('open')) { closeViewMenu(); return; }
  closePublishMenu();
  menu.classList.add('open');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  if (menu.parentElement !== document.body) document.body.appendChild(menu);
  menu.style.zIndex = '1000';
  const r = btn.getBoundingClientRect();
  menu.style.top = (r.bottom + 4) + 'px';
  menu.style.right = (window.innerWidth - r.right) + 'px';
  menu.style.left = 'auto';
  document.addEventListener('click', _closeViewOnOutside);
}
function _closeViewOnOutside(e) {
  const dd = document.getElementById('viewDd');
  const menu = document.getElementById('viewMenu');
  if ((dd && dd.contains(e.target)) || (menu && menu.contains(e.target))) return;
  closeViewMenu();
}
function closeViewMenu() {
  document.querySelectorAll('#viewMenu').forEach(m => m.classList.remove('open'));
  const btn = document.querySelector('#viewDd button[aria-haspopup]');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', _closeViewOnOutside);
}

async function goHome() { await autoSave(); showHome(); }

async function goToFolder() {
  await autoSave();
  const folderId = cur?.folderId;
  const isLocal = folderId ? !!loadFolders().find(f => f.id === folderId) : false;
  await showHome();
  if (folderId) {
    _homeViewMode = 'files';
    localStorage.setItem('homeViewMode', 'files');
    openFolderView(folderId, !isLocal);
  }
}

// ══════════════════════════════════════════
//  PROJECT
// ══════════════════════════════════════════
const _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function _fmtDate(iso) {
  if (!iso) return '—';
  const [,, d, m] = [...iso.matchAll(/(\d+)/g)].map(x=>+x[0]);
  const parts = iso.split('-');
  const day = parseInt(parts[2]||0);
  const mon = parseInt(parts[1]||0);
  return day + (_months[mon-1]||'');
}
function updateDateDisplay() {
  const val = document.getElementById('pDate').value;
  const el  = document.getElementById('pDateDisplay');
  if (el) el.textContent = val ? _fmtDate(val) : '—';
  if (cur) { cur.date = val; autoSave(); }
  const dInput = document.getElementById('pDate');
  if (dInput) dInput.blur();
}
function fillForm() {
  document.getElementById('pName').value=cur.name||'';
  const d = cur.date||today();
  document.getElementById('pDate').value=d;
  const el = document.getElementById('pDateDisplay');
  if (el) el.textContent = _fmtDate(d);
  document.getElementById('pLocation').value=cur.location||'';
  document.getElementById('pNotes').value=cur.notes||'';
  document.getElementById('gFPS').value=cur.fps||25;
  renderPrepTasks();
}

function collectForm() {
  if(!cur) return;
  // Guard each field: these inputs aren't present in every layout (shared /
  // view-only / edit-share). A missing element must never throw here, otherwise
  // autoSave() would abort before persisting and edits (e.g. the done toggle)
  // would silently fail to save.
  const pName=document.getElementById('pName');         if(pName)     cur.name=pName.value;
  const pDate=document.getElementById('pDate');         if(pDate)     cur.date=pDate.value;
  const pLocation=document.getElementById('pLocation'); if(pLocation) cur.location=pLocation.value;
  const pNotes=document.getElementById('pNotes');       if(pNotes)    cur.notes=pNotes.value;
  const gFPS=document.getElementById('gFPS');           if(gFPS)      cur.fps=parseInt(gFPS.value)||25;
}

function onNameChange() {
  if(!cur) return;
  cur.name=document.getElementById('pName').value;
  const headName = document.getElementById('infoHeadName');
  if(headName) headName.textContent = (cur.name||'').trim() || 'بدون اسم';
  renderTopProject(); autoSave();
}

// ── Project-level trash (segments & shots) ──
function _updateProjTrashBtn() {
  // Trash button removed from the toolbar; the panel at the bottom is always shown instead.
  _renderProjTrash();
}

function toggleProjTrash() {
  _renderProjTrash();
}

function _renderProjTrash() {
  const panel = document.getElementById('projTrashPanel');
  if (!panel || !cur) return;
  panel.style.display = '';
  const segs  = cur._trash?.segments || [];
  const shots = cur._trash?.shots    || [];
  if (!segs.length && !shots.length) {
    panel.innerHTML = `<div class="proj-trash-wrap">
      <div class="proj-trash-hd">🗑 المحذوفات من هذا التصوير</div>
      <div class="proj-trash-empty">لا يوجد عناصر محذوفة</div>
    </div>`;
    return;
  }

  const dayAgo = x => { const d = Math.floor((Date.now()-(x._deletedAt||0))/86400000); return d===0?'اليوم':`منذ ${d} يوم`; };

  let html = `<div class="proj-trash-wrap">
    <div class="proj-trash-hd">🗑 المحذوفات من هذا التصوير</div>`;

  if (segs.length) {
    html += `<div class="proj-trash-section-label">المقاطع</div>`;
    html += segs.map(seg => `
      <div class="proj-trash-item">
        <div class="proj-trash-info">
          <div class="proj-trash-name">${esc(seg.title||'مقطع بدون عنوان')}</div>
          <div class="proj-trash-meta">${dayAgo(seg)} · ${(seg.shots||[]).length} مشهد</div>
        </div>
        <div class="trash-item-btns">
          <button class="btn btn-glass btn-sm" onclick="restoreSegFromTrash('${seg.id}')">↩ استعادة</button>
          <button class="btn btn-sm" style="background:rgba(255,59,48,0.12);color:#ff3b30;border:none" onclick="permDeleteSegFromTrash('${seg.id}')">✕</button>
        </div>
      </div>`).join('');
  }

  if (shots.length) {
    html += `<div class="proj-trash-section-label">المشاهد</div>`;
    html += shots.map(sh => `
      <div class="proj-trash-item">
        <div class="proj-trash-info">
          <div class="proj-trash-name">${esc(sh.title||'مشهد بدون عنوان')}</div>
          <div class="proj-trash-meta">${dayAgo(sh)}${sh._parentSeg?' · من: '+esc(sh._parentSeg):''}</div>
        </div>
        <div class="trash-item-btns">
          <button class="btn btn-glass btn-sm" onclick="restoreShotFromTrash('${sh.id}')">↩ استعادة</button>
          <button class="btn btn-sm" style="background:rgba(255,59,48,0.12);color:#ff3b30;border:none" onclick="permDeleteShotFromTrash('${sh.id}')">✕</button>
        </div>
      </div>`).join('');
  }

  html += `</div>`;
  panel.innerHTML = html;
}

function restoreSegFromTrash(segId) {
  if (!cur) return;
  const seg = (cur._trash?.segments||[]).find(s=>s.id===segId);
  if (!seg) return;
  cur._trash.segments = cur._trash.segments.filter(s=>s.id!==segId);
  const { _deletedAt, _fromProject, ...clean } = seg;
  if (!cur.segments) cur.segments = [];
  cur.segments.push(clean);
  renderShots(); updateProgress(); autoSave();
  _renderProjTrash(); _updateProjTrashBtn();
}

function permDeleteSegFromTrash(segId) {
  if (!cur) return;
  cur._trash.segments = (cur._trash.segments||[]).filter(s=>s.id!==segId);
  autoSave(); _renderProjTrash(); _updateProjTrashBtn();
}

function restoreShotFromTrash(shotId) {
  if (!cur) return;
  const sh = (cur._trash?.shots||[]).find(s=>s.id===shotId);
  if (!sh) return;
  cur._trash.shots = cur._trash.shots.filter(s=>s.id!==shotId);
  const { _deletedAt, _parentSeg, ...clean } = sh;
  // Add to last segment or create one
  if (!cur.segments || !cur.segments.length) addSegment();
  cur.segments[cur.segments.length-1].shots.push(clean);
  renderShots(); updateProgress(); autoSave();
  _renderProjTrash(); _updateProjTrashBtn();
}

function permDeleteShotFromTrash(shotId) {
  if (!cur) return;
  cur._trash.shots = (cur._trash.shots||[]).filter(s=>s.id!==shotId);
  autoSave(); _renderProjTrash(); _updateProjTrashBtn();
}

let _autoSaveErrorShown = false;
let _saveInFlight = false;
let _saveQueuedFor = null;
// autoSave fires on every keystroke (see the document-level 'input'/'change'
// listeners below). Without this mutex, two overlapping saves could reach
// Firestore out of order — a slower request for an *older* snapshot of `cur`
// completing after a faster request for a *newer* one, silently regressing
// the cloud copy back to stale data (done state / file numbers included)
// even though nothing was lost locally. Only one write is ever in flight;
// anything that comes in meanwhile is coalesced into a single trailing save
// of whatever project it was called for, run right after.
async function autoSave() {
  if(!cur) return;
  if(cur._viewOnly) return;
  collectForm();
  cur.lastModified=Date.now();
  // Captured now, not read again inside _runSave later: if this save ends up
  // queued behind an in-flight one, _editShareId could be cleared (e.g. the
  // user navigates away) before the trailing save actually runs.
  const target = cur;
  const shareId = _editShareId;
  if (_saveInFlight) { _saveQueuedFor = { target, shareId }; return; }
  await _runSave(target, shareId);
}

let _lastSaveFailed = false;

async function _runSave(target, shareId) {
  _saveInFlight = true;
  showSave('saving');
  try {
    if (shareId) {
      await updateDoc(doc(db, 'sharedProjects', shareId), { data: JSON.parse(JSON.stringify(target)) });
    } else {
      await saveProject(target);
    }
    _autoSaveErrorShown = false;
    _lastSaveFailed = false;
    showSave('saved');
  } catch (e) {
    showSave('failed');
    _lastSaveFailed = true;
    if (!_autoSaveErrorShown) {
      _autoSaveErrorShown = true;
      _showToast('تعذّر الحفظ — تحقق من الاتصال بالإنترنت', 'error', 5000);
    }
    console.error('autoSave failed:', e);
  } finally {
    _saveInFlight = false;
  }
  if (_saveQueuedFor) {
    const next = _saveQueuedFor;
    _saveQueuedFor = null;
    await _runSave(next.target, next.shareId);
  }
}

// Warn before the tab closes with an edit that never made it to the cloud —
// otherwise the data only exists in this device's localStorage and is gone
// the moment that's cleared (or the project is opened fresh elsewhere).
window.addEventListener('beforeunload', (e) => {
  if (cur && (_saveInFlight || _saveQueuedFor || _lastSaveFailed)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

function saveFPS() { if(cur){ cur.fps=parseInt(document.getElementById('gFPS').value)||25; autoSave(); } }
function toggleInfo() { document.getElementById('infoCard').classList.toggle('collapsed'); }

function togglePrepCard() { const el=document.getElementById('prepCard'); if(el) el.classList.toggle('collapsed'); }

function renderPrepTasks() {
  if (!cur) return;
  const tasks = cur.prepTasks || [];
  const list  = document.getElementById('prepTasksList');
  const prog  = document.getElementById('prepProgress');
  const fill  = document.getElementById('prepProgressFill');
  const lbl   = document.getElementById('prepProgressLabel');
  if (!list) return;
  const done  = tasks.filter(t => t.done).length;
  const total = tasks.length;
  if (total > 0) {
    prog.style.display = 'flex';
    fill.style.transform = 'scaleX(' + (done / total) + ')';
    lbl.textContent    = done + ' / ' + total;
  } else {
    prog.style.display = 'none';
  }
  list.innerHTML = tasks.map(t => `
    <div class="prep-task-item${t.done?' done':''}" id="pti-${t.id}">
      <input type="checkbox" ${t.done?'checked':''} onchange="togglePrepTask('${t.id}')">
      <span class="prep-task-text" onclick="togglePrepTask('${t.id}')">${esc(t.text)}</span>
      <button class="prep-task-del" onclick="deletePrepTask('${t.id}')" aria-label="حذف المهمة">✕</button>
    </div>`).join('');
}

function addPrepTask() {
  if (!cur) return;
  const inp   = document.getElementById('prepTaskInput');
  const lines = inp.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (!lines.length) return;
  if (!cur.prepTasks) cur.prepTasks = [];
  lines.forEach(text => cur.prepTasks.push({ id: uid(), text, done: false }));
  inp.value = '';
  inp.style.height = 'auto';
  renderPrepTasks();
  autoSave();
}

function addPrepTaskPreset(text) {
  if (!cur) return;
  if (!cur.prepTasks) cur.prepTasks = [];
  if (cur.prepTasks.some(t => t.text === text)) return;
  cur.prepTasks.push({ id: uid(), text, done: false });
  renderPrepTasks();
  autoSave();
}

function togglePrepTask(id) {
  if (!cur?.prepTasks) return;
  const t = cur.prepTasks.find(t => t.id === id);
  if (t) { t.done = !t.done; renderPrepTasks(); autoSave(); }
}

function deletePrepTask(id) {
  if (!cur?.prepTasks) return;
  cur.prepTasks = cur.prepTasks.filter(t => t.id !== id);
  renderPrepTasks();
  autoSave();
}

// ── Segment / Shot helpers ──
export function _allShots() { return (cur.segments||[]).flatMap(s=>s.shots||[]); }
export function _findShot(id) { for(const seg of (cur.segments||[])){ const s=seg.shots?.find(s=>s.id===id); if(s) return s; } return null; }
export function _findSegForShot(id) { return (cur.segments||[]).find(seg=>seg.shots?.some(s=>s.id===id))||null; }
export function _globalShotCount() { return _allShots().length; }
export function _globalShotIndex(shotId) { let i=1; for(const seg of (cur.segments||[])){ for(const s of (seg.shots||[])){ if(s.id===shotId) return i; i++; } } return i; }

// ── Segments ──
function addSegment() {
  if(!cur) return;
  if(!cur.segments) cur.segments=[];
  const seg={id:uid(),title:'مقطع '+(cur.segments.length+1),collapsed:false,shots:[]};
  const shot={id:uid(),title:'مشهد '+(_globalShotCount()+1),done:false,content:'',contentRich:'',shooting:'',editMusic:'',filename:'',filename2:'',filename3:'',filename4:'',timecodeNotes:[],tcOpen:false,collapsed:false};
  seg.shots.push(shot);
  cur.segments.push(seg); renderShots(); updateProgress(); autoSave();
  setTimeout(()=>{ const el=document.getElementById('segtitle-'+seg.id); if(el){el.focus();el.select();} },60);
}

function deleteSegment(segId) {
  if(!cur) return;
  const seg=(cur.segments||[]).find(s=>s.id===segId); if(!seg) return;
  // Move to project-level trash
  if(!cur._trash) cur._trash = {};
  if(!cur._trash.segments) cur._trash.segments = [];
  cur._trash.segments.unshift({ ...seg, _deletedAt: Date.now(), _fromProject: cur.id });
  seg.shots.forEach(sh=>{ resetTimer(sh.id); delete timers[sh.id]; });
  cur.segments=cur.segments.filter(s=>s.id!==segId);
  renderShots(); updateProgress(); autoSave();
  showSave('saved');
}

function toggleSegCollapse(segId) {
  const seg=(cur.segments||[]).find(s=>s.id===segId); if(!seg) return;
  seg.collapsed=!seg.collapsed;
  const card=document.getElementById('seg-'+segId);
  if(card) card.classList.toggle('seg-collapsed',seg.collapsed);
  autoSave();
}

function stToggleSeg(segId) {
  const seg = (cur.segments||[]).find(s => s.id === segId);
  if (!seg) return;
  seg.collapsed = !seg.collapsed;
  document.querySelectorAll('.st-seg-sub-' + segId).forEach(el => {
    el.style.display = seg.collapsed ? 'none' : '';
  });
  const arr = document.getElementById('st-arr-' + segId);
  if (arr) arr.style.transform = seg.collapsed ? 'rotate(-90deg)' : 'rotate(0)';
  autoSave();
}

function toggleAllSegments() {
  const segs = cur.segments || [];
  if (_tableView) {
    const allCollapsed = segs.every(s => s.collapsed);
    segs.forEach(seg => {
      seg.collapsed = !allCollapsed;
      document.querySelectorAll('.st-seg-sub-' + seg.id).forEach(el => {
        el.style.display = seg.collapsed ? 'none' : '';
      });
      const arr = document.getElementById('st-arr-' + seg.id);
      if (arr) arr.style.transform = seg.collapsed ? 'rotate(-90deg)' : 'rotate(0)';
    });
    autoSave();
    return;
  }
  const allCollapsed = segs.every(s => s.collapsed);
  segs.forEach(seg => {
    seg.collapsed = !allCollapsed;
    const card = document.getElementById('seg-' + seg.id);
    if (card) card.classList.toggle('seg-collapsed', seg.collapsed);
  });
  autoSave();
}

function setSegTitle(segId,val) {
  const seg=(cur.segments||[]).find(s=>s.id===segId); if(seg) seg.title=val;
}

// ── Move segment to another project ────────────────────────────
let _msSegId = null;
let _msAllProjects = [];

async function openMoveSegModal(segId) {
  const seg = (cur.segments||[]).find(s=>s.id===segId);
  if (!seg) return;
  _msSegId = segId;
  document.getElementById('msHint').textContent = '«' + (seg.title||'مقطع') + '»';
  document.getElementById('msSearch').value = '';
  _msAllProjects = await getAllProjects();
  _msRenderList('');
  document.getElementById('msOverlay').style.display = 'flex';
  setTimeout(()=>document.getElementById('msSearch').focus(), 80);
}

function _msRenderList(q) {
  const others = _msAllProjects.filter(p => p.id !== cur.id);
  const list = q ? others.filter(p => (p.name||'').includes(q) || (p.date||'').includes(q)) : others;
  const el = document.getElementById('msProjList');
  if (!list.length) {
    el.innerHTML = '<div class="ms-empty">لا توجد مشاريع أخرى</div>'; return;
  }
  el.innerHTML = list.map(p => {
    const segsCount = (p.segments||[]).length;
    const shotsCount = (p.segments||[]).reduce((n,s)=>n+(s.shots?.length||0),0);
    return `<div class="ms-proj-item" onclick="executeMoveOrCopySeg('${p.id}',false)">
      <div class="ms-proj-meta">
        <div class="ms-proj-name">${esc(p.name||'بدون عنوان')}</div>
        <div class="ms-proj-sub">${esc(p.date||'')}${p.date&&segsCount?' · ':''}${segsCount} مقطع · ${shotsCount} مشهد</div>
      </div>
      <span class="ms-move-btn">نقل ←</span>
    </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', ()=>{
  const s = document.getElementById('msSearch');
  if (s) s.addEventListener('input', ()=>_msRenderList(s.value.trim()));
});

function closeMoveSegModal() {
  document.getElementById('msOverlay').style.display = 'none';
  _msSegId = null;
}

async function executeMoveOrCopySeg(targetPid, copyOnly=false) {
  if (!_msSegId || !cur) return;
  const segIdx = (cur.segments||[]).findIndex(s=>s.id===_msSegId);
  if (segIdx === -1) return;

  // Get the segment (clone for copy, splice for move)
  const seg = copyOnly
    ? JSON.parse(JSON.stringify(cur.segments[segIdx]))
    : cur.segments.splice(segIdx, 1)[0];

  // Load target from fresh list and push segment
  const all = loadLS();
  const target = all.find(p=>p.id===targetPid);
  if (!target) { if(!copyOnly) cur.segments.splice(segIdx,0,seg); return; }
  if (!target.segments) target.segments = [];
  target.segments.push(seg);
  target.lastModified = Date.now();

  // Save current project (without segment) and target project (with it).
  // Both were already written to localStorage inside saveProject before any
  // network attempt, so the move is safe on this device even if the cloud
  // write fails — just warn instead of leaving the modal stuck open.
  try {
    if (!copyOnly) await saveProject(cur);
    await saveProject(target);
  } catch(e) {
    _showToast('تم النقل محلياً لكن تعذّر رفعه للسحابة — تحقق من الاتصال', 'error', 4000);
  }

  closeMoveSegModal();
  renderShots(); updateProgress();

  const action = copyOnly ? 'نُسخ' : 'نُقل';
  const nm = document.querySelector(`[data-pid="${targetPid}"] .proj-name`)?.textContent
           || _msAllProjects.find(p=>p.id===targetPid)?.name || 'المشروع';
  showSave('saved');
}

// ── Shots ──
function addShotToSeg(segId) {
  if(!cur) return;
  const seg=(cur.segments||[]).find(s=>s.id===segId); if(!seg) return;
  const s={id:uid(),title:'مشهد '+(_globalShotCount()+1),done:false,content:'',contentRich:'',shooting:'',editMusic:'',filename:'',filename2:'',filename3:'',filename4:'',timecodeNotes:[],tcOpen:false,collapsed:false};
  seg.shots.push(s);
  if (_tableView) {
    renderShots();
  } else {
    const body=document.getElementById('segbody-'+segId);
    if(body){ body.innerHTML=buildSegBodyHTML(seg); syncRunningTimers(); listRenderAllCustomPresets(); }
  }
  updateProgress(); autoSave();
  setTimeout(()=>{ const el=document.getElementById('sname-'+s.id); if(el){el.focus();el.select();} },60);
}

function addShotToLast() {
  if(!cur) return;
  if(!cur.segments||cur.segments.length===0) addSegment();
  else addShotToSeg(cur.segments[cur.segments.length-1].id);
}

// Keep old addShot() as alias for FAB / keyboard shortcut compatibility
function addShot() { addShotToLast(); }

async function delShot(shotId) {
  if(!await _showConfirm('حذف هذا المشهد؟', { destructive: true, confirmLabel: 'حذف' })) return;
  // Find shot + parent segment before removing
  let deletedShot = null, parentSegTitle = '';
  for(const seg of (cur.segments||[])){
    const sh = seg.shots.find(s=>s.id===shotId);
    if(sh){ deletedShot = sh; parentSegTitle = seg.title||''; break; }
  }
  resetTimer(shotId); delete timers[shotId];
  for(const seg of (cur.segments||[])){ seg.shots=seg.shots.filter(s=>s.id!==shotId); }
  // Move to trash
  if(deletedShot){
    if(!cur._trash) cur._trash = {};
    if(!cur._trash.shots) cur._trash.shots = [];
    cur._trash.shots.unshift({ ...deletedShot, _deletedAt: Date.now(), _parentSeg: parentSegTitle });
  }
  renderShots(); updateProgress(); autoSave();
  showSave('saved');
}

function toggleDone(id) {
  const s=_findShot(id);
  if(s){
    s.done=!s.done;
    autoSave(); updateProgress();   // persist first, then update UI (a UI throw must never block the save)
    // Update segment ring live
    const seg = _findSegForShot(id);
    if(seg) _updateSegRing(seg);
    // Re-render just the shot card style (works for both compact chips and expanded cards)
    const card = document.getElementById('sc-'+id);
    if(card){
      card.classList.toggle('done', s.done);
      const cb  = card.querySelector('.done-cb');    if(cb)  cb.checked = s.done;
      const nm  = card.querySelector('.chip-title,.shot-name,.shot-exp-title'); if(nm) nm.classList.toggle('done-text',s.done);
      const num = card.querySelector('.chip-num,.shot-num,.shot-exp-num');
      if(num) {
        num.style.color = s.done ? 'var(--green)' : '';
        if(s.done) {
          num.classList.remove('_done-pop');
          void num.offsetWidth; // force reflow to restart animation
          num.classList.add('_done-pop');
          num.addEventListener('animationend', () => num.classList.remove('_done-pop'), { once: true });
        }
      }
    }
  }
}

function _updateSegRing(seg) {
  const total = seg.shots.length, done = seg.shots.filter(s=>s.done).length;
  const pct = total ? done/total : 0;
  const r = 13, circ = 2*Math.PI*r;
  const offset = (circ*(1-pct)).toFixed(2);
  const allDone = total > 0 && done === total;
  const wrap = document.getElementById('seg-prog-'+seg.id);
  if(!wrap) return;
  const fill = wrap.querySelector('.seg-ring-fill, .seg-ring-done');
  if(fill){
    fill.setAttribute('stroke-dashoffset', offset);
    fill.className.baseVal = allDone ? 'seg-ring-done' : 'seg-ring-fill';
    fill.setAttribute('stroke', allDone ? '#22c55e' : 'var(--accent)');
  }
  const txt = wrap.querySelector('.seg-ring-check');
  if(txt){
    if(allDone){ txt.textContent='✓'; txt.setAttribute('fill','#22c55e'); txt.style.fontSize='13px'; }
    else{ txt.textContent=total===0?'—':done+'/'+total; txt.setAttribute('fill','var(--subtext)'); txt.style.fontSize='9px'; }
  }
}

function setF(id,field,val){ const s=_findShot(id); if(s) s[field]=val; }

function fmtFilename(inp, id, field='filename', cam='A') {
  const normalized = inp.value.replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660);
  const digits = normalized.replace(/\D/g, '');
  const last4  = digits.slice(-4);
  const formatted = last4 ? cam + last4.padStart(4, '0') : '';
  // Commit to the data model FIRST. If we touched the DOM/cursor before this,
  // any exception there (e.g. setSelectionRange throwing on some mobile browsers)
  // would abort before the value is stored — the number would show on screen but
  // never reach `cur`, so it vanishes on the next render / view change / exit.
  setF(id, field, formatted);
  inp.value = formatted;
  try { inp.setSelectionRange(formatted.length, formatted.length); } catch (_) {}
  // Persist right away so changing the view or leaving can never drop the number,
  // regardless of whether a later blur/`change` event fires.
  autoSave();
}
function toggleTC(id){ const s=_findShot(id); if(!s) return; s.tcOpen=!s.tcOpen; const el=document.getElementById('tcp-'+id); if(el) el.style.display=s.tcOpen?'block':'none'; }

// ── Timers ──
function startTimer(id) {
  if(!timers[id]) timers[id]={elapsed:0,running:false,startTime:null,interval:null};
  const t=timers[id]; if(t.running) return;
  t.running=true; t.startTime=Date.now();
  t.interval=setInterval(()=>{ const el=document.getElementById('tcd-'+id); if(el) el.textContent=formatTC(t.elapsed+(Date.now()-t.startTime)); },40);
  syncBtns(id);
}
function pauseTimer(id) {
  const t=timers[id]; if(!t||!t.running) return;
  t.elapsed+=Date.now()-t.startTime; t.running=false; clearInterval(t.interval); t.interval=null; syncBtns(id);
}
function resetTimer(id) {
  const t=timers[id]; if(!t) return;
  clearInterval(t.interval); Object.assign(t,{elapsed:0,running:false,startTime:null,interval:null});
  const el=document.getElementById('tcd-'+id); if(el) el.textContent='00:00:00:00'; syncBtns(id);
}
function stopAllTimers() { Object.values(timers).forEach(t=>{ if(t&&t.interval) clearInterval(t.interval); }); }
function syncBtns(id) {
  const t=timers[id],s=document.getElementById('tcStart-'+id),p=document.getElementById('tcPause-'+id);
  if(!s||!p) return;
  if(t&&t.running){s.style.display='none';p.style.display='';}else{s.style.display='';p.style.display='none';}
}
function nowTC(id) { const t=timers[id]; if(!t) return '00:00:00:00'; return formatTC(t.running?t.elapsed+(Date.now()-t.startTime):t.elapsed); }

function toggleCollapse(id) {
  const s = _findShot(id); if (!s) return;
  s.collapsed = !s.collapsed;
  const card = document.getElementById('sc-' + id);
  if(!card) return;
  card.querySelector('.collapse-btn').classList.toggle('collapsed', s.collapsed);
  card.querySelector('.shot-body').classList.toggle('collapsed', s.collapsed);
  const tcp = document.getElementById('tcp-' + id);
  if (tcp){ if (s.collapsed) tcp.style.display = 'none'; else if (s.tcOpen) tcp.style.display = 'block'; }
  autoSave();
}

function addNote(id) {
  const s=_findShot(id); if(!s) return;
  if(!s.timecodeNotes) s.timecodeNotes=[];
  const inp=document.getElementById('ni-'+id), txt=inp?inp.value.trim():'';
  s.timecodeNotes.push({id:uid(),tc:nowTC(id),text:txt||'—'});
  if(inp) inp.value=''; renderNotes(id); autoSave();
}
function addNotePreset(id, text) {
  const s=_findShot(id); if(!s) return;
  if(!s.timecodeNotes) s.timecodeNotes=[];
  s.timecodeNotes.push({id:uid(),tc:nowTC(id),text});
  renderNotes(id); autoSave();
}
function delNote(sid,nid) {
  const s=_findShot(sid); if(!s) return;
  if(!s.timecodeNotes) s.timecodeNotes=[];
  s.timecodeNotes=s.timecodeNotes.filter(n=>n.id!==nid); renderNotes(sid); autoSave();
}
function renderNotes(id) {
  const c = document.getElementById('nl-'+id); if(!c) return;
  const s = _findShot(id); if(!s) return;
  const notes = s.timecodeNotes || [];
  c.innerHTML = notes.map(n =>
    `<div class="tc-note"><span class="tc-ts">${n.tc}</span><span class="tc-txt">${esc(n.text)}</span>
    <button class="tc-rm" onclick="delNote('${id}','${n.id}')" aria-label="حذف الملاحظة">✕</button></div>`
  ).join('');
  // Update or create toggle row
  let toggle = document.getElementById('ntog-'+id);
  if (notes.length > 0) {
    if (!toggle) {
      toggle = document.createElement('div');
      toggle.className = 'tc-notes-toggle';
      toggle.id = 'ntog-'+id;
      toggle.innerHTML = `<span class="tc-notes-count" id="nc-${id}"></span><span class="tc-notes-arrow" id="na-${id}">▾</span>`;
      toggle.onclick = () => toggleTcNotes(id);
      c.before(toggle);
      c.style.display = 'none';
    }
    const nc = document.getElementById('nc-'+id);
    if (nc) nc.textContent = notes.length + ' ملاحظة';
  } else if (toggle) {
    toggle.remove();
    c.style.display = '';
  }
}
function toggleTcNotes(id) {
  const list  = document.getElementById('nl-'+id);
  const arrow = document.getElementById('na-'+id);
  if (!list) return;
  const open = list.style.display !== 'none';
  list.style.display  = open ? 'none' : 'flex';
  if (arrow) arrow.classList.toggle('open', !open);
}

// ── View settings ──
const _vsDefaults = { showShotFields: true, showTCNotes: true, showProjectInfo: true };
let _viewSettings = { ..._vsDefaults, ...JSON.parse(localStorage.getItem('sm_viewSettings') || '{}') };
// Legacy: respect old viewMode setting
if (localStorage.getItem('sm_viewMode') === 'compact') {
  _viewSettings.showShotFields = false; _viewSettings.showTCNotes = false;
}
// _viewMode kept for compatibility with filtered view path
let _viewMode = _viewSettings.showShotFields ? 'expanded' : 'compact';

function setViewMode(mode) {
  applyViewSetting('showShotFields', mode === 'expanded');
}

function applyViewSetting(key, val) {
  _viewSettings[key] = val;
  localStorage.setItem('sm_viewSettings', JSON.stringify(_viewSettings));
  if (key === 'showShotFields' || key === 'showTCNotes') {
    _viewMode = _viewSettings.showShotFields ? 'expanded' : 'compact';
    renderShots();
  }
  if (key === 'showProjectInfo') {
    const card = document.getElementById('infoCard');
    if (card) card.style.display = val ? '' : 'none';
  }
}

function _updateViewDropBtn() {
  const btn = document.getElementById('viewDropBtn');
  if (!btn) return;
  if (_tableView) {
    btn.innerHTML = '<span aria-hidden="true">⊞</span><span aria-hidden="true" style="font-size:10px">▾</span>';
    btn.setAttribute('aria-label', 'إظهار/إخفاء الأعمدة');
    btn.title = 'إظهار/إخفاء الأعمدة';
  } else {
    btn.innerHTML = '<span aria-hidden="true">👁</span><span aria-hidden="true" style="font-size:10px">▾</span>';
    btn.setAttribute('aria-label', 'خيارات العرض');
    btn.title = '';
  }
}

function _syncViewDropdown() {
  const cb = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  cb('vsFields',  _viewSettings.showShotFields);
  cb('vsTCNotes', _viewSettings.showTCNotes);
  cb('vsInfo',    _viewSettings.showProjectInfo);
  cb('vsTable',   _tableView);
  _updateViewDropBtn();
  // Apply project info card visibility
  const card = document.getElementById('infoCard');
  if (card) card.style.display = _viewSettings.showProjectInfo ? '' : 'none';
}

const _syncViewToggle = _syncViewDropdown;

function toggleViewDropdown() {
  const btn  = document.getElementById('viewDropBtn');
  if (!btn) return;
  // In table view the 👁 button shows the columns dropdown; in cards view it shows the view-method options
  if (_tableView) {
    const dd = document.getElementById('sfColDropdown');
    const menu = document.getElementById('viewDropMenu');
    if (menu) menu.style.display = 'none';
    if (!dd) return;
    Object.keys(_tableColVis).forEach(k => {
      const cb = document.getElementById('sfCol-' + k);
      if (cb) cb.checked = _tableColVis[k];
    });
    const isOpen = dd.classList.contains('open');
    if (!isOpen) {
      const r = btn.getBoundingClientRect();
      dd.style.top   = (r.bottom + 6) + 'px';
      dd.style.left  = 'auto';
      dd.style.right = (window.innerWidth - r.right) + 'px';
    }
    dd.classList.toggle('open', !isOpen);
    btn.classList.toggle('sf-active', !isOpen);
    return;
  }
  const menu = document.getElementById('viewDropMenu');
  if (!menu) return;
  const open = menu.style.display !== 'none';
  if (!open) {
    const r = btn.getBoundingClientRect();
    menu.style.top   = (r.bottom + 6) + 'px';
    menu.style.left  = 'auto';
    menu.style.right = (window.innerWidth - r.right) + 'px';
  }
  menu.style.display = open ? 'none' : 'flex';
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  const wrap = document.getElementById('viewDropWrap');
  const menu = document.getElementById('viewDropMenu');
  if (wrap && !wrap.contains(e.target) && menu && !menu.contains(e.target)) {
    if (menu) menu.style.display = 'none';
  }
});

function buildShotHTML(s, globalIdx, segId) {
  if (_viewMode === 'expanded') return buildShotExpandedHTML(s, globalIdx, segId);
  return `
    <div class="shot-chip ${s.done?'done':''}" id="sc-${s.id}"
         draggable="true" data-shot-id="${s.id}" data-seg-id="${segId}"
         ondragstart="shotDragStart(event)" ondragend="shotDragEnd(event)">
      <input type="text" class="chip-title ${s.done?'done-text':''}"
             id="sname-${s.id}" value="${esc(s.title)}" placeholder="عنوان المشهد"
             oninput="setF('${s.id}','title',this.value)" onchange="autoSave()">
      <div class="chip-footer">
        <span class="chip-drag" onmousedown="_shotDragOk=true" onmouseup="_shotDragOk=false"
              ontouchstart="_shotDragOk=true" title="اسحب لإعادة الترتيب">⠿</span>
        <div class="chip-num">${globalIdx}</div>
        <input type="checkbox" class="chip-cb done-cb" ${s.done?'checked':''}
               onchange="toggleDone('${s.id}')">
        <div class="chip-spacer"></div>
        <button class="chip-full-btn" onclick="openShotFull('${s.id}')" title="فتح كامل">⛶</button>
      </div>
    </div>`;
}

function buildShotExpandedHTML(s, globalIdx, segId) {
  const showFields = _viewSettings.showShotFields;
  const showTC    = _viewSettings.showTCNotes;
  const notes = (s.timecodeNotes||[]).map(n =>
    `<div class="tc-note"><span class="tc-ts">${n.tc}</span><span class="tc-txt">${esc(n.text)}</span><button class="tc-rm" onclick="delNote('${s.id}','${n.id}')" aria-label="حذف الملاحظة">✕</button></div>`
  ).join('');

  return `
    <div class="shot-exp ${s.done?'done':''}" id="sc-${s.id}"
         draggable="true" data-shot-id="${s.id}" data-seg-id="${segId}"
         ondragstart="shotDragStart(event)" ondragend="shotDragEnd(event)">
      <div class="shot-exp-head">
        <div class="shot-exp-num">${globalIdx}</div>
        <input type="checkbox" class="shot-exp-done-cb done-cb" ${s.done?'checked':''}
               onchange="toggleDone('${s.id}')">
        <input type="text" class="shot-exp-title ${s.done?'done-text':''}"
               id="sname-${s.id}" value="${esc(s.title)}" placeholder="عنوان المشهد"
               oninput="setF('${s.id}','title',this.value)" onchange="autoSave()">
        <button class="shot-exp-full-btn" onclick="openShotFull('${s.id}')" title="فتح كامل" aria-label="فتح المشهد كاملاً">⛶</button>
        <button class="shot-exp-del-btn" onclick="delShot('${s.id}')" title="حذف" aria-label="حذف المشهد">✕</button>
      </div>
      ${showFields ? `
      <div class="shot-exp-fields">
        <textarea class="shot-exp-content-ta" id="ctxt-${s.id}"
          placeholder="المحتوى..." rows="1"
          oninput="setF('${s.id}','content',this.value)"
          onchange="autoSave()">${esc(s.content||'')}</textarea>
        <div class="shot-exp-meta-row">
          ${_isHatemFolder() ? '' : `<input class="shot-exp-meta-inp" type="text" placeholder="👤 الوجه"
            oninput="setF('${s.id}','face',this.value)" onchange="autoSave()" value="${esc(s.face||'')}">`}
          <input class="shot-exp-meta-inp shot-exp-file-inp" type="text" placeholder="A — الرقم"
            oninput="fmtFilename(this,'${s.id}','filename','A')" onchange="autoSave()" value="${esc(s.filename||'')}" inputmode="numeric">
          <input class="shot-exp-meta-inp shot-exp-file-inp" type="text" placeholder="B — الرقم"
            oninput="fmtFilename(this,'${s.id}','filename2','B')" onchange="autoSave()" value="${esc(s.filename2||'')}" inputmode="numeric">
          <input class="shot-exp-meta-inp shot-exp-file-inp" type="text" placeholder="C — الرقم"
            oninput="fmtFilename(this,'${s.id}','filename3','C')" onchange="autoSave()" value="${esc(s.filename3||'')}" inputmode="numeric">
          <input class="shot-exp-meta-inp shot-exp-file-inp" type="text" placeholder="D — الرقم"
            oninput="fmtFilename(this,'${s.id}','filename4','D')" onchange="autoSave()" value="${esc(s.filename4||'')}" inputmode="numeric">
        </div>
      </div>` : ''}
      ${showTC ? `
      <div class="shot-exp-tc" id="tcp-${s.id}">
        <div class="shot-exp-tc-row">
          <span class="shot-exp-tc-clock" id="tcd-${s.id}">00:00:00:00</span>
          <button class="btn btn-green btn-sm" id="tcStart-${s.id}" onclick="startTimer('${s.id}')">▶</button>
          <button class="btn btn-glass btn-sm" id="tcPause-${s.id}" onclick="pauseTimer('${s.id}')" style="display:none">⏸</button>
          <button class="btn btn-glass btn-sm" onclick="resetTimer('${s.id}')">⏹</button>
          <input type="text" class="shot-exp-tc-input" id="ni-${s.id}"
                 placeholder="اكتب ملاحظة ثم Enter..."
                 onkeypress="if(event.key==='Enter')addNote('${s.id}')">
          <button class="btn btn-glass btn-sm" onclick="addNote('${s.id}')">+</button>
        </div>
        <div class="tc-presets" id="lp-${s.id}">
          <button class="tc-preset-btn tc-preset-green" onclick="addNotePreset('${s.id}','إلى هنا ممتاز')">إلى هنا ممتاز</button>
          <button class="tc-preset-btn tc-preset-red" onclick="addNotePreset('${s.id}','احذف قبل')">احذف قبل</button>
          <button class="tc-add-preset-btn" onclick="listShowAddPreset('${s.id}')" id="lpAddBtn-${s.id}">＋ زر جديد</button>
        </div>
        <div class="tc-preset-input-row" id="lpRow-${s.id}">
          <input type="text" id="lpInput-${s.id}" placeholder="اكتب نص الزر الجديد..." onkeypress="if(event.key==='Enter') listSavePreset('${s.id}')">
          <button class="btn btn-filled btn-sm" onclick="listSavePreset('${s.id}')">حفظ</button>
          <button class="btn btn-glass btn-sm" onclick="listHideAddPreset('${s.id}')">إلغاء</button>
        </div>
        ${notes ? `
        <div class="tc-notes-toggle" onclick="toggleTcNotes('${s.id}')">
          <span class="tc-notes-count" id="nc-${s.id}">${(s.timecodeNotes||[]).length} ملاحظة</span>
          <span class="tc-notes-arrow" id="na-${s.id}">▾</span>
        </div>
        <div class="tc-notes-list" id="nl-${s.id}" style="display:none">${notes}</div>
        ` : `<div class="tc-notes-list" id="nl-${s.id}"></div>`}
      </div>` : ''}
    </div>`;
}

function buildSegBodyHTML(seg) {
  const gridClass = _viewMode === 'expanded' ? 'seg-shots-grid-exp' : 'seg-shots-grid';
  let html = `<div class="${gridClass}" id="segshots-${seg.id}">`;
  let gi = 1;
  for (const s of (cur.segments||[])) {
    if (s.id === seg.id) break;
    gi += s.shots.length;
  }
  (seg.shots||[]).forEach((s, i) => {
    html += buildShotHTML(s, gi + i, seg.id);
  });
  html += `<div class="shot-chip-add" onclick="addShotToSeg('${seg.id}')">+ مشهد</div>`;
  html += '</div>';
  return html;
}



// Check if current project is in folder named "تمرة"

function setSegRukn(segId, val) {
  const seg = (cur.segments||[]).find(s => s.id === segId);
  if (seg) { seg.rukn = val; autoSave(); }
}
function setSegFace(segId, val) {
  const seg = (cur.segments||[]).find(s => s.id === segId);
  if (seg) { seg.face = val; autoSave(); }
}
function setSegLink(segId, val) {
  const seg = (cur.segments||[]).find(s => s.id === segId);
  if (seg) { seg.link = val; autoSave(); }
}

let _segLinkId = null;
function segLinkAction(segId) {
  _segLinkId = segId;
  const seg = (cur.segments||[]).find(s => s.id === segId);
  if (!seg) return;
  const overlay = document.getElementById('segLinkOverlay');
  const viewMode = document.getElementById('segLinkViewMode');
  const editMode = document.getElementById('segLinkEditMode');
  const input = document.getElementById('segLinkInput');
  if (seg.link) {
    viewMode.style.display = '';
    editMode.style.display = 'none';
    document.getElementById('segLinkModalTitle').textContent = 'رابط المقطع';
  } else {
    viewMode.style.display = 'none';
    editMode.style.display = '';
    input.value = '';
    setTimeout(() => input.focus(), 80);
  }
  overlay.style.display = 'flex';
}
function segLinkEdit() {
  const seg = (cur.segments||[]).find(s => s.id === _segLinkId);
  document.getElementById('segLinkViewMode').style.display = 'none';
  document.getElementById('segLinkEditMode').style.display = '';
  const input = document.getElementById('segLinkInput');
  input.value = seg?.link || '';
  setTimeout(() => input.focus(), 80);
}
function segLinkOpen() {
  const seg = (cur.segments||[]).find(s => s.id === _segLinkId);
  if (seg?.link) window.open(seg.link, '_blank', 'noopener');
  closeSegLinkModal();
}
function segLinkSave() {
  const val = document.getElementById('segLinkInput').value.trim();
  setSegLink(_segLinkId, val);
  // update button style
  const btn = document.getElementById('seglinkbtn-' + _segLinkId);
  if (btn) btn.classList.toggle('seg-link-btn--set', !!val);
  closeSegLinkModal();
}
function closeSegLinkModal() {
  document.getElementById('segLinkOverlay').style.display = 'none';
  _segLinkId = null;
}
function setSegFaceAll(segId, val) {
  const seg = (cur.segments||[]).find(s => s.id === segId);
  if (!seg) return;
  seg.shots.forEach(s => s.face = val);
  autoSave();
}
function _segFaceLabel(seg) {
  const faces = (seg.shots||[]).map(s => s.face||'');
  if (!faces.length) return { val:'', ph:'الوجه' };
  const allSame = faces.every(f => f === faces[0]);
  return allSame ? { val: faces[0], ph:'الوجه' } : { val:'', ph:'متعدد' };
}
function _refreshSegFaceEl(segId) {
  const seg = (cur.segments||[]).find(s => s.id === segId);
  const el = document.getElementById('st-seg-face-'+segId);
  if (!seg || !el) return;
  const {val,ph} = _segFaceLabel(seg);
  el.value = val; el.placeholder = ph;
}
function segfSetFace(val) {
  const seg = (cur.segments||[]).find(s => s.id === _segfId);
  if (seg) { seg.face = val; const el = document.getElementById('segface-' + _segfId); if (el) el.value = val; autoSave(); }
}
function _isTamraFolder() {
  if (!cur || !cur.folderId) return false;
  const folder = loadFolders().find(f => f.id === cur.folderId);
  return folder?.name?.trim() === 'تمرة';
}
function _isHatemFolder() {
  return _getFolderName() === 'قناة حاتم';
}
function _getFolderName() {
  if (!cur || !cur.folderId) return '';
  return loadFolders().find(f => f.id === cur.folderId)?.name?.trim() || '';
}
function _getRuknList() {
  const name = _getFolderName();
  if (name === 'تمرة') return ['الشرح البودكاستي','اشرح لي في دقيقة','الإعلانات','الشرح المباشر','اسأل واستثمر','مزايا التطبيق','في المكتب'];
  if (name === 'قناة حاتم') return ['تأملات','أدلة','معيشة','كتب','غيرها'];
  return [];
}
function _getRuknLabel() {
  return _getFolderName() === 'قناة حاتم' ? 'السلسلة' : 'الركن';
}

function buildSegmentHTML(seg) {
  const total=seg.shots.length, done=seg.shots.filter(s=>s.done).length;
  const pct = total ? done/total : 0;
  const r = 13, circ = 2*Math.PI*r;
  const offset = circ*(1-pct);
  const allDone = total > 0 && done === total;
  const ringClass = allDone ? 'seg-ring-done' : 'seg-ring-fill';
  return `
    <div class="seg-card-new ${seg.collapsed?'seg-collapsed':''}" id="seg-${seg.id}">
      <div class="seg-head-new">
        <div class="seg-head-row1">
          <button class="seg-toggle-new" onclick="toggleSegCollapse('${seg.id}')">▼</button>
          <span style="font-size:15px;flex-shrink:0">🎬</span>
          <input type="text" class="seg-title-new" id="segtitle-${seg.id}"
                 value="${esc(seg.title)}" placeholder="عنوان المقطع"
                 oninput="setSegTitle('${seg.id}',this.value)" onchange="autoSave()">
          ${_isHatemFolder() ? '' : `<input type="text" class="seg-face-input" id="segface-${seg.id}"
                 value="${esc(seg.face||'')}" placeholder="الوجه"
                 oninput="setSegFace('${seg.id}',this.value)">`}
        </div>
        <div class="seg-head-row2">
          ${_getRuknList().length ? `<select class="seg-rukn-input" id="segrokn-${seg.id}"
                 onchange="setSegRukn('${seg.id}',this.value);autoSave()">
            <option value="">${_getRuknLabel()}</option>
            ${_getRuknList().map(r=>`<option value="${r}" ${(seg.rukn||'')==r?'selected':''}>${r}</option>`).join('')}
          </select>` : '<span style="flex:1"></span>'}
          <div class="seg-progress-wrap" id="seg-prog-${seg.id}">
            <svg class="seg-progress-ring" viewBox="0 0 32 32">
              <circle class="seg-ring-bg" cx="16" cy="16" r="${r}"/>
              <circle class="${ringClass}" cx="16" cy="16" r="${r}"
                stroke-dasharray="${circ.toFixed(2)}"
                stroke-dashoffset="${offset.toFixed(2)}"/>
              ${allDone
                ? `<text class="seg-ring-check" x="16" y="17" fill="#22c55e">✓</text>`
                : `<text class="seg-ring-check" x="16" y="17" fill="var(--subtext)" style="font-size:9px">${total===0?'—':done+'/'+total}</text>`
              }
            </svg>
          </div>
          <div class="seg-actions-new">
            <button class="seg-chat-btn" id="segchatbtn-${seg.id}" onclick="toggleSegChat('${seg.id}')" title="شات المقطع">💬</button>
            <button class="btn btn-glass btn-sm" onclick="openSegFull('${seg.id}')" title="شاشة كاملة">⛶</button>
            <button class="btn btn-glass btn-sm" onclick="openMoveSegModal('${seg.id}')" title="نقل">↗</button>
            <button class="btn btn-glass btn-sm seg-link-btn ${seg.link?'seg-link-btn--set':''}" id="seglinkbtn-${seg.id}" onclick="segLinkAction('${seg.id}')" title="رابط المقطع">🔗</button>
            <button class="seg-del-btn" onclick="deleteSegment('${seg.id}')" title="حذف" aria-label="حذف المقطع">🗑</button>
          </div>
        </div>
      </div>
      <div class="seg-chat-wrap" id="segchat-${seg.id}" style="display:none">
        <div class="seg-chat-msgs" id="segchat-msgs-${seg.id}">
          <div class="seg-chat-empty">ابدأ المحادثة...</div>
        </div>
        <div class="seg-chat-input-row">
          <textarea class="seg-chat-input" id="segchat-inp-${seg.id}"
            placeholder="اكتب رسالة..." rows="1"
            onkeydown="segChatKeydown(event,'${seg.id}')"
            oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px'"></textarea>
          <button class="seg-chat-send" onclick="sendSegChat('${seg.id}')">إرسال</button>
        </div>
      </div>
      <div class="seg-body-wrap"><div id="segbody-${seg.id}">
        ${buildSegBodyHTML(seg)}
      </div></div>
    </div>`;
}

// ── Segment Chat ──────────────────────────────────────────────────
const _segChatUnsubs = {};

function _segChatCol(segId) {
  if (!cur || !fbUser) return null;
  return collection(db, 'projectChats', cur.id + '_' + segId, 'messages');
}

function toggleSegChat(segId) {
  const wrap = document.getElementById('segchat-' + segId);
  if (!wrap) { console.error('chat wrap not found for seg:', segId); return; }
  const opening = wrap.style.display === 'none' || wrap.style.display === '';
  wrap.style.display = opening ? 'block' : 'none';
  if (opening) {
    _subscribeSegChat(segId);
    const inp = document.getElementById('segchat-inp-' + segId);
    if (inp) inp.focus();
  } else {
    if (_segChatUnsubs[segId]) { _segChatUnsubs[segId](); delete _segChatUnsubs[segId]; }
  }
}

function _subscribeSegChat(segId) {
  if (_segChatUnsubs[segId]) return;
  const col = _segChatCol(segId);
  if (!col) return;
  if (cur && fbUser) {
    const chatId = cur.id + '_' + segId;
    setDoc(doc(db, 'projectChats', chatId), {
      ownerUid: cur._ownerUid || fbUser.uid,
      folderId: cur.folderId || null
    }, { merge: true }).catch(() => {});
  }
  const q = query(col, orderBy('createdAt', 'asc'));
  _segChatUnsubs[segId] = onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _renderSegChatMsgs(segId, msgs);
    _updateChatBtnCount(segId, msgs.length);
  }, err => console.warn('chat snapshot err:', err));
}

function _renderSegChatMsgs(segId, msgs) {
  const container = document.getElementById('segchat-msgs-' + segId);
  if (!container) return;
  if (!msgs.length) {
    container.innerHTML = '<div class="seg-chat-empty">ابدأ المحادثة...</div>';
    return;
  }
  container.innerHTML = msgs.map(m => {
    const isMe = m.uid === fbUser?.uid;
    const initial = (m.displayName || '؟').charAt(0).toUpperCase();
    const avatarHtml = m.photoURL
      ? `<img src="${esc(m.photoURL)}" alt="">`
      : initial;
    const time = m.createdAt?.toDate ? _fmtChatTime(m.createdAt.toDate()) : '';
    return `<div class="seg-chat-msg${isMe ? ' me' : ''}">
      <div class="seg-chat-avatar">${avatarHtml}</div>
      <div class="seg-chat-bubble">
        <div class="seg-chat-name">${isMe ? time : esc(m.displayName || 'مجهول') + (time ? ' · ' + time : '')}</div>
        <div class="seg-chat-text">${esc(m.text)}</div>
      </div>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function _fmtChatTime(date) {
  return date.getHours().toString().padStart(2,'0') + ':' + date.getMinutes().toString().padStart(2,'0');
}

function _updateChatBtnCount(segId, count) {
  const btn = document.getElementById('segchatbtn-' + segId);
  if (!btn) return;
  if (count > 0) {
    btn.innerHTML = `💬 <span class="seg-chat-count">${count}</span>`;
  } else {
    btn.innerHTML = '💬';
  }
}

async function sendSegChat(segId) {
  if (!fbUser) return;
  const inp = document.getElementById('segchat-inp-' + segId);
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  inp.style.height = 'auto';
  const col = _segChatCol(segId);
  if (!col) return;
  if (cur) {
    const chatId = cur.id + '_' + segId;
    await setDoc(doc(db, 'projectChats', chatId), {
      ownerUid: cur._ownerUid || fbUser.uid,
      folderId: cur.folderId || null
    }, { merge: true }).catch(() => {});
  }
  await addDoc(col, {
    uid: fbUser.uid,
    displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'مستخدم',
    photoURL: fbUser.photoURL || null,
    text,
    createdAt: serverTimestamp()
  }).catch(err => console.error('chat send err:', err));
}

function segChatKeydown(e, segId) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendSegChat(segId);
  }
}

function syncRunningTimers() {
  Object.keys(timers).forEach(id=>{ if(timers[id]?.running) syncBtns(id); });
}

// ── Drag & Drop reorder shots ──────────────────────────────────
let _shotDragOk  = false;
let _shotDragId  = null;
let _shotDragSeg = null;

function shotDragStart(e) {
  if (!_shotDragOk) { e.preventDefault(); return; }
  _shotDragId  = e.currentTarget.dataset.shotId;
  _shotDragSeg = e.currentTarget.dataset.segId;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _shotDragId);
  setTimeout(() => e.currentTarget.classList.add('dragging'), 0);
}

function shotDragEnd(e) {
  _shotDragOk = false;
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.shot-chip.drag-above,.shot-chip.drag-below,.shot-exp.drag-above,.shot-exp.drag-below')
    .forEach(el => { el.classList.remove('drag-above','drag-below'); });
}

function _shotCard(el) { return el.closest('.shot-chip') || el.closest('.shot-exp'); }

function _initShotDragDrop() {
  const list = document.getElementById('shotsList');
  if (!list || list._dndInit) return;
  list._dndInit = true;

  list.addEventListener('dragover', e => {
    if (!_shotDragId) return;
    const card = _shotCard(e.target);
    if (!card || card.dataset.shotId === _shotDragId) return;
    if (card.dataset.segId !== _shotDragSeg) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    list.querySelectorAll('.shot-chip.drag-above,.shot-chip.drag-below,.shot-exp.drag-above,.shot-exp.drag-below')
      .forEach(el => el.classList.remove('drag-above','drag-below'));
    const mid = card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2;
    card.classList.add(e.clientY < mid ? 'drag-above' : 'drag-below');
  });

  list.addEventListener('dragleave', e => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      list.querySelectorAll('.shot-chip.drag-above,.shot-chip.drag-below,.shot-exp.drag-above,.shot-exp.drag-below')
        .forEach(el => el.classList.remove('drag-above','drag-below'));
    }
  });

  list.addEventListener('drop', e => {
    if (!_shotDragId) return;
    const card = _shotCard(e.target);
    if (!card) return;
    e.preventDefault();
    const targetId  = card.dataset.shotId;
    const targetSeg = card.dataset.segId;
    if (targetId === _shotDragId || targetSeg !== _shotDragSeg) {
      _shotDragId = null; _shotDragSeg = null; return;
    }
    const above = card.classList.contains('drag-above');
    const seg   = (cur.segments||[]).find(s => s.id === _shotDragSeg);
    if (!seg) return;
    const fromIdx = seg.shots.findIndex(s => s.id === _shotDragId);
    const [shot]  = seg.shots.splice(fromIdx, 1);
    const toIdx   = seg.shots.findIndex(s => s.id === targetId);
    seg.shots.splice(above ? toIdx : toIdx + 1, 0, shot);
    _shotDragId = null; _shotDragSeg = null;
    renderShots(); autoSave();
  });
}

// ── Shot Filters ───────────────────────────────────────────────
let _shotFilter = { done: 'all', face: '', rukn: '', chrono: false };

function setShotFilter(key, val) {
  _shotFilter[key] = val;
  renderShots();
}

function _updateFaceOptions() {
  // ── Face options ──
  const sel = document.getElementById('sfFaceSel'); if (!sel) return;
  const faces = [...new Set(
    (cur?.segments||[]).flatMap(sg => sg.shots||[])
      .map(s => (s.face||'').trim()).filter(Boolean)
  )].sort();
  const cur_val = sel.value;
  sel.innerHTML = '<option value="">الكل</option>' +
    faces.map(f => `<option value="${esc(f)}" ${cur_val===f?'selected':''}>${esc(f)}</option>`).join('');
  if (!faces.includes(cur_val)) sel.value = '';

  // ── Rukn options (only for تمرة folder) ──
  const hasRukn = _getRuknList().length > 0;
  const ruknSel = document.getElementById('sfRuknSel');
  const ruknDiv = document.getElementById('sfRuknDiv');
  const ruknLbl = document.getElementById('sfRuknLbl');
  if (ruknSel) {
    const show = hasRukn ? '' : 'none';
    ruknSel.style.display = show;
    if (ruknDiv) ruknDiv.style.display = show;
    if (ruknLbl) { ruknLbl.style.display = show; ruknLbl.textContent = _getRuknLabel(); }
    if (hasRukn) {
      const rukns = [...new Set(
        (cur?.segments||[]).map(sg => (sg.rukn||'').trim()).filter(Boolean)
      )].sort();
      const cur_rukn = ruknSel.value;
      ruknSel.innerHTML = '<option value="">الكل</option>' +
        rukns.map(r => `<option value="${esc(r)}" ${cur_rukn===r?'selected':''}>${esc(r)}</option>`).join('');
      if (!rukns.includes(cur_rukn)) ruknSel.value = '';
    }
  }
}

function _updateFilterUI() {
  const { done, face, rukn, chrono } = _shotFilter;
  const show = v => v ? '' : 'none';
  ['shotsBarFilterDivider','sfDoneAll','sfDoneDone','sfDonePending','sfFaceSel'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = show(cur);
  });
  const bar = document.getElementById('shotsFilterBar'); if (bar) bar.style.display = 'none';
  const colWrap = document.getElementById('sfColWrap');
  const colDiv  = document.getElementById('sfColDivider');
  // Columns button is merged into the 👁 view button now — keep the standalone one hidden
  if (colWrap) colWrap.style.display = 'none';
  if (colDiv)  colDiv.style.display  = 'none';
  // done chips
  ['All','Done','Pending'].forEach(k => {
    const el = document.getElementById('sfDone'+k);
    if (el) el.classList.toggle('sf-active', done === k.toLowerCase());
  });
  // face select highlight
  const sel = document.getElementById('sfFaceSel');
  if (sel) sel.classList.toggle('sf-active', !!face);
  // rukn select highlight
  const ruknSel = document.getElementById('sfRuknSel');
  if (ruknSel) ruknSel.classList.toggle('sf-active', !!rukn);
  // chrono chip
  const ch = document.getElementById('sfChronoCh');
  if (ch) ch.classList.toggle('sf-active', chrono);
}

function _filteredSegHTML() {
  const { done, face, rukn, chrono } = _shotFilter;
  // collect all shots with their metadata
  let pool = [];
  let gIdx = 1;
  for (const seg of (cur.segments||[])) {
    for (const s of (seg.shots||[])) {
      pool.push({ s, idx: gIdx++, seg });
    }
  }
  // apply filters
  if (done === 'done')    pool = pool.filter(({s}) => s.done);
  if (done === 'pending') pool = pool.filter(({s}) => !s.done);
  if (face)               pool = pool.filter(({s}) => (s.face||'').trim() === face);
  if (rukn)               pool = pool.filter(({seg}) => (seg.rukn||'').trim() === rukn);

  if (!pool.length) return '<div style="text-align:center;padding:32px 0;color:var(--subtext);font-size:14px">لا توجد نتائج</div>';

  if (chrono) {
    // flat list — one wrapper, label each shot with its segment
    const cards = pool.map(({s, idx, seg}) =>
      `<div class="shot-seg-label">▣ ${esc(seg.title)}</div>${buildShotHTML(s, idx, seg.id)}`
    ).join('');
    return `<div class="segment-card">
      <div class="segment-head" style="cursor:default">
        <span class="seg-icon">⏱</span>
        <span class="seg-title" style="font-weight:600">جميع المشاهد — ${pool.length}</span>
      </div>
      <div class="seg-body-grid"><div class="segment-body">${cards}</div></div>
    </div>`;
  } else {
    // group by segment but only show matching shots
    let html = '';
    for (const seg of (cur.segments||[])) {
      const segShots = pool.filter(({seg: sg}) => sg.id === seg.id);
      if (!segShots.length) continue;
      const doneC = segShots.filter(({s})=>s.done).length;
      const stats = `${doneC}/${segShots.length} تم`;
      html += `<div class="segment-card ${seg.collapsed?'seg-collapsed':''}" id="seg-${seg.id}">
        <div class="segment-head">
          <button class="seg-toggle" onclick="toggleSegCollapse('${seg.id}')">▼</button>
          <span class="seg-icon">▣</span>
          <input type="text" class="seg-title" value="${esc(seg.title)}"
            oninput="setSegTitle('${seg.id}',this.value)" onchange="autoSave()">
          <span class="seg-stats">${stats}</span>
          <div class="seg-actions">
            <button class="btn btn-filled btn-sm" onclick="addShotToSeg('${seg.id}')">+ مشهد</button>
            <button class="btn btn-glass btn-sm" onclick="openMoveSegModal('${seg.id}')">↗ نقل</button>
            <button class="seg-del-btn" onclick="deleteSegment('${seg.id}')" aria-label="حذف المقطع">🗑</button>
          </div>
        </div>
        <div class="seg-body-grid"><div class="segment-body" id="segbody-${seg.id}">
          ${segShots.map(({s,idx,seg:sg})=>buildShotHTML(s,idx,sg.id)).join('')}
        </div></div>
      </div>`;
    }
    return html;
  }
}

function renderShots() {
  const list=document.getElementById('shotsList'),empty=document.getElementById('shotsEmpty');
  if(!cur){ list.innerHTML=''; empty.style.display='block'; _updateFilterUI(); return; }
  if(!cur.segments) cur.segments=[];
  const totalShots=_globalShotCount();
  if(totalShots===0 && cur.segments.length===0){ list.innerHTML=''; empty.style.display='block'; _updateFilterUI(); return; }
  empty.style.display='none';
  _updateFaceOptions();

  const {done, face, rukn, chrono} = _shotFilter;
  const hasFilter = done!=='all' || face || rukn || chrono;

  if (_tableView) {
    list.innerHTML = buildTableViewHTML();
    _syncViewToggle(); _updateFilterUI(); _updateProjTrashBtn();
    return;
  }

  const segsHTML = hasFilter ? _filteredSegHTML()
                              : cur.segments.map(seg=>buildSegmentHTML(seg)).join('');
  // Expanded mode: single-column layout for segments (shots need full width)
  const gridClass = _viewMode === 'expanded' ? 'segs-grid segs-grid-exp' : 'segs-grid';
  list.innerHTML = `<div class="${gridClass}">${segsHTML}</div>`;
  syncRunningTimers();
  listRenderAllCustomPresets();
  // Re-init drag-drop on re-render
  list._dndInit = false;
  _initShotDragDrop();
  _syncViewToggle();
  _updateFilterUI();
  _updateProjTrashBtn();
}

function updateProgress() {
  if(!cur) return;
  // Shots progress
  const all=_allShots(), total=all.length, done=all.filter(s=>s.done).length, pct=total?done/total:0;
  // Guard every element: these live in the collapsible info card, which some
  // layouts (shared / view-only / edit-share) don't render. An unguarded access
  // here would throw and abort the caller before it reaches autoSave().
  const pFill = document.getElementById('pFill');
  if(pFill) pFill.style.transform='scaleX('+pct+')';
  const pCount = document.getElementById('pCount');
  if(pCount) pCount.textContent=done+' / '+total;
  const countHead = document.getElementById('pCountHead');
  if(countHead) countHead.textContent=done+' / '+total;
  const miniFill = document.getElementById('miniFill');
  const miniCount = document.getElementById('miniCount');
  if(miniFill)  miniFill.style.transform='scaleX('+pct+')';
  if(miniCount) miniCount.textContent=done+'/'+total;
  // Segments progress: a segment is done when ALL its shots are done (and has at least 1 shot)
  const segs = cur.segments||[];
  const segTotal = segs.length;
  const segDone  = segs.filter(s=>s.shots.length>0 && s.shots.every(sh=>sh.done)).length;
  const segPct   = segTotal ? segDone/segTotal : 0;
  const fillSeg  = document.getElementById('pFillSeg');
  const countSeg = document.getElementById('pCountSeg');
  if(fillSeg)  fillSeg.style.transform = 'scaleX('+segPct+')';
  if(countSeg) countSeg.textContent = segDone+' / '+segTotal;
  const countSegHead = document.getElementById('pCountSegHead');
  if(countSegHead) countSegHead.textContent = segDone+' / '+segTotal;
  const miniFillSeg = document.getElementById('miniFillSeg');
  const miniCountSeg = document.getElementById('miniCountSeg');
  if(miniFillSeg)  miniFillSeg.style.transform = 'scaleX('+segPct+')';
  if(miniCountSeg) miniCountSeg.textContent = segDone+'/'+segTotal;
  const headName = document.getElementById('infoHeadName');
  if(headName) headName.textContent = (cur.name||'').trim() || 'بدون اسم';
}

// ── Export ──
function exportJSON() {
  autoSave();
  const blob=new Blob([JSON.stringify(cur,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=(cur.name||'مشروع')+'.json'; a.click(); URL.revokeObjectURL(a.href);
}

function importProject() { document.getElementById('fileInput').click(); }
function importExcel()   { document.getElementById('xlsxInput').click(); }
function toggleImportDrop() {
  const m = document.getElementById('importDropMenu');
  if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
function toggleCreateDrop() {
  const m = document.getElementById('createDropMenu');
  if (m) m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', e => {
  const iBtn = document.getElementById('importDropBtn');
  if (iBtn && !iBtn.closest('div').contains(e.target)) {
    const m = document.getElementById('importDropMenu');
    if (m) m.style.display = 'none';
  }
  const cBtn = document.getElementById('createDropBtn');
  if (cBtn && !cBtn.closest('div').contains(e.target)) {
    const m = document.getElementById('createDropMenu');
    if (m) m.style.display = 'none';
  }
});

async function handleExcelImport(ev) {
  const file = ev.target.files[0]; if (!file) return;
  ev.target.value = '';

  if (typeof XLSX === 'undefined') {
    _showToast('مكتبة Excel لم تُحمَّل بعد، انتظر لحظة وأعد المحاولة.', 'error'); return;
  }

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });

      // Use first sheet
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (rows.length < 2) { _showToast('الملف لا يحتوي على بيانات كافية.', 'error'); return; }

      // Detect header row (first row)
      // Expected columns: المقطع، عنوان المشهد، المحتوى، التصوير، المونتاج، اسم ملف A، اسم ملف B
      // We try to auto-detect by position: A=0,B=1,C=2,D=3,E=4,F=5,G=6
      // If header row found, skip it; else start from row 0
      const firstRow = rows[0];
      const isHeaderRow = firstRow.some(c => String(c).includes('مشهد') || String(c).includes('مقطع') || String(c).includes('عنوان'));
      const dataRows = isHeaderRow ? rows.slice(1) : rows;

      // Build segments
      const segments = [];
      let currentSeg = null;

      for (const row of dataRows) {
        const segName  = String(row[0] || '').trim();
        const title    = String(row[1] || '').trim();
        const content  = String(row[2] || '').trim();
        const shooting = String(row[3] || '').trim();
        const editMusic= String(row[4] || '').trim();
        const filename = String(row[5] || '').trim();
        const filename2= String(row[6] || '').trim();
        const filename3= String(row[7] || '').trim();
        const filename4= String(row[8] || '').trim();

        // Skip completely empty rows
        if (!segName && !title && !content && !shooting && !editMusic && !filename) continue;

        // New segment if segName given
        if (segName) {
          currentSeg = { id: uid(), title: segName, collapsed: false, shots: [] };
          segments.push(currentSeg);
        }

        // If no segment yet, create a default one
        if (!currentSeg) {
          currentSeg = { id: uid(), title: 'المشاهد', collapsed: false, shots: [] };
          segments.push(currentSeg);
        }

        // Add shot (only if there's any content)
        if (title || content || shooting || editMusic || filename) {
          const localTotal = segments.reduce((n,s)=>n+s.shots.length,0);
          currentSeg.shots.push({
            id: uid(),
            title:     title || ('مشهد ' + (localTotal + 1)),
            done:      false,
            content,
            contentRich: '',
            shooting,
            editMusic,
            filename,
            filename2,
            filename3,
            filename4,
            timecodeNotes: [],
            tcOpen: false,
            collapsed: false,
          });
        }
      }

      if (segments.length === 0 || segments.every(s => s.shots.length === 0)) {
        _showToast('لم يُعثر على أي بيانات صالحة في الملف. تأكد من أن الأعمدة بالترتيب الصحيح.', 'error'); return;
      }

      // Count total shots
      const totalShots = segments.reduce((n, s) => n + s.shots.length, 0);
      const projectName = file.name.replace(/\.[^.]+$/, '');

      const p = {
        id: uid(),
        name: projectName,
        date: today(),
        location: '',
        notes: '',
        fps: 25,
        segments,
        folderId: null,
        lastModified: Date.now(),
      };

      try {
        await saveProject(p);
        _showToast(`✓ تم استيراد ${segments.length} مقطع و${totalShots} مشهد`, 'success', 3500);
      } catch(saveErr) {
        _showToast('استُورد محلياً لكن تعذّر رفعه للسحابة — تحقق من الاتصال', 'error', 4000);
      }
      await renderHome();
      openProject(p.id);

    } catch(err) {
      _showToast('خطأ في قراءة الملف: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function handleImport(ev) {
  const file=ev.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=async e=>{
    let p=null;
    try{ p=JSON.parse(e.target.result); }catch{}
    if(!p||(!p.shots&&!p.segments)){ _showToast('ملف غير صالح', 'error'); return; }
    if(!p.id) p.id=uid(); p.lastModified=Date.now();
    // Migrate old flat shots to segments
    if(!p.segments && p.shots) {
      p.segments=[{id:uid(),title:'المشاهد',collapsed:false,shots:p.shots}];
      delete p.shots;
    }
    if(!p.segments) p.segments=[];
    try {
      await saveProject(p);
      _showToast('تم الاستيراد بنجاح: ' + (p.name || 'مشروع'), 'success', 2500);
    } catch(e) {
      _showToast('استُورد محلياً لكن تعذّر رفعه للسحابة — تحقق من الاتصال', 'error', 4000);
    }
    renderHome();
  };
  r.readAsText(file); ev.target.value='';
}

// ══════════════════════════════════════════
//  Shot Fullscreen
// ══════════════════════════════════════════
let sfShotId = null;


// ── Segment Fullscreen ──────────────────────────────────────────
let _segfId = null;

function openSegFull(segId) {
  const seg = (cur.segments||[]).find(s => s.id === segId);
  if (!seg) return;
  _segfId = segId;
  document.getElementById('segfOverlay').style.display = 'flex';
  document.getElementById('segfTitle').value = seg.title || '';
  document.getElementById('segfFaceInput').value = seg.face || '';
  _renderSegFull();
}

function closeSegFull() {
  document.getElementById('segfOverlay').style.display = 'none';
  _segfId = null;
  renderShots();
}

function segfSetTitle(val) {
  const seg = (cur.segments||[]).find(s => s.id === _segfId);
  if (seg) { seg.title = val; autoSave(); }
}

function _renderSegFull() {
  const seg = (cur.segments||[]).find(s => s.id === _segfId);
  if (!seg) return;
  const shots = seg.shots || [];
  const total = shots.length, done = shots.filter(s => s.done).length;
  const pct = total ? done/total : 0;

  document.getElementById('segfStats').textContent = total === 0 ? 'لا مشاهد' : `${done}/${total} تم`;
  document.getElementById('segfFill').style.transform = 'scaleX(' + pct + ')';

  // Calc global index offset
  let globalOffset = 1;
  for (const s of (cur.segments||[])) {
    if (s.id === _segfId) break;
    globalOffset += (s.shots||[]).length;
  }

  const body = document.getElementById('segfBody');
  body.innerHTML = shots.map((s, i) => {
    const gIdx = globalOffset + i;
    return `
    <div class="segf-shot-card ${s.done?'done':''}" id="segfc-${s.id}">
      <div class="segf-shot-head">
        <div class="segf-shot-num">${gIdx}</div>
        <input type="text" class="segf-shot-title ${s.done?'done-text':''}"
          value="${esc(s.title)}" placeholder="عنوان المشهد"
          oninput="segfSetField('${s.id}','title',this.value)">
        <span class="segf-done-tag" style="display:${s.done?'inline':'none'}">تم ✓</span>
        <input type="checkbox" class="segf-done-cb" ${s.done?'checked':''}
          onchange="segfToggleDone('${s.id}',this.checked)">
      </div>
      <div class="segf-fields">
        <div class="segf-field full">
          <label>المحتوى</label>
          <textarea placeholder="وصف المشهد..." oninput="segfSetField('${s.id}','content',this.value)">${esc(s.content||'')}</textarea>
        </div>
        <div class="segf-field">
          <label>التصوير</label>
          <textarea placeholder="الزاوية، الحركة، العدسة..." oninput="segfSetField('${s.id}','shooting',this.value)">${esc(s.shooting||'')}</textarea>
        </div>
        <div class="segf-field">
          <label>المونتاج</label>
          <textarea placeholder="المونتاج، الموسيقى..." oninput="segfSetField('${s.id}','editMusic',this.value)">${esc(s.editMusic||'')}</textarea>
        </div>
        <div class="segf-field">
          <label>الوجه</label>
          <input type="text" placeholder="اسم الشخص..." oninput="segfSetField('${s.id}','face',this.value)" value="${esc(s.face||'')}">
        </div>
        <div class="segf-field full">
          <label>اسم الملف</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="text" style="flex:1;min-width:80px" placeholder="الكاميرا A" inputmode="numeric"
              oninput="fmtFilename(this,'${s.id}','filename','A')" onchange="autoSave()" value="${esc(s.filename||'')}">
            <input type="text" style="flex:1;min-width:80px" placeholder="الكاميرا B (اختياري)" inputmode="numeric"
              oninput="fmtFilename(this,'${s.id}','filename2','B')" onchange="autoSave()" value="${esc(s.filename2||'')}">
            <input type="text" style="flex:1;min-width:80px" placeholder="الكاميرا C (اختياري)" inputmode="numeric"
              oninput="fmtFilename(this,'${s.id}','filename3','C')" onchange="autoSave()" value="${esc(s.filename3||'')}">
            <input type="text" style="flex:1;min-width:80px" placeholder="الكاميرا D (اختياري)" inputmode="numeric"
              oninput="fmtFilename(this,'${s.id}','filename4','D')" onchange="autoSave()" value="${esc(s.filename4||'')}">
          </div>
        </div>
      </div>
    </div>`;
  }).join('') + `
  <div class="segf-add-shot" onclick="segfAddShot()">+ إضافة مشهد جديد</div>`;
}

function segfSetField(shotId, field, val) {
  const seg = (cur.segments||[]).find(s => s.id === _segfId);
  const shot = seg?.shots?.find(s => s.id === shotId);
  if (shot) { shot[field] = val; autoSave(); }
}

function segfToggleDone(shotId, checked) {
  const seg = (cur.segments||[]).find(s => s.id === _segfId);
  const shot = seg?.shots?.find(s => s.id === shotId);
  if (!shot) return;
  shot.done = checked;
  autoSave();
  // Update card style
  const card = document.getElementById('segfc-' + shotId);
  if (card) {
    card.classList.toggle('done', checked);
    const tag = card.querySelector('.segf-done-tag');
    if (tag) tag.style.display = checked ? 'inline' : 'none';
    const title = card.querySelector('.segf-shot-title');
    if (title) title.classList.toggle('done-text', checked);
  }
  // Update stats
  const shots = (cur.segments||[]).find(s => s.id === _segfId)?.shots || [];
  const total = shots.length, done = shots.filter(s => s.done).length;
  const pct = total ? done/total : 0;
  document.getElementById('segfStats').textContent = `${done}/${total} تم`;
  document.getElementById('segfFill').style.transform = 'scaleX(' + pct + ')';
}

function segfAddShot() {
  const seg = (cur.segments||[]).find(s => s.id === _segfId);
  if (!seg) return;
  const shot = {id:uid(),title:'',content:'',shooting:'',editMusic:'',face:'',filename:'',filename2:'',filename3:'',filename4:'',done:false,notes:[]};
  seg.shots.push(shot);
  autoSave();
  _renderSegFull();
  // Scroll to bottom
  setTimeout(() => {
    const body = document.getElementById('segfBody');
    body.scrollTop = body.scrollHeight;
  }, 50);
}

function openFirstShotFull() {
  const shots = _allShots();
  if (shots.length > 0) openShotFull(shots[0].id);
}

function openShotFull(id) {
  const s = _findShot(id);
  if (!s) return;
  sfShotId = id;
  const idx = _globalShotIndex(id);

  document.getElementById('sfNum').textContent = idx;
  document.getElementById('sfTitleInput').value = s.title || '';
  document.getElementById('sfContent').value = s.content || '';
  document.getElementById('sfShooting').value = s.shooting || '';
  document.getElementById('sfEditMusic').value = s.editMusic || '';
  document.getElementById('sfFilename').value = s.filename || '';
  document.getElementById('sfFilename2').value = s.filename2 || '';
  document.getElementById('sfFilename3').value = s.filename3 || '';
  document.getElementById('sfFilename4').value = s.filename4 || '';
  document.getElementById('sfFace').value = s.face || '';
  document.getElementById('sfDoneCb').checked = !!s.done;

  // sync timecode clock
  const t = timers[id];
  document.getElementById('sfTcClock').textContent =
    document.getElementById('tcd-'+id)?.textContent || '00:00:00:00';
  document.getElementById('sfTcStart').style.display = (t?.running) ? 'none' : '';
  document.getElementById('sfTcPause').style.display = (t?.running) ? '' : 'none';

  sfRenderNotes();
  sfRenderCustomPresets();
  document.getElementById('sfOverlay').style.display = 'flex';
  _sfUpdateNavBtns();

  // wire live sync back to shot
  const bind = (elId, field) => {
    const el = document.getElementById(elId);
    el.oninput = () => { setF(id, field, el.value); };
  };
  bind('sfTitleInput', 'title');
  bind('sfContent',    'content');
  bind('sfShooting',   'shooting');
  bind('sfEditMusic',  'editMusic');
  bind('sfFace',       'face');
  [['sfFilename','filename','A'],['sfFilename2','filename2','B'],['sfFilename3','filename3','C'],['sfFilename4','filename4','D']].forEach(([elId, field, cam]) => {
    const el = document.getElementById(elId);
    el.oninput = () => { fmtFilename(el, id, field, cam); autoSave(); };
  });
  document.getElementById('sfDoneCb').onchange = () => {
    const s = _findShot(sfShotId);
    if (s) { s.done = document.getElementById('sfDoneCb').checked; autoSave(); updateProgress(); renderShots(); }
  };
}

function closeShotFull() {
  autoSave();
  renderShots();
  document.getElementById('sfOverlay').style.display = 'none';
  sfShotId = null;
}

function sfNavigate(dir) {
  const all = _allShots();
  const idx = all.findIndex(s => s.id === sfShotId);
  if (idx === -1) return;
  const next = all[idx + dir];
  if (!next) return;
  autoSave();
  openShotFull(next.id);
}

function _sfUpdateNavBtns() {
  const all = _allShots();
  const idx = all.findIndex(s => s.id === sfShotId);
  const prev = document.getElementById('sfPrevBtn');
  const next = document.getElementById('sfNextBtn');
  if (prev) prev.disabled = idx <= 0;
  if (next) next.disabled = idx >= all.length - 1;
}

function sfRenderNotes() {
  const s = _findShot(sfShotId); if (!s) return;
  if (!s.timecodeNotes) s.timecodeNotes = [];
  document.getElementById('sfNotesList').innerHTML = s.timecodeNotes.map(n => `
    <div class="tc-note"><span class="tc-ts">${n.tc}</span><span class="tc-txt">${esc(n.text)}</span>
    <button class="tc-rm" onclick="sfDelNote('${n.id}')" aria-label="حذف الملاحظة">✕</button></div>`).join('');
}

function sfAddNotePreset(text) {
  const s = _findShot(sfShotId); if (!s) return;
  if (!s.timecodeNotes) s.timecodeNotes = [];
  s.timecodeNotes.push({id: uid(), tc: nowTC(sfShotId), text});
  sfRenderNotes(); renderNotes(sfShotId); autoSave();
}

function sfAddNote() {
  if (!sfShotId) return;
  const inp = document.getElementById('sfNoteInput');
  const txt = inp ? inp.value.trim() : '';
  const s = _findShot(sfShotId); if (!s) return;
  if (!s.timecodeNotes) s.timecodeNotes = [];
  s.timecodeNotes.push({id: uid(), tc: nowTC(sfShotId), text: txt || '—'});
  if (inp) inp.value = '';
  sfRenderNotes(); renderNotes(sfShotId); autoSave();
}

function sfDelNote(nid) {
  const s = _findShot(sfShotId); if (!s) return;
  if (!s.timecodeNotes) s.timecodeNotes = [];
  s.timecodeNotes = s.timecodeNotes.filter(n => n.id !== nid);
  sfRenderNotes(); renderNotes(sfShotId); autoSave();
}

// ── Custom preset buttons ──
const PRESETS_KEY = 'sm_note_presets';
function loadCustomPresets() { try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; } catch { return []; } }
function saveCustomPresets(list) { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); }

function sfRenderCustomPresets() {
  const container = document.getElementById('sfPresets');
  if (!container) return;
  // Remove old custom preset buttons
  container.querySelectorAll('.tc-preset-custom').forEach(el => el.remove());
  const addBtn = document.getElementById('sfAddPresetBtn');
  loadCustomPresets().forEach((text, idx) => {
    const wrap = document.createElement('span');
    wrap.style.position = 'relative';
    wrap.style.display = 'inline-flex';
    const btn = document.createElement('button');
    btn.className = 'tc-preset-btn tc-preset-custom';
    btn.textContent = text;
    btn.onclick = () => sfAddNotePreset(text);
    const del = document.createElement('button');
    del.className = 'tc-preset-del';
    del.title = 'حذف';
    del.textContent = '✕';
    del.onclick = (e) => { e.stopPropagation(); sfDeletePreset(idx); };
    wrap.appendChild(btn);
    wrap.appendChild(del);
    wrap.classList.add('tc-preset-custom');
    container.insertBefore(wrap, addBtn);
  });
}

function sfShowAddPreset() {
  const row = document.getElementById('sfPresetInputRow');
  if (row) { row.classList.add('visible'); document.getElementById('sfPresetInput').focus(); }
}
function sfHideAddPreset() {
  const row = document.getElementById('sfPresetInputRow');
  if (row) { row.classList.remove('visible'); document.getElementById('sfPresetInput').value = ''; }
}
function sfSavePreset() {
  const inp = document.getElementById('sfPresetInput');
  const txt = inp ? inp.value.trim() : '';
  if (!txt) return;
  const list = loadCustomPresets();
  list.push(txt);
  saveCustomPresets(list);
  sfHideAddPreset();
  sfRenderCustomPresets();
  listRenderAllCustomPresets();
}
function sfDeletePreset(idx) {
  const list = loadCustomPresets();
  list.splice(idx, 1);
  saveCustomPresets(list);
  sfRenderCustomPresets();
  listRenderAllCustomPresets();
}

// ── List-view custom preset buttons ──
function listRenderCustomPresets(shotId) {
  const container = document.getElementById('lp-' + shotId);
  if (!container) return;
  container.querySelectorAll('.tc-preset-custom').forEach(el => el.remove());
  const addBtn = document.getElementById('lpAddBtn-' + shotId);
  loadCustomPresets().forEach((text, idx) => {
    const wrap = document.createElement('span');
    wrap.style.position = 'relative';
    wrap.style.display = 'inline-flex';
    const btn = document.createElement('button');
    btn.className = 'tc-preset-btn tc-preset-custom';
    btn.textContent = text;
    btn.onclick = () => addNotePreset(shotId, text);
    const del = document.createElement('button');
    del.className = 'tc-preset-del';
    del.title = 'حذف';
    del.textContent = '✕';
    del.onclick = (e) => { e.stopPropagation(); listDeletePreset(idx); };
    wrap.appendChild(btn);
    wrap.appendChild(del);
    wrap.classList.add('tc-preset-custom');
    container.insertBefore(wrap, addBtn);
  });
}

function listRenderAllCustomPresets() {
  if (_viewMode !== 'expanded') return;
  _allShots().forEach(s => listRenderCustomPresets(s.id));
}

function listShowAddPreset(shotId) {
  const row = document.getElementById('lpRow-' + shotId);
  if (row) { row.classList.add('visible'); document.getElementById('lpInput-' + shotId).focus(); }
}

function listHideAddPreset(shotId) {
  const row = document.getElementById('lpRow-' + shotId);
  if (row) { row.classList.remove('visible'); document.getElementById('lpInput-' + shotId).value = ''; }
}

function listSavePreset(shotId) {
  const inp = document.getElementById('lpInput-' + shotId);
  const txt = inp ? inp.value.trim() : '';
  if (!txt) return;
  const list = loadCustomPresets();
  list.push(txt);
  saveCustomPresets(list);
  listHideAddPreset(shotId);
  listRenderAllCustomPresets();
  sfRenderCustomPresets();
}

function listDeletePreset(idx) {
  const list = loadCustomPresets();
  list.splice(idx, 1);
  saveCustomPresets(list);
  listRenderAllCustomPresets();
  sfRenderCustomPresets();
}

function sfStartTimer() {
  startTimer(sfShotId);
  document.getElementById('sfTcStart').style.display = 'none';
  document.getElementById('sfTcPause').style.display = '';
  sfSyncClock();
}

function sfPauseTimer() {
  pauseTimer(sfShotId);
  document.getElementById('sfTcStart').style.display = '';
  document.getElementById('sfTcPause').style.display = 'none';
}

function sfResetTimer() {
  resetTimer(sfShotId);
  document.getElementById('sfTcStart').style.display = '';
  document.getElementById('sfTcPause').style.display = 'none';
  document.getElementById('sfTcClock').textContent = '00:00:00:00';
}

function sfSyncClock() {
  if (!sfShotId || document.getElementById('sfOverlay').style.display === 'none') return;
  // Read directly from timers — works even if expanded card is collapsed/hidden
  document.getElementById('sfTcClock').textContent = nowTC(sfShotId);
  if (timers[sfShotId]?.running) requestAnimationFrame(sfSyncClock);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('sfOverlay').style.display !== 'none') closeShotFull();
});

// ══════════════════════════════════════════
//  FCP Export Modal
// ══════════════════════════════════════════
let fcpFileMap = {};
let fcpDurationMap = {}; // filename → duration in seconds (from actual media file)

function fcpSetSteps(active) {
  const steps = [
    document.getElementById('fcpStep1'),
    document.getElementById('fcpStep2'),
    document.getElementById('fcpStep3'),
  ];
  steps.forEach((el, i) => {
    if (!el) return;
    const done   = i + 1 < active;
    const current= i + 1 === active;
    el.style.background = done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--surface-2)';
    el.style.color = (done || current) ? '#fff' : 'var(--text-2)';
  });
}

function fcpOnFolderInput() {
  const has = document.getElementById('fcpFolderInput').value.trimStart().length > 0;
  document.getElementById('fcpScanBtn').disabled = !has;
  document.getElementById('fcpLaunchBtn').disabled = true;
  fcpSetSteps(has ? 1 : 0);
}

// Drag a folder from Finder onto the path input to extract its full path
function fcpDropFolder(e) {
  e.preventDefault();
  e.currentTarget.style.outline = '';
  // macOS Finder drag provides a file:// URI for the dropped item
  const uriList = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (uriList) {
    const uri = uriList.split('\n').map(s => s.trim()).find(s => s.startsWith('file://'));
    if (uri) {
      let path = decodeURIComponent(uri.replace(/^file:\/\//, ''));
      // If the dropped item is a file (last segment has an extension), use its parent directory
      const lastSeg = path.split('/').pop();
      if (lastSeg.includes('.')) path = path.slice(0, path.lastIndexOf('/'));
      fcpSetFolder(path);
      return;
    }
  }
  // Fallback: dragged files — use parent directory of first file
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    fcpHandleFilePick(files);
  }
}

// Open Finder to pick video files directly (no absolute path needed — we match by filename)
function fcpPickFiles() {
  document.getElementById('fcpFilePickerInput').click();
}

// Handle picked or dropped video files — match by filename against shots
function _fcpProbeDuration(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    v.src = url;
  });
}

async function fcpHandleFilePick(files) {
  const st = document.getElementById('fcpStatus');
  const videoFiles = Array.from(files).filter(f => /\.(mp4|mov|mxf|mts|m2ts|avi|mkv)$/i.test(f.name));
  if (!videoFiles.length) {
    st.className = 'fcp-status err';
    st.textContent = '⚠️ لم يُعثر على ملفات فيديو في الاختيار.';
    return;
  }

  const shotFilenames = _allShots().flatMap(s => [s.filename, s.filename2, s.filename3, s.filename4]).filter(Boolean)
    .map(f => f.includes('.') ? f : f + '.mp4');

  const newMap = {};
  const newDurMap = {};
  let folder = document.getElementById('fcpFolderInput').value.trimStart().replace(/^['"]|['"]$/, '');

  for (const fname of shotFilenames) {
    const match = videoFiles.find(f => f.name.toLowerCase() === fname.toLowerCase());
    if (match) {
      // Build absolute path if folder is set, otherwise store blob URL as fallback
      newMap[fname] = folder ? folder.replace(/\/+$/, '') + '/' + match.name
                             : URL.createObjectURL(match);
      // Probe actual media duration
      const dur = await _fcpProbeDuration(match);
      if (dur && isFinite(dur) && dur > 0) newDurMap[fname] = dur;
    }
  }

  fcpFileMap = newMap;
  fcpDurationMap = newDurMap;
  const matched = Object.keys(newMap).length;
  const total   = shotFilenames.length;

  if (matched === 0) {
    st.className = 'fcp-status err';
    st.textContent = `⚠️ لا تتطابق أسماء الملفات المختارة مع أسماء المشاهد.\n\nالمطلوب:\n` +
      shotFilenames.map(f => '  • ' + f).join('\n');
    fcpSetSteps(2);
    return;
  }

  // If no folder path is known, try to auto-detect it via the local server.
  // webkitRelativePath gives "FolderName/filename.mp4" when a directory is picked,
  // so we extract the folder name and probe common locations on disk.
  if (!folder) {
    const firstWithRel = videoFiles.find(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    if (firstWithRel) {
      const folderName = firstWithRel.webkitRelativePath.split('/')[0];
      const matchedNames = Object.keys(newMap);
      const basePaths = ['~/Movies', '~/Desktop', '~/Downloads', '~/Documents'];
      for (const base of basePaths) {
        const testFolder = base + '/' + folderName;
        try {
          const res = await fetch('https://localhost:8080/find-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: testFolder, filenames: matchedNames })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.matched > 0 && data.found) {
              folder = testFolder;
              document.getElementById('fcpFolderInput').value = testFolder;
              localStorage.setItem('fcpLastFolder', testFolder);
              Object.assign(fcpFileMap, data.found);
              break;
            }
          }
        } catch (e) { break; } // Server not running — stop trying
      }
    }
  }

  st.className = 'fcp-status ok';
  st.textContent = `✅ تم مطابقة ${matched} من ${total} ملف\n\n` +
    Object.entries(newMap).map(([k]) => '  • ' + k).join('\n') +
    (!folder ? '\n\n⚠️ لم يُحدَّد مسار المجلد — الصق المسار لتفعيل "فتح في FCP"' : '');
  document.getElementById('fcpLaunchBtn').disabled = !folder;
  fcpSetSteps(folder ? 3 : 2);
}

function exportFCP() {
  autoSave();
  fcpFileMap = {};
  fcpDurationMap = {};
  document.getElementById('fcpFolderInput').value = '';
  const st = document.getElementById('fcpStatus');
  st.className = 'fcp-status';
  st.textContent = 'اختر مجلد الفيديو أو اسحبه من Finder.';
  document.getElementById('fcpOverlay').style.display = 'flex';
}

function closeFcpModal() {
  document.getElementById('fcpOverlay').style.display = 'none';
}

async function fcpBrowseFolder() {
  const st = document.getElementById('fcpStatus');
  try {
    const res = await fetch('https://localhost:8080/pick-folder', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}'
    });
    const data = await res.json();
    if (data.path) {
      document.getElementById('fcpFolderInput').value = data.path;
      fcpScanFolder();
    }
  } catch(e) {
    // localhost not running — guide user to paste the path or use quick buttons
    st.className = 'fcp-status';
    st.textContent = '📂 الصق مسار مجلد الفيديو في الحقل أعلاه،\nأو اختر أحد المسارات السريعة.';
  }
}

function fcpSetFolder(path) {
  document.getElementById('fcpFolderInput').value = path;
  document.getElementById('fcpScanBtn').disabled = false;
  document.getElementById('fcpLaunchBtn').disabled = true;
  fcpSetSteps(1);
  fcpScanFolder();
}

async function fcpScanFolder() {
  const folder = document.getElementById('fcpFolderInput').value.trimStart().replace(/^['"]|['"]$/, '');
  if (!folder) return;
  localStorage.setItem('fcpLastFolder', folder);

  const st = document.getElementById('fcpStatus');
  st.className = 'fcp-status';
  st.textContent = '🔍 جاري البحث عن الملفات…';
  document.getElementById('fcpScanBtn').disabled = true;
  document.getElementById('fcpScanBtn').textContent = '⏳ جاري البحث…';
  document.getElementById('fcpLaunchBtn').disabled = true;
  fcpSetSteps(2);

  const filenames = _allShots().flatMap(s => [s.filename, s.filename2, s.filename3, s.filename4]).filter(Boolean)
    .map(f => f.includes('.') ? f : f + '.mp4');
  if (!filenames.length) {
    st.className = 'fcp-status err';
    st.textContent = '⚠️ لا توجد أسماء ملفات في أي مشهد.\nأضف اسم الملف لكل مشهد أولاً.';
    document.getElementById('fcpScanBtn').disabled = false;
    document.getElementById('fcpScanBtn').textContent = '🔍 بحث عن الملفات في المجلد';
    fcpSetSteps(1);
    return;
  }

  try {
    const res = await fetch('https://localhost:8080/find-media', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ folder, filenames })
    });
    if (!res.ok) throw new Error('خطأ في الاتصال بالخادم');
    const data = await res.json();
    fcpFileMap = data.found || {};

    const total    = filenames.length;
    const matched  = data.matched || 0;
    const unmatched = filenames.filter(f => !fcpFileMap[f]);

    let msg = matched === total
      ? `✅ تم العثور على جميع الملفات (${matched}/${total})`
      : `⚠️ تم العثور على ${matched} من ${total} ملف`;
    if (unmatched.length)
      msg += `\n\n❌ لم يُعثر على:\n` + unmatched.map(f => '  • ' + f).join('\n');
    if (matched > 0)
      msg += `\n\n✅ ملفات مرتبطة:\n` + Object.entries(fcpFileMap).map(([k])=>`  • ${k}`).join('\n');

    st.className = 'fcp-status' + (matched === total ? ' ok' : '');
    st.textContent = msg;
    document.getElementById('fcpScanBtn').disabled = false;
    document.getElementById('fcpScanBtn').textContent = '🔍 بحث مجدداً';

    if (matched > 0) {
      document.getElementById('fcpLaunchBtn').disabled = false;
      fcpSetSteps(3);
    } else {
      fcpSetSteps(2);
    }
  } catch(e) {
    // localhost not available — show guidance and enable "فتح عبر التطبيق" directly
    st.className = 'fcp-status';
    st.textContent = '💡 لا يمكن البحث عن الملفات بدون server.py.\n\nاستخدم زر "فتح عبر التطبيق" مباشرةً — سيقوم التطبيق بالبحث والربط تلقائياً.';
    document.getElementById('fcpScanBtn').disabled = false;
    document.getElementById('fcpScanBtn').textContent = '🔍 بحث مجدداً';
    // Enable the launch buttons so user can proceed directly
    document.getElementById('fcpLaunchBtn').disabled = false;
    document.getElementById('fcpAppBtn') && (document.getElementById('fcpAppBtn').disabled = false);
    fcpSetSteps(3);
  }
}

// Called by the native app after it scans the folder.
// map: { "A0001.mp4": "/absolute/path/A0001.mp4", ... }
function fcpFoundFiles(map) {
  fcpFileMap = map || {};
  const st = document.getElementById('fcpStatus');
  const matched = Object.keys(fcpFileMap).length;
  if (matched > 0) {
    st.className = 'fcp-status ok';
    st.textContent = `✅ تم العثور على ${matched} ملف\n\n` +
      Object.entries(fcpFileMap).map(([k]) => '  • ' + k).join('\n');
    document.getElementById('fcpLaunchBtn').disabled = false;
    fcpSetSteps(3);
  } else {
    st.className = 'fcp-status err';
    st.textContent = '⚠️ لم يُعثر على ملفات مطابقة في المجلد.';
    fcpSetSteps(2);
  }
}

// ── Client-side FCPXML builder ─────────────────────────────

function _fcpXe(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function _fcpShotDurFrames(s, fps) {
  let maxFr = 0;
  for (const n of (s.timecodeNotes || [])) {
    const p = (n.tc || '').split(':');
    if (p.length === 4) {
      try {
        const fr = +p[0]*3600*fps + +p[1]*60*fps + +p[2]*fps + +p[3];
        if (fr > maxFr) maxFr = fr;
      } catch(e) {}
    }
  }
  const defaultSec = parseInt(document.getElementById('fcpDefaultDur')?.value || '60', 10) || 60;
  if (maxFr > 0) {
    // عنده ملاحظات زمنية — استخدم آخر توقيت + 5 ثواني
    return maxFr + fps * 5;
  }
  // لا توجد ملاحظات — استخدم المدة الافتراضية
  return fps * defaultSec;
}

function _fcpBuildMarkers(s, fps, fN, fD) {
  const fd = `${fN}/${fD}s`;
  const mkrs = [];
  if (s.content) {
    mkrs.push(`            <marker start="0s" duration="${fd}" value="${_fcpXe(s.content.slice(0,200))}" completed="0"/>`);
  }
  for (const n of (s.timecodeNotes || [])) {
    const p = (n.tc || '').split(':');
    if (p.length === 4) {
      try {
        const nfr = +p[0]*3600*fps + +p[1]*60*fps + +p[2]*fps + +p[3];
        mkrs.push(`            <marker start="${nfr*fN}/${fD}s" duration="${fd}" value="${_fcpXe(n.text||'')}" completed="0"/>`);
      } catch(e) {}
    }
  }
  return mkrs.join('\n');
}

function _fcpPathToUri(fpath) {
  // fpath is an absolute POSIX path from server, or just a filename
  if (!fpath) return '';
  if (fpath.startsWith('/')) {
    const parts = fpath.split('/');
    return 'file://' + parts.map(p => encodeURIComponent(p)).join('/');
  }
  return 'file:///' + encodeURIComponent(fpath);
}

const _FCP_EFFECT_RESOURCES = [
  '    <effect id="fx1" name="Hue/Saturation Curves" uid="FxPlug:23723AD7-62C4-4ED0-A8C6-FA5A2D7162E4"/>',
  '    <effect id="fx2" name="Color Adjustments" uid="FxPlug:7E2022A5-202B-4EEB-A311-AC2B585D01B0"/>',
  '    <effect id="fx3" name="Color Correction" uid="FFColorCorrectionHDREffect"/>',
  '    <effect id="fx4" name="Color Wheels" uid="FxPlug:52A68C6D-B49C-41AA-B3EA-03945D0C8EB4"/>',
  '    <effect id="fx5" name="Custom LUT" uid="FxPlug:14B39AEF-607D-42DF-98DD-DB3DD345E925"/>',
  '    <effect id="fx6" name="Limiter" uid="Limiter.Levels.audio.effectBundle"/>',
].join('\n');

const _FCP_PRESET_VIDEO_FILTERS =
  '            <filter-video ref="fx1" name="Hue/Saturation Curves">\n' +
  '                <data key="effectConfig">YnBsaXN0MDDUAQIDBAUGBwpYJHZlcnNpb25ZJGFyY2hpdmVyVCR0b3BYJG9iamVjdHMSAAGGoF8QD05TS2V5ZWRBcmNoaXZlctEICVRyb290gAGlCwwVFhdVJG51bGzTDQ4PEBIUV05TLmtleXNaTlMub2JqZWN0c1YkY2xhc3OhEYACoROAA4AEXXBsdWdpblZlcnNpb24QCNIYGRobWiRjbGFzc25hbWVYJGNsYXNzZXNfEBNOU011dGFibGVEaWN0aW9uYXJ5oxocHVxOU0RpY3Rpb25hcnlYTlNPYmplY3QIERokKTI3SUxRU1lfZm55gIKEhoiKmJqfqrPJzdoAAAAAAAABAQAAAAAAAAAeAAAAAAAAAAAAAAAAAAAA4w==</data>\n' +
  '                <param name="Hue vs. Hue" key="1" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9Ikh1ZSB2cy4gSHVlIiBpZD0iMSIgZmxhZ3M9IjQyOTkxNjE2MTYiPgoJPGZsYWdzPjQyOTkxNjE2MTY8L2ZsYWdzPgoJPG51bWJlck9mS2V5cG9pbnRzPjA8L251bWJlck9mS2V5cG9pbnRzPgoJPGRlZmF1bHRWYWw+KioqKioqKioqSHNlTWItZ09MQm9BMTFJKkU2MS0qSTQta2RNNzVOWlFiQmRQcXRONzQzbU1xVmRSYUptSjBGb1ByLU03NHhXT2FKWFI1QUcqKjQ0YzN3RTFvdEhHcUp0TktGLVFhQmNPTE5aUWgyNjBKNllBNiotZEVnQTJGSVFKR0ZpUktsZ29Vb0MxbC1LUTR4ZFBiRm5KV0ZYUDQzblFzKjBVKkhHMlVzSDMzZENJbXRqTWFkWk1yRm5jNioxb1ZNTDQtWk83NEJnTUxCblBhM2hOSlVZTXFsVlFyQlpRcHRDSW9wcFI0M1dQNEotUWI3VlNPQU00VmhMSFpCLVFiN1ZTSlZDSW94V09hSlhSQjZLM2xvU0xsKktJMjMzRzVKWkVySm1SYUoxTzQzaVBhSmdGNDNvTU82VDRwd0UzWi0tRklWcE5JQnBRYk5aRXFWVlBhdFpQMkZWUjQyNjJGY1k4SDZyR0lsRElKUlJNYVprUWJGdFY2SzVYN1NVZnZDdmxBYld0RSoqKioqKioqMi0qKioqKioqKiowKioqKioqKioqKioqKioqKioqKioxeTwvZGVmYXVsdFZhbD4KCTxkYXRhVmFsdWU+KioqKioqKioqSHNlTWItZ09MQm9BMTFJKkU2MS0qSTQta2RNNzVOWlFiQmRQcXRONzQzbU1xVmRSYUptSjBGb1ByLU03NHhXT2FKWFI1QUcqKjQ0YzN3RTFvdEhHcUp0TktGLVFhQmNPTE5aUWgyNjBKNllBNiotZEVnQTJGSVFKR0ZpUktsZ29Vb0MxbC1LUSR4ZFBiRm5KV0ZYUDQzblFzKjBVKkhHMlVzSDMzZENJbXRqTWFkWk1yRm5jNioxb1ZNTDQtWk83NEJnTUxCblBhM2hOSlVZTXFsVlFyQlpRcHRDSW9wcFI0M1dQNEotUWI3VlNPQU00VmhMSFpCLVFiN1ZTSlZDSW94V09hSlhSQjZLM2xvU0xsKktJMjMzRzVKWkVySm1SYUoxTzQzaVBhSmdGNDNvTU82VDRwd0UzWi0tRklWcE5JQnBRYk5aRXFWVlBhdFpQMkZWUjQyNjJGY1k4SDZyR0lsRElKUlJNYVprUWJGdFY2SzVYN1NVZnZDdmxBYld0RSoqKioqKioqMi0qKioqKioqKiowKioqKioqKioqKioqKioqKioqKioxeTwvZGF0YVZhbHVlPgo8L3BhcmFtZXRlcj4KCjwvb3ptbD4K"/>\n' +
  '                <param name="Hue vs. Saturation" key="2" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9Ikh1ZSB2cy4gU2F0dXJhdGlvbiIgaWQ9IjIiIGZsYWdzPSI0Mjk5MTYxNjE2Ij4KCTxmbGFncz40Mjk5MTYxNjE2PC9mbGFncz4KCTxudW1iZXJPZktleXBvaW50cz4wPC9udW1iZXJPZktleXBvaW50cz4KCTxkZWZhdWx0VmFsPioqKioqKioqKkhzZU1iLWdPTEJvQTExSSpFNjEtKkk0LWtkTTc1TlpRYkJkUHF0Tjc0M21NcVZkUmFKbUowRm9Qci1NNzR4V09hSlhSNUFHKio0NGMzd0Uxb3RIR3FKdE5LRi1RYUJjT0xOWlFoMjYwSjZZQTYqLWRFZ0EyRklRSkdGaVJLbGdvVW9DMWwtS1E0eGRQYkZuSldGWFA0M25RcyowVSpIRzJVc0gzM2RDSW10ak1hZFpNckZuYzYqMW9WTUw0LVpPNzRCZ01MQm5QYTNoTkpVWU1xbFZRckJaUXB0Q0lvcHBSNDNXUDRKLVFiN1ZTT0FNNFZoTEhaQi1RYjdWU0pWQ0lveFdPYUpYUkI2SzNsb1NMbCpLSTIzM0c1SlpFckptUmFKMU80M2lQYUpnRjQzb01PNlQ0cHdFM1otLUZJVnBOSUJwUWJOWkVxVlZQYXRaUDJGVlI0MjYyRmNZOEg2ckdJbERJSlJSTWFaa1FiRnRWNks1WDdTVWZ2Q3ZsQWJXdEUqKioqKioqKjItKioqKioqKioqMCoqKioqKioqKioqKioqKioqKioqMXk8L2RlZmF1bHRWYWw+Cgk8ZGF0YVZhbHVlPioqKioqKioqKkhzZU1iLWdPTEJvQTExSSpFNjEtKkk0LWtkTTc1TlpRYkJkUHF0Tjc0M21NcVZkUmFKbUowRm9Qci1NNzR4V09hSlhSNUFHKio0NGMzd0Uxb3RIR3FKdE5LRi1RYUJjT0xOWlFoMjYwSjZZQTYqLWRFZ0EyRklRSkdGaVJLbGdvVW9DMWwtS1E0eGRQYkZuSldGWFA0M25RcyowVSpIRzJVc0gzM2RDSW10ak1hZFpNckZuYzYqMW9WTUw0LVpPNzRCZ01MQm5QYTNoTkpVWU1xbFZRckJaUXB0Q0lvcHBSNDNXUDRKLVFiN1ZTT0FNNFZoTEhaQi1RYjdWU0pWQ0lveFdPYUpYUkI2SzNsb1NMbCpLSTIzM0c1SlpFckptUmFKMU80M2lQYUpnRjQzb01PNlQ0cHdFM1otLUZJVnBOSUJwUWJOWkVxVlZQYXRaUDJGVlI0MjYyRmNZOEg2ckdJbERJSlJSTWFaa1FiRnRWNks1WDdTVWZ2Q3ZsQWJXdEUqKioqKioqKjItKioqKioqKioqMCoqKioqKioqKioqKioqKioqKioqMXk8L2RhdGFWYWx1ZT4KPC9wYXJhbWV0ZXI+Cgo8L296bWw+Cg=="/>\n' +
  '                <param name="Hue vs. Luma" key="3" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9Ikh1ZSB2cy4gTHVtYSIgaWQ9IjMiIGZsYWdzPSI0Mjk5MTYxNjE2Ij4KCTxmbGFncz40Mjk5MTYxNjE2PC9mbGFncz4KCTxudW1iZXJPZktleXBvaW50cz4wPC9udW1iZXJPZktleXBvaW50cz4KCTxkZWZhdWx0VmFsPioqKioqKioqKkhzZU1iLWdPTEJvQTExSSpFNjEtKkk0LWtkTTc1TlpRYkJkUHF0Tjc0M21NcVZkUmFKbUowRm9Qci1NNzR4V09hSlhSNUFHKio0NGMzd0Uxb3RIR3FKdE5LRi1RYUJjT0xOWlFoMjYwSjZZQTYqLWRFZ0EyRklRSkdGaVJLbGdvVW9DMWwtS1E0eGRQYkZuSldGWFA0M25RcyowVSpIRzJVc0gzM2RDSW10ak1hZFpNckZuYzYqMW9WTUw0LVpPNzRCZ01MQm5QYTNoTkpVWU1xbFZRckJaUXB0Q0lvcHBSNDNXUDRKLVFiN1ZTT0FNNFZoTEhaQi1RYjdWU0pWQ0lveFdPYUpYUkI2SzNsb1NMbCpLSTIzM0c1SlpFckptUmFKMU80M2lQYUpnRjQzb01PNlQ0cHdFM1otLUZJVnBOSUJwUWJOWkVxVlZQYXRaUDJGVlI0MjYyRmNZOEg2ckdJbERJSlJSTWFaa1FiRnRWNks1WDdTVWZ2Q3ZsQWJXdEUqKioqKioqKjItKioqKioqKioqMCoqKioqKioqKioqKioqKioqKioqMXk8L2RlZmF1bHRWYWw+Cgk8ZGF0YVZhbHVlPioqKioqKioqKkhzZU1iLWdPTEJvQTExSSpFNjEtKkk0LWtkTTc1TlpRYkJkUHF0Tjc0M21NcVZkUmFKbUowRm9Qci1NNzR4V09hSlhSNUFHKio0NGMzd0Uxb3RIR3FKdE5LRi1RYUJjT0xOWlFoMjYwSjZZQTYqLWRFZ0EyRklRSkdGaVJLbGdvVW9DMWwtS1E0eGRQYkZuSldGWFA0M25RcyowVSpIRzJVc0gzM2RDSW10ak1hZFpNckZuYzYqMW9WTUw0LVpPNzRCZ01MQm5QYTNoTkpVWU1xbFZRckJaUXB0Q0lvcHBSNDNXUDRKLVFiN1ZTT0FNNFZoTEhaQi1RYjdWU0pWQ0lveFdPYUpYUkI2SzNsb1NMbCpLSTIzM0c1SlpFckptUmFKMU80M2lQYUpnRjQzb01PNlQ0cHdFM1otLUZJVnBOSUJwUWJOWkVxVlZQYXRaUDJGVlI0MjYyRmNZOEg2ckdJbERJSlJSTWFaa1FiRnRWNks1WDdTVWZ2Q3ZsQWJXdEUqKioqKioqKjItKioqKioqKioqMCoqKioqKioqKioqKioqKioqKioqMXk8L2RhdGFWYWx1ZT4KPC9wYXJhbWV0ZXI+Cgo8L296bWw+Cg=="/>\n' +
  '                <param name="Luma vs. Saturation" key="4" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9Ikx1bWEgdnMuIFNhdHVyYXRpb24iIGlkPSI0IiBmbGFncz0iNDI5OTE2MTYxNiI+Cgk8ZmxhZ3M+NDI5OTE2MTYxNjwvZmxhZ3M+Cgk8bnVtYmVyT2ZLZXlwb2ludHM+MDwvbnVtYmVyT2ZLZXlwb2ludHM+Cgk8ZGVmYXVsdFZhbD4qKioqKioqKipYa2VNYi1nT0xCb0ExMUkqRTYxLSpJNC1rZE03NU5aUWJCZFBxdE43NDNtTXFWZFJhSm1KMEZvUHItTTc0eFdPYUpYUjVBRyoqNDRjM3dFMW90SEdxSnROS0YtUWFCY09MTlpRaDI2MEo2WUE2Ki1lVWdBNC1zWTdHZ2k5bkJKNzR0cFA0bk0xRXNEMi0yRzJsRUozVk1MM1ZNSzNaTmtQcVppUjVCUE40SmFNTEpnUjI3Z1JLSkpOcjdaTkt0Szc0QmdNTEJuTDRGWk5hM3BQNUY1UWFKWlBaZFlOS05WUktsb0lhSllKNDdnUktKSFFhSllVKjZYRHoqKioqKioqKjAqMFI2TjItY1JLWXRIOWF4V09hSlhSNUNXNGxtKipzKjRVKlhINWwqVTZHNlhLb3RIOWItak9LdG9SYTNnS1l0SDliQmtOS0JkTUttKi02KjMyKjNLU24qZzYxLXhvV01iODBaTzc0QmdNTEJuUGEzaE5KVVlNcWxWUXJCWlFwUkNJcE5WUDVKWmNXVWVLMnRISHE3ZU5LQm9vbHdFNjBrVzZzKjVVKkpLU24yZzYxLXhvV01iQTEzU0haQkJSTEZWTWFsWkVMN21NTGFYQTE2ZUpvdEhFTDdtTUxiRzdXUW9CSndFNVotLUZJeGFOYkJaUjJCalA0eG1FckptUmFKMU80M2lQYUpnRjQzb01PNnE4WndFNVotLUZJeGFOYkJaUjJCalA0eG1FckptUmFKMU80M2lQYUpnRjQzb01FKjYqLTIqNFUqWSowWSpBVSpyKjJZKkgqLUQqMzIqTCotVyo1QSpTVTA0KjZrKllrMFUqOGcqZyowbyo5TSpqazEtKkFNKm9FMUkqQk0qcSoxTypDMip2RTFzKkRjKnoqMXkqRUktMFUySipGcy03VTJkKkg2LUNFMnYqSG8tRiozNypKVS1MKjNZKktZLVdVNEIqKioqKioqKipVMioqKioqKioqKkJrKioqKioqKioqKioqKioqKioqKk9zKjwvZGVmYXVsdFZhbD4KCTxkYXRhVmFsdWU+KioqKioqKioqWGtlTWItZ09MQm9BMTFJKkU2MS0qSTQta2RNNzVOWlFiQmRQcXRONzQzbU1xVmRSYUptSjBGb1ByLU03NHhXT2FKWFI1QUcqKjQ0YzN3RTFvdEhHcUp0TktGLVFhQmNPTE5aUWgyNjBKNllBNiotZVVnQTQtc1k3R2dpOW5CSjc0dHBQNG5NMUVzRDItMkcybEVKM1ZNTDNWTUszWk5rUHFaaVI1QlBONEphTUxKZ1IyN2dSS0pKTnI3Wk5LdEs3NEJnTUxCbkw0RlpOYTNwUDVGNVFhSlpQWmRZTktOVlJLbG9JYUpZSjQ3Z1JLSkhRYUpZVSo2WER6KioqKioqKiowKjBSNk4yLWNSS1l0SDlheFdPYUpYUjVDVzRsbSoqcyo0VSpYSDVsKlU2RzZYS290SDliLWpPS3RvUmEzZ0tZdEg5YkJrTktCZE1LbSotNiozMiozS1NuKmc2MS14b1dNYjgwWk83NEJnTUxCblBhM2hOSlVZTXFsVlFyQlpRcFJDSXBOVlA1SlpjV1VlSzJ0SEhxN2VOS0Jvb2x3RTYwa1c2cyo1VSpKS1NuMmc2MS14b1dNYkExM1NIWkJCUkxGVk1hbFpFTDdtTUxhWEExNmVKb3RIRUw3bU1MYkc3V1FvQkp3RTVaLS1GSXhhTmJCWlIyQmpQNHhtRXJKbVJhSjFPNDNpUGFKZ0Y0M29NTzZxOFp3RTVaLS1GSXhhTmJCWlIyQmpQNHhtRXJKbVJhSjFPNDNpUGFKZ0Y0M29NRSo2Ki0yKjRVKlkqMFkqQVUqcioyWSpIKi1EKjMyKkwqLVcqNUEqU1UwNCo2aypZazBVKjhnKmcqMG8qOU0qamsxLSpBTSpvRTFJKkJNKnEqMU8qQzIqdkUxcypEYyp6KjF5KkVJLTBVMkoqRnMtN1UyZCpINi1DRTJ2KkhvLUYqMzcqSlUtTCozWSpLWS1XVTRCKioqKioqKioqVTIqKioqKioqKipCayoqKioqKioqKioqKioqKioqKipPcyo8L2RhdGFWYWx1ZT4KPC9wYXJhbWV0ZXI+Cgo8L296bWw+Cg=="/>\n' +
  '                <param name="Saturation vs. Saturation" key="5" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9IlNhdHVyYXRpb24gdnMuIFNhdHVyYXRpb24iIGlkPSI1IiBmbGFncz0iNDI5OTE2MTYxNiI+Cgk8ZmxhZ3M+NDI5OTE2MTYxNjwvZmxhZ3M+Cgk8bnVtYmVyT2ZLZXlwb2ludHM+MDwvbnVtYmVyT2ZLZXlwb2ludHM+Cgk8ZGVmYXVsdFZhbD4qKioqKioqKipYa2VNYi1nT0xCb0ExMUkqRTYxLSpJNC1rZE03NU5aUWJCZFBxdE43NDNtTXFWZFJhSm1KMEZvUHItTTc0eFdPYUpYUjVBRyoqNDRjM3dFMW90SEdxSnROS0YtUWFCY09MTlpRaDI2MEo2WUE2Ki1lVWdBNC1zWTdHZ2k5bkJKNzR0cFA0bk0xRXNEMi0yRzJsRUozVk1MM1ZNSzNaTmtQcVppUjVCUE40SmFNTEpnUjI3Z1JLSkpOcjdaTkt0Szc0QmdNTEJuTDRGWk5hM3BQNUY1UWFKWlBaZFlOS05WUktsb0lhSllKNDdnUktKSFFhSllVKjZYRHoqKioqKioqKjAqMFI2TjItY1JLWXRIOWF4V09hSlhSNUNXNGxtKipzKjRVKlhINWwqVTZHNlhLb3RIOWItak9LdG9SYTNnS1l0SDliQmtOS0JkTUttKi02KjMyKjNLU24qZzYxLXhvV01iODBaTzc0QmdNTEJuUGEzaE5KVVlNcWxWUXJCWlFwUkNJcE5WUDVKWmNXVWVLMnRISHE3ZU5LQm9vbHdFNjBrVzZzKjVVKkpLU24yZzYxLXhvV01iQTEzU0haQkJSTEZWTWFsWkVMN21NTGFYQTE2ZUpvdEhFTDdtTUxiRzdXUW9CSndFNVotLUZJeGFOYkJaUjJCalA0eG1FckptUmFKMU84M2lQYUpnRjQzb01PNnE4WndFNVotLUZJeGFOYkJaUjJCalA0eG1FckptUmFKMU84M2lQYUpnRjQzb01FKjYqLTIqNFUqWSowWSpBVSpyKjJZKkgqLUQqMzIqTCotVyo1QSpTVTA0KjZrKllrMFUqOGcqZyowbyo5TSpqazEtKkFNKm9FMUkqQk0qcSoxTypDMip2RTFzKkRjKnoqMXkqRUktMFUySipGcy03VTJkKkg2LUNFMnYqSG8tRiozNypKVS1MKjNZKktZLVdVNEIqKioqKioqKipVMioqKioqKioqKkJrKioqKioqKioqKioqKioqKioqKk9zKjwvZGVmYXVsdFZhbD4KCTxkYXRhVmFsdWU+KioqKioqKioqWGtlTWItZ09MQm9BMTFJKkU2MS0qSTQta2RNNzVOWlFiQmRQcXRONzQzbU1xVmRSYUptSjBGb1ByLU03NHhXT2FKWFI1QUcqKjQ0YzN3RTFvdEhHcUp0TktGLVFhQmNPTE5aUWgyNjBKNllBNiotZVVnQTQtc1k3R2dpOW5CSjc0dHBQNG5NMUVzRDItMkcybEVKM1ZNTDNWTUszWk5rUHFaaVI1QlBONEphTUxKZ1IyN2dSS0pKTnI3Wk5LdEs3NEJnTUxCbkw0RlpOYTNwUDVGNVFhSlpQWmRZTktOVlJLbG9JYUpZSjQ3Z1JLSkhRYUpZVSo2WER6KioqKioqKiowKjBSNk4yLWNSS1l0SDlheFdPYUpYUjVDVzRsbSoqcyo0VSpYSDVsKlU2RzZYS290SDliLWpPS3RvUmEzZ0tZdEg5YkJrTktCZE1LbSotNiozMiozS1NuKmc2MS14b1dNYjgwWk83NEJnTUxCblBhM2hOSlVZTXFsVlFyQlpRcFJDSXBOVlA1SlpjV1VlSzJ0SEhxN2VOS0Jvb2x3RTYwa1c2cyo1VSpKS1NuMmc2MS14b1dNYkExM1NIWkJCUkxGVk1hbFpFTDdtTUxhWEExNmVKb3RIRUw3bU1MYkc3V1FvQkp3RTVaLS1GSXhhTmJCWlIyQmpQNHhtRXJKbVJhSjFPNDNpUGFKZ0Y0M29NTzZxOFp3RTVaLS1GSXhhTmJCWlIyQmpQNHhtRXJKbVJhSjFPNDNpUGFKZ0Y0M29NRSo2Ki0yKjRVKlkqMFkqQVUqcioyWSpIKi1EKjMyKkwqLVcqNUEqU1UwNCo2aypZazBVKjhnKmcqMG8qOU0qamsxLSpBTSpvRTFJKkJNKnEqMU8qQzIqdkUxcypEYyp6KjF5KkVJLTBVMkoqRnMtN1UyZCpINi1DRTJ2KkhvLUYqMzcqSlUtTCozWSpLWS1XVTRCKioqKioqKioqVTIqKioqKioqKipCayoqKioqKioqKioqKioqKioqKipPcyo8L2RhdGFWYWx1ZT4KPC9wYXJhbWV0ZXI+Cgo8L296bWw+Cg=="/>\n' +
  '                <param name="Custom vs. Saturation" key="6" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9IkN1c3RvbSB2cy4gU2F0dXJhdGlvbiIgaWQ9IjYiIGZsYWdzPSI0Mjk5MTYxNjE2Ij4KCTxmbGFncz40Mjk5MTYxNjE2PC9mbGFncz4KCTxudW1iZXJPZktleXBvaW50cz4wPC9udW1iZXJPZktleXBvaW50cz4KCTxkZWZhdWx0VmFsPioqKioqKioqKmJBZU1iLWdPTEJvQTExSSpFNjEtKkk0LWtkTTc1TlpRYkJkUHF0Tjc0M21NcVZkUmFKbUowRm9Qci1NNzR4V09hSlhSNUFHKio0NGMzd0Uxb3RIR3FKdE5LRi1RYUJjT0xOWlFoMjYwSjZZQTYqLWVVZ0E1R0FkOFgqbkIxVko3NHRwUDRuTTFFc0QyLTJHMmxFSjNWUU00RmNQNTNOa1BxWmlSNUJQTjRKYU1MSmdSMjdnUktKSk5yN1pOS3RLNzRCZ01MQm5MNEZaTmEzcFA1RjVRYUpaUFpkWU5LTlZSS2xvSWFKWUo0N2dSS0pIUWFKWVUqNlhEcS1XSFI5bGVUa1hEeEd3T2J2dHFtQyowR0F6cDlsZVRqYlA2bUF6dkd3T2J2dHFtR0F6TTQ3Qm9qNGR6MEF6dkd3T2J2dHFtUjZTMi13V0tZdEg5YXhXT2FKWFI1Q1c2MDQqKnMqNFUqWEg3LSpaN1dRY0tvdEg5Yi1qT0t0b1JhM2dLWXRIOWJCa05LQmRNS20qLTYqMzIqM0tTbipnNjEteG9XZ2c5R3RPNzRCZ01MQm5QYTNoTkpVWU1xbFZRckJaUXBSQ0lwTlZQNUpaY1dvaksydEhIcTdlTktCb29tRUU3SDJiODYqNVUqSktTbjJnNjEteG9XZ2dCSE5TSFpCQlJMRlZNYWxaRUw3bU1MYVhCSFFqSm90SEVMN21NTGJHOG1rdENad0U1Wi0tRkl4YU5iQlpSMkJqUDR4bUVySm1SYUoxTzQzaVBhSmdGNDNvTU82djlwd0U1Wi0tRkl4YU5iQlpSMkJqUDR4bUVySm1SYUoxTzQzaVBhSmdGNDNvTUUqNiotMio0VSpZKjBZKkFVKnIqMlkqSCotRCozMipMKi1XKjVBKlNVMDQqNmsqWWswVSo4ZypnKjBvKjlNKmprMTYqQWMqb2sxUSpDSSp2VTFuKkRzLSpFMjEqRUktLWsyQypGYy03RTJiKkdZLThrMm0qSFEtRVUzOSpKQS1KVTNUKktNLU8qM2UqTDItUlU0MypNWS1ZRTRLKlBRLWlVKioqKioqKio2LSoqKioqKioqKjFrKioqKioqKioqKioqKioqKioqKjVQPC9kZWZhdWx0VmFsPgoJPGRhdGFWYWx1ZT4qKioqKioqKipiQWVNYi1nT0xCb0ExMUkqRTYxLSpJNC1rZE03NU5aUWJCZFBxdE43NDNtTXFWZFJhSm1KMEZvUHItTTc0eFdPYUpYUjVBRyoqNDRjM3dFMW90SEdxSnROS0YtUWFCY09MTlpRaDI2MEo2WUE2Ki1lVWdBNUdBZDhYKm5CMVZKNzR0cFA0bk0xRXNEMi0yRzJsRUozVlFNNEZjUDUzTmtQcVppUjVCUE40SmFNTEpnUjI3Z1JLSkpOcjdaTkt0Szc0QmdNTEJuTDRGWk5hM3BQNUY1UWFKWlBaZFlOS05WUktsb0lhSllKNDdnUktKSFFhSllVKjZYRHEtV0hSOWxlVGtYRHhHd09idnRxbUMqMEdBenA5bGVUamJQNm1BenZHd09idnRxbUdBek00N0JvajRkejBBenZHd09idnRxbVI2UzItd1dLWXRIOWF4V09hSlhSNUNXNjA0KipzKjRVKlhINy0qWjdXUWNLb3RIOWItak9LdG9SYTNnS1l0SDliQmtOS0JkTUttKi02KjMyKjNLU24qZzYxLXhvV2dnOUd0Tzc0QmdNTEJuUGEzaE5KVVlNcWxWUXJCWlFwUkNJcE5WUDVKWmNXb2pLMnRISHE3ZU5LQm9vbUVFN0gyYjg2KjVVKkpLU24yZzYxLXhvV2dnQkhOU0haQkJSTEZWTWFsWkVMN21NTGFYQkhRakpvdEhFTDdtTUxiRzhta3RDWndFNVotLUZJeGFOYkJaUjJCalA0eG1FckptUmFKMU84M2lQYUpnRjQzb01PNnY5cHdFNVotLUZJeGFOYkJaUjJCalA0eG1FckptUmFKMU84M2lQYUpnRjQzb01FKjYqLTIqNFUqWSowWSpBVSpyKjJZKkgqLUQqMzIqTCotVyo1QSpTVTA0KjZrKllrMFUqOGcqZyowbyo5TSpqazE2KkFjKm9rMVEqQ0kqdlUxbipEcy0qRTIxKkVJLS1rMkMqRmMtN0UyYipHWS00azJtKkhRLUVVMzkqSkEtSlUzVCpLTS1PKjNlKkwyLVJVNDMqTVktWUU0SypQUS1pVSoqKioqKioqNi0qKioqKioqKioxayoqKioqKioqKioqKioqKioqKio1UDwvZGF0YVZhbHVlPgo8L3BhcmFtZXRlcj4KCjwvb3ptbD4K"/>\n' +
  '                <param name="Preserve Luma" key="8894" value="1"/>\n' +
  '                <param name="OSC" key="9321" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9Ik9TQyIgaWQ9IjkzMjEiIGZsYWdzPSI0Mjk5MjI3MTg0Ij4KCTxmbGFncz40Mjk5MjI3MTg0PC9mbGFncz4KCTxudW1iZXJPZktleXBvaW50cz4wPC9udW1iZXJPZktleXBvaW50cz4KCTxkZWZhdWx0VmFsPioqKioqKioqKkUqZU1iLWdPTEJvQTExSSpFNjEtKkk0LWtkTTc1TlpRYkJkUHF0Tjc0M21NcVZkUmFKbUowRm9Qci1NNzR4V09hSlhSNUFHKio0NGMzd0Uxb3RIR3FKdE5LRi1RYUJjT0xOWlFoMjYwSjZZQTYqLWNrZ0ExcElZUGJKZ1BCMkIxWk1ZTXFsVlFyQyoqaDZFMkY2SEtXRlhQNDNuUXF0VlBLSk03NEJnTUxCbk5MQlQyLWxFRUlKMVBxbGpRWkJaUDRKWFI0WmpQWUJjTUt0aU5LbDJNTEZWY1ZFSkxsKlFJMjMzRXF4Z1ByN0hOS2xaTXJGZFBxdDFPNDNpUGFKZ0Y0M29NSlZDSW94V09hSlhSKlVGNFdFZEFYUjdIMnhGSkpoU05LUmdSczBUY2cyKioqKioqKiotKkUqKioqKioqKipLKioqKioqKioqKioqKioqKioqKiptVSoqPC9kZWZhdWx0VmFsPgoJPGRhdGFWYWx1ZT4qKioqKioqKipFKmVNYi1nT0xCb0ExMUkqRTYxLSpJNC1rZE03NU5aUWJCZFBxdE43NDNtTXFWZFJhSm1KMEZvUHItTTc0eFdPYUpYUjVBRyoqNDRjM3dFMW90SEdxSnROS0YtUWFCY09MTlpRaDI2MEo2WUE2Ki1ja2dBMXBJWVBiSmdQQjJCMVpNWU1xbFZRckMqKmg2RTJGNkhLV0ZYUDQzblFxdFZQS0pNNzRCZ01MQm5OTEJUMi1sRUVJSjFQcWxqUVpCWlA0SlhSNFpqUFlCY01LdGlOS2wyTUxGVmNWRUpMbCpRSTIzM0VxeGdQcjdITktsWk1yRmRQcXQxTzQzaVBhSmdGNDNvTUpWQ0lveFdPYUpYUipVRjRXRWRBWFI3SDJ4RkpKaFNOS1JnUnMwVGNnMioqKioqKioqLSpFKioqKioqKioqSyoqKioqKioqKioqKioqKioqKioqbVUqKjwvZGF0YVZhbHVlPgo8L3BhcmFtZXRlcj4KCjwvb3ptbD4K"/>\n' +
  '            </filter-video>\n' +
  '            <filter-video ref="fx2" name="Color Adjustments">\n' +
  '                <data key="effectConfig">YnBsaXN0MDDUAQIDBAUGBwpYJHZlcnNpb25ZJGFyY2hpdmVyVCR0b3BYJG9iamVjdHMSAAGGoF8QD05TS2V5ZWRBcmNoaXZlctEICVRyb290gAGlCwwVFhdVJG51bGzTDQ4PEBIUV05TLmtleXNaTlMub2JqZWN0c1YkY2xhc3OhEYACoROAA4AEXXBsdWdpblZlcnNpb24QAtIYGRobWiRjbGFzc25hbWVYJGNsYXNzZXNfEBNOU011dGFibGVEaWN0aW9uYXJ5oxocHVxOU0RpY3Rpb25hcnlYTlNPYmplY3QIERokKTI3SUxRU1lfZm55gIKEhoiKmJqfqrPJzdoAAAAAAAABAQAAAAAAAAAeAAAAAAAAAAAAAAAAAAAA4w==</data>\n' +
  '                <param name="Control Range" key="19" value="1 (HLG)"/>\n' +
  '                <param name="" key="20" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjE0NTA0OTJkODU0NTQ5Mzk4YzA3M2MxOGM2NDRhYWUxIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9IiIgaWQ9IjIwIiBmbGFncz0iNDI5NTAzMjg0OCI+Cgk8ZmxhZ3M+NDI5NTAzMjg0ODwvZmxhZ3M+Cgk8bnVtYmVyT2ZLZXlwb2ludHM+MDwvbnVtYmVyT2ZLZXlwb2ludHM+Cgk8ZGVmYXVsdFZhbD4qKioqKioqKio2SWVNYi1nT0xCb0ExMUkqRTYxLSpJNC1rZE03NU5aUWJCZFBxdE43NDNtTXFWZFJhSm1KMEZvUHItTTc0eFdPYUpYUjVBRyoqNDRjM3dFMW90SEdxSnROS0YtUWFCY09MTlpRaDI2MEo2WUE2KipjRWhKNzR0cFA0azYyRmNZOEg2ckdJbERJSkEqKioqKioqKi0qRSoqKioqKioqKkEqKioqKioqKioqKioqKioqKioqKktFKio8L2RlZmF1bHRWYWw+Cgk8ZGF0YVZhbHVlPioqKioqKioqKjZJZU1iLWdPTEJvQTExSSpFNjEtKkk0LWtkTTc1TlpRYkJkUHF0Tjc0M21NcVZkUmFKbUowRm9Qci1NNzR4V09hSlhSNUFHKio0NGMzd0Uxb3RIR3FKdE5LRi1RYUJjT0xOWlFoMjYwSjZZQTYqKmNFaEo3NHRwUDRrNjJGY1k4SDZyR0lsRElKQSoqKioqKioqLSpFKioqKioqKioqQSoqKioqKioqKioqKioqKioqKioqS0UqKjwvZGF0YVZhbHVlPgo8L3BhcmFtZXRlcj4KCjwvb3ptbD4K"/>\n' +
  '                <param name="" key="23" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9IiIgaWQ9IjIzIiBmbGFncz0iNDI5OTIyNzE4NCI+Cgk8ZmxhZ3M+NDI5OTIyNzE4NDwvZmxhZ3M+Cgk8bnVtYmVyT2ZLZXlwb2ludHM+MDwvbnVtYmVyT2ZLZXlwb2ludHM+Cgk8ZGVmYXVsdFZhbD4qKioqKioqKipSMmVNYi1nT0xCb0ExMUkqRTYxLSpJNC1rZE03NU5aUWJCZFBxdE43NDNtTXFWZFJhSm1KMEZvUHItTTc0eFdPYUpYUjVBRyoqNDRjM3dFMW90SEdxSnROS0YtUWFCY09MTlpRaDI2MEo2WUE2Ki1ja2dBNUpJWVBiSmdQQnNCMVV3RTJGNkgzLUlLM2xVTjRWZ1A0bGdQNGxrUDRsZ1A0bGdQSzRCalBiRm1NTEJvTExCY01LRmpSckJMTUw3aFI0Vk9NYWxWTXFoRVBxWmlSM05yTUw3aFI0VklSNFppUjNsaE9LRm9QcXRaUXBGZFBiRks3NEJnTUxCbktyQmNNS0ZqUnJCSU9LdG9LYVZkTnFWZ09LUmNSNUJPUXEzb1JMN1ZSNFpqUFpkV1FhWmJPNUZpTkxCbks0SnNRNHhuUkw3WkxhcGRONUZqUGFKbkpxM21QTEZjSnJCY01LRmpSckFXR2xXS1U2KjBvVnNUNjAzTzc0QmdNTEJuUGEzaE5KVVlNcWxWUXJCWlFwd0U0My0tRklWMklZQmpQNHhtRXF4bVFhSlhSM05WUDVKWlF1Nlc2cHdFNDMtLUZJVjJJWUJqUDR4bUVxeG1RYUpYUjNOVlA1SlpRcFZDSW94V09hSlhSKio2Ki0yKjRVKlkqMFkqQVUqcioyWSpIKi1EKjMyKkpFLVAqNVUqVUUwRCo3YypjRTBhKjlBKmlVMTQqQjIqcioxYipEKip6azI1KkVrLTFVMkgqRnMtN2szMCpJSS1NKioqKioqKioqNi0qKioqKioqKiowRSoqKioqKioqKioqKioqKioqKiozZDwvZGVmYXVsdFZhbD4KCTxkYXRhVmFsdWU+KioqKioqKioqUjJlTWItZ09MQm9BMTFJKkU2MS0qSTQta2RNNzVOWlFiQmRQcXRONzQzbU1xVmRSYUptSjBGb1ByLU03NHhXT2FKWFI1QUcqKjQ0YzN3RTFvdEhHcUp0TktGLVFhQmNPTE5aUWgyNjBKNllBNiotY2tnQTVKSVlQYkpnUEJzQjFVd0UyRjZIMy1JSzNsVU40VmdQNGxnUDRsa1A0bGdQNGxnUEs0QmpQYkZtTUxCb0xMQmNNS0ZqUnJCTE1MN2hSNFZPTWFsVk1xaEVQcVppUjNOck1MN2hSNFZJUjRaaVIzbGhPS0ZvUHF0WlFwRmRQYkZLNzRCZ01MQm5LckJjTUtGalJyQklPS3RvS2FWZE5xVmdPS1JjUjVCT1FxM29STDdWUjRaalBaZFdRYVpiTzVGaU5MQm5LNEpzUTR4blJMN1pMYXBkTjVGalBhSm5KcTNtUExGY0pyQmNNS0ZqUnJBV0dsV0tVNiowb1ZzVDYwM083NEJnTUxCblBhM2hOSlVZTXFsVlFyQlpRcHdFNDMtLUZJVjJJWUJqUDR4bUVxeG1RYUpYUjNOVlA1SlpRdTZXNnB3RTQzLS1GSVYySVlCalA0eG1FcXhtUWFKWFIzTlZQNUpaUXBWQ0lveFdPYUpYUioqNiotMio0VSpZKjBZKkFVKnIqMlkqSCotRCozMipKRS1QKjVVKlVFMEQqN2MqY0UwYSo5QSppVTE0KkIyKnIqMWIqRCoqemsyNSpFay0xVTJIKkZzLTdrMzAqSUktTSoqKioqKioqKjYtKioqKioqKioqMEUqKioqKioqKioqKioqKioqKioqM2Q8L2RhdGFWYWx1ZT4KPC9wYXJhbWV0ZXI+Cgo8L296bWw+Cg=="/>\n' +
  '                <param name="trigger Enhance" key="18" value="6"/>\n' +
  '                <param name="Exposure" key="3" value="0"/>\n' +
  '                <param name="Contrast" key="17" value="0"/>\n' +
  '                <param name="Brightness" key="2" value="0"/>\n' +
  '                <param name="Highlights" key="7" value="0"/>\n' +
  '                <param name="Black Point" key="1" value="0"/>\n' +
  '                <param name="Shadows" key="4" value="0"/>\n' +
  '                <param name="Saturation" key="16" value="0"/>\n' +
  '                <param name="Highlights Warmth" key="10" value="0"/>\n' +
  '                <param name="Highlights Tint" key="11" value="0"/>\n' +
  '                <param name="Midtones Warmth" key="12" value="0"/>\n' +
  '                <param name="Midtones Tint" key="13" value="0"/>\n' +
  '                <param name="Shadows Warmth" key="14" value="0"/>\n' +
  '                <param name="Shadows Tint" key="15" value="0"/>\n' +
  '            </filter-video>\n' +
  '            <filter-video ref="fx3" name="Color Correction"/>\n' +
  '            <filter-video ref="fx4" name="Color Wheels">\n' +
  '                <data key="effectConfig">YnBsaXN0MDDUAQIDBAUGBwpYJHZlcnNpb25ZJGFyY2hpdmVyVCR0b3BYJG9iamVjdHMSAAGGoF8QD05TS2V5ZWRBcmNoaXZlctEICVRyb290gAGlCwwVFhdVJG51bGzTDQ4PEBIUV05TLmtleXNaTlMub2JqZWN0c1YkY2xhc3OhEYACoROAA4AEXXBsdWdpblZlcnNpb24QCNIYGRobWiRjbGFzc25hbWVYJGNsYXNzZXNfEBNOU011dGFibGVEaWN0aW9uYXJ5oxocHVxOU0RpY3Rpb25hcnlYTlNPYmplY3QIERokKTI3SUxRU1lfZm55gIKEhoiKmJqfqrPJzdoAAAAAAAABAQAAAAAAAAAeAAAAAAAAAAAAAAAAAAAA4w==</data>\n' +
  '                <param name="Temperature" key="8890" value="5000"/>\n' +
  '                <param name="Tint" key="8891" value="0"/>\n' +
  '                <param name="Hue" key="8892" value="0"/>\n' +
  '                <param name="Global" key="1" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9Ikdsb2JhbCIgaWQ9IjEiIGZsYWdzPSI0Mjk5MTYxNjE2Ij4KCTxmbGFncz40Mjk5MTYxNjE2PC9mbGFncz4KCTxudW1iZXJPZktleXBvaW50cz4wPC9udW1iZXJPZktleXBvaW50cz4KCTxkZWZhdWx0VmFsPioqKioqKioqKkdBZU1iLWdPTEJvQTExSSpFNjEtKkk0LWtkTTc1TlpRYkJkUHF0Tjc0M21NcVZkUmFKbUowRm9Qci1NNzR4V09hSlhSNUFHKio0NGMzd0Uxb3RIR3FKdE5LRi1RYUJjT0xOWlFoMjYwSjZZQTYqLWNrZ0EycElZUGJKZ1BCQUIxVXdFMkY3SlA0WmJPNUZLNzRCZ01MQm5LYkJWUjVKbU1MRmRQcXNYRHkqKioqKioqKjAqKldBenMqKioqKioqKkI2STNGTUxLV0ZYUDQzblFxdFZQS0pNNzRCZ01MQm5OTEJUMi1WRUVJSjFQcWxqUVpSY05LSmdFcVZWUGF0WlAyRlZSNDRXNC1aVDItVkVFSUoxUHFsalFaUmNOS0pnRXFWVlBhdFpQMkZWUjQzTUhaQkRNYWRaTXJFNjJGY1k4SDZyR0lsRElKSlBNYVZqU2NDM1hkQ1NkdzkzcyoqKioqKioqKjItKioqKioqKioqLWMqKioqKioqKioqKioqKioqKioqMWQ8L2RlZmF1bHRWYWw+Cgk8ZGF0YVZhbHVlPioqKioqKioqKkdBZU1iLWdPTEJvQTExSSpFNjEtKkk0LWtkTTc1TlpRYkJkUHF0Tjc0M21NcVZkUmFKbUowRm9Qci1NNzR4V09hSlhSNUFHKio0NGMzd0Uxb3RIR3FKdE5LRi1RYUJjT0xOWlFoMjYwSjZZQTYqLWNrZ0EycElZUGJKZ1BCQUIxVXdFMkY3SlA0WmJPNUZLNzRCZ01MQm5LYkJWUjVKbU1MRmRQcXNYRHkqKioqKioqKjAqKldBenMqKioqKioqKkI2STNGTUxLV0ZYUDQzblFxdFZQS0pNNzRCZ01MQm5OTEJUMi1WRUVJSjFQcWxqUVpSY05LSmdFcVZWUGF0WlAyRlZSNDRXNC1aVDItVkVFSUoxUHFsalFaUmNOS0pnRXFWVlBhdFpQMkZWUjQzTUhaQkRNYWRaTXJFNjJGY1k4SDZyR0lsRElKSlBNYVZqU2NDM1hkQ1NkdzkzcyoqKioqKioqKjItKioqKioqKioqLWMqKioqKioqKioqKioqKioqKioqMWQ8L2RhdGFWYWx1ZT4KPC9wYXJhbWV0ZXI+Cgo8L296bWw+Cg=="/>\n' +
  '                <param name="Shadows" key="2" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9IlNoYWRvd3MiIGlkPSIyIiBmbGFncz0iNDI5OTE2MTYxNiI+Cgk8ZmxhZ3M+NDI5OTE2MTYxNjwvZmxhZ3M+Cgk8bnVtYmVyT2ZLZXlwb2ludHM+MDwvbnVtYmVyT2ZLZXlwb2ludHM+Cgk8ZGVmYXVsdFZhbD4qKioqKioqKipHQWVNYi1nT0xCb0ExMUkqRTYxLSpJNC1rZE03NU5aUWJCZFBxdE43NDNtTXFWZFJhSm1KMEZvUHItTTc0eFdPYUpYUjVBRyoqNDRjM3dFMW90SEdxSnROS0YtUWFCY09MTlpRaDI2MEo2WUE2Ki1ja2dBMnBJWVBiSmdQQkFCMVV3RTJGN0pQNFpiTzVGSzc0QmdNTEJuS2JCVlI1Sm1NTEZkUHFzWER5KioqKioqKiowKipXQXpzKioqKioqKipCNkkzRk1MS1dGWFA0M25RcXRWUEtKTTc0QmdNTEJuTkxCVDItVkVFSUoxUHFsalFaUmNOS0pnRXFWVlBhdFpQMkZWUjQ0VzQtWlQyLVZFRUlKMVBxbGpRWlJjTktKZ0VxVlZQYXRaUDJGVlI0M01IWkJETWFkWk1yRTYyRmNZOEg2ckdJbERJSkpQTWFWalNjQzNYZENTZHc5M3MqKioqKioqKioyLSoqKioqKioqKi1jKioqKioqKioqKioqKioqKioqKjFkPC9kZWZhdWx0VmFsPgoJPGRhdGFWYWx1ZT4qKioqKioqKipHQWVNYi1nT0xCb0ExMUkqRTYxLSpJNC1rZE03NU5aUWJCZFBxdE43NDNtTXFWZFJhSm1KMEZvUHItTTc0eFdPYUpYUjVBRyoqNDRjM3dFMW90SEdxSnROS0YtUWFCY09MTlpRaDI2MEo2WUE2Ki1ja2dBMnBJWVBiSmdQQkFCMVV3RTJGN0pQNFpiTzVGSzc0QmdNTEJuS2JCVlI1Sm1NTEZkUHFzWER5KioqKioqKiowKipXQXpzKioqKioqKipCNkkzRk1MS1dGWFA0M25RcXRWUEtKTTc0QmdNTEJuTkxCVDItVkVFSUoxUHFsalFaUmNOS0pnRXFWVlBhdFpQMkZWUjQ0VzQtWlQyLVZFRUlKMVBxbGpRWlJjTktKZ0VxVlZQYXRaUDJGVlI0M01IWkJETWFkWk1yRTYyRmNZOEg2ckdJbERJSkpQTWFWalNjQzNYZENTZHc5M3MqKioqKioqKioyLSoqKioqKioqKi1jKioqKioqKioqKioqKioqKioqKjFkPC9kYXRhVmFsdWU+CjwvcGFyYW1ldGVyPgoKPC9vem1sPgo="/>\n' +
  '                <param name="Midtones" key="3" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9Ik1pZHRvbmVzIiBpZD0iMyIgZmxhZ3M9IjQyOTkxNjE2MTYiPgoJPGZsYWdzPjQyOTkxNjE2MTY8L2ZsYWdzPgoJPG51bWJlck9mS2V5cG9pbnRzPjA8L251bWJlck9mS2V5cG9pbnRzPgoJPGRlZmF1bHRWYWw+KioqKioqKioqR0FlTWItZ09MQm9BMTFJKkU2MS0qSTQta2RNNzVOWlFiQmRQcXRONzQzbU1xVmRSYUptSjBGb1ByLU03NHhXT2FKWFI1QUcqKjQ0YzN3RTFvdEhHcUp0TktGLVFhQmNPTE5aUWgyNjBKNllBNiotY2tnQTJwSVlQYkpnUEJBQjFVd0UyRjdKUDRaYk81Rks3NEJnTUxCbktiQlZSNUptTUxGZFBxc1hEeSoqKioqKioqMCoqV0F6cyoqKioqKioqQjZJM0ZNTEtXRlhQNDNuUXF0VlBLSk03NEJnTUxCbk5MQlQyLVZFRUlKMVBxbGpRWlJjTktKZ0VxVlZQYXRaUDJGVlI0NFc0LVpUMi1WRUVJSjFQcWxqUVpSY05LSmdFcVZWUGF0WlAyRlZSNDNNSFpCRE1hZFpNckU2MkZjWThINnJHSWxESUpKUE1hVmpTY0MzWGRDU2R3OTNzKioqKioqKioqMi0qKioqKioqKiotYyoqKioqKioqKioqKioqKioqKioxZDwvZGVmYXVsdFZhbD4KCTxkYXRhVmFsdWU+KioqKioqKioqR0FlTWItZ09MQm9BMTFJKkU2MS0qSTQta2RNNzVOWlFiQmRQcXRONzQzbU1xVmRSYUptSjBGb1ByLU03NHhXT2FKWFI1QUcqKjQ0YzN3RTFvdEhHcUp0TktGLVFhQmNPTE5aUWgyNjBKNllBNiotY2tnQTJwSVlQYkpnUEJBQjFVd0UyRjdKUDRaYk81Rks3NEJnTUxCbktiQlZSNUptTUxGZFBxc1hEeSoqKioqKioqMCoqV0F6cyoqKioqKioqQjZJM0ZNTEtXRlhQNDNuUXF0VlBLSk03NEJnTUxCbk5MQlQyLVZFRUlKMVBxbGpRWlJjTktKZ0VxVlZQYXRaUDJGVlI0NFc0LVpUMi1WRUVJSjFQcWxqUVpSY05LSmdFcVZWUGF0WlAyRlZSNDNNSFpCRE1hZFpNckU2MkZjWThINnJHSWxESUpKUE1hVmpTY0MzWGRDU2R3OTNzKioqKioqKioqMi0qKioqKioqKiotYyoqKioqKioqKioqKioqKioqKioxZDwvZGF0YVZhbHVlPgo8L3BhcmFtZXRlcj4KCjwvb3ptbD4K"/>\n' +
  '                <param name="Highlights" key="4" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9IkhpZ2hsaWdodHMiIGlkPSI0IiBmbGFncz0iNDI5OTE2MTYxNiI+Cgk8ZmxhZ3M+NDI5OTE2MTYxNjwvZmxhZ3M+Cgk8bnVtYmVyT2ZLZXlwb2ludHM+MDwvbnVtYmVyT2ZLZXlwb2ludHM+Cgk8ZGVmYXVsdFZhbD4qKioqKioqKipHQWVNYi1nT0xCb0ExMUkqRTYxLSpJNC1rZE03NU5aUWJCZFBxdE43NDNtTXFWZFJhSm1KMEZvUHItTTc0eFdPYUpYUjVBRyoqNDRjM3dFMW90SEdxSnROS0YtUWFCY09MTlpRaDI2MEo2WUE2Ki1ja2dBMnBJWVBiSmdQQkFCMVV3RTJGN0pQNFpiTzVGSzc0QmdNTEJuS2JCVlI1Sm1NTEZkUHFzWER5KioqKioqKiowKipXQXpzKioqKioqKipCNkkzRk1MS1dGWFA0M25RcXRWUEtKTTc0QmdNTEJuTkxCVDItVkVFSUoxUHFsalFaUmNOS0pnRXFWVlBhdFpQMkZWUjQ0VzQtWlQyLVZFRUlKMVBxbGpRWlJjTktKZ0VxVlZQYXRaUDJGVlI0M01IWkJETWFkWk1yRTYyRmNZOEg2ckdJbERJSkpQTWFWalNjQzNYZENTZHc5M3MqKioqKioqKioyLSoqKioqKioqKi1jKioqKioqKioqKioqKioqKioqKjFkPC9kZWZhdWx0VmFsPgoJPGRhdGFWYWx1ZT4qKioqKioqKipHQWVNYi1nT0xCb0ExMUkqRTYxLSpJNC1rZE03NU5aUWJCZFBxdE43NDNtTXFWZFJhSm1KMEZvUHItTTc0eFdPYUpYUjVBRyoqNDRjM3dFMW90SEdxSnROS0YtUWFCY09MTlpRaDI2MEo2WUE2Ki1ja2dBMnBJWVBiSmdQQkFCMVV3RTJGN0pQNFpiTzVGSzc0QmdNTEJuS2JCVlI1Sm1NTEZkUHFzWER5KioqKioqKiowKipXQXpzKioqKioqKipCNkkzRk1MS1dGWFA0M25RcXRWUEtKTTc0QmdNTEJuTkxCVDItVkVFSUoxUHFsalFaUmNOS0pnRXFWVlBhdFpQMkZWUjQ0VzQtWlQyLVZFRUlKMVBxbGpRWlJjTktKZ0VxVlZQYXRaUDJGVlI0M01IWkJETWFkWk1yRTYyRmNZOEg2ckdJbERJSkpQTWFWalNjQzNYZENTZHc5M3MqKioqKioqKioyLSoqKioqKioqKi1jKioqKioqKioqKioqKioqKioqKjFkPC9kYXRhVmFsdWU+CjwvcGFyYW1ldGVyPgoKPC9vem1sPgo="/>\n' +
  '                <param name="Preserve Luma" key="8894" value="1"/>\n' +
  '            </filter-video>\n' +
  '            <filter-video ref="fx5" name="Custom LUT">\n' +
  '                <data key="effectConfig">YnBsaXN0MDDUAQIDBAUGBwpYJHZlcnNpb25ZJGFyY2hpdmVyVCR0b3BYJG9iamVjdHMSAAGGoF8QD05TS2V5ZWRBcmNoaXZlctEICVRyb290gAGlCwwVFhdVJG51bGzTDQ4PEBIUV05TLmtleXNaTlMub2JqZWN0c1YkY2xhc3OhEYACoROAA4AEXXBsdWdpblZlcnNpb24QAtIYGRobWiRjbGFzc25hbWVYJGNsYXNzZXNfEBNOU011dGFibGVEaWN0aW9uYXJ5oxocHVxOU0RpY3Rpb25hcnlYTlNPYmplY3QIERokKTI3SUxRU1lfZm55gIKEhoiKmJqfqrPJzdoAAAAAAAABAQAAAAAAAAAeAAAAAAAAAAAAAAAAAAAA4w==</data>\n' +
  '                <param name="LUT" key="3" value="PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCFET0NUWVBFIG96eG1sc2NlbmU+Cjxvem1sIHZlcnNpb249IjUuMTQiPgoKPGZhY3RvcnkgaWQ9IjEiIHV1aWQ9IjRkMGU0OGQ4NGZjYTQyNGQ4MmFhOThhMDI3YzZlYzVjIj4KCTxkZXNjcmlwdGlvbj5DaGFubmVsPC9kZXNjcmlwdGlvbj4KCTxtYW51ZmFjdHVyZXI+QXBwbGU8L21hbnVmYWN0dXJlcj4KCTx2ZXJzaW9uPjE8L3ZlcnNpb24+CjwvZmFjdG9yeT4KCgo8cGFyYW1ldGVyIG5hbWU9IkxVVCIgaWQ9IjMiIGZsYWdzPSI0Mjk1MDMyODQ4Ij4KCTxmbGFncz40Mjk1MDMyODQ4PC9mbGFncz4KCTxudW1iZXJPZktleXBvaW50cz4wPC9udW1iZXJPZktleXBvaW50cz4KCTxkZWZhdWx0VmFsPioqKioqKioqKjZVZU1iLWdPTEJvQTExSSpFNjEtKkk0LWtkTTc1TlpRYkJkUHF0Tjc0M21NcVZkUmFKbUowRm9Qci1NNzR4V09hSlhSNUFHKio0NGMzd0Uxb3RIR3FKdE5LRi1RYUJjT0xOWlFoMjYwSjZZQTYqLWNVZ0FKR0ZpUktsZ0kqVUY0V0VkQVhSN0gyeEZKM2MqKioqKioqKi0qRSoqKioqKioqKkIqKioqKioqKioqKioqKioqKioqKktrKio8L2RlZmF1bHRWYWw+Cgk8ZGF0YVZhbHVlPioqKioqKioqKkFRZU1iLWdPTEJvQTExSSpFNjEtKkk0LWtkTTc1TlpRYkJkUHF0Tjc0M21NcVZkUmFKbUowRm9Qci1NNzR4V09hSlhSNUFHKio0NGMzd0Uxb3RIR3FKdE5LRi1RYUJjT0xOWlFoMjYwSjZZQTYqLWNVZ0FKR0ZpUktsZ0xsKnhOSzNWTmFNcUFIVW9DNDZxQmFOVkNLQWtNcUVtTlhFcEIxVlhBNEZXQ0hRdUFKeEhGcTNoUkxFbkVxWmlOSkJBUHFRbkxwRmpMb2wxOUhRa0NFVUY0V0VkQVhSN0gyeEZKM2MqKioqKioqKi0qRSoqKioqKioqKkIqKioqKioqKioqKioqKioqKioqKmFVKio8L2RhdGFWYWx1ZT4KPC9wYXJhbWV0ZXI+Cgo8L296bWw+Cg=="/>\n' +
  '                <param name="Input" key="100/101" value="0 (Rec. 709)"/>\n' +
  '                <param name="Output" key="100/102" value="0 (Rec. 709)"/>\n' +
  '            </filter-video>';

const _FCP_PRESET_AUDIO_FILTER = '\n            <filter-audio ref="fx6" name="Limiter"/>';

function fcpBuildXML(segments, fileMap, fps, projectName, durationMap) {
  fps = fps || 25;
  const fN = 100, fD = fps * 100;
  const fd = `${fN}/${fD}s`;

  const resources = [
    `    <format id="r1" frameDuration="${fd}" width="1920" height="1080" ` +
    `colorSpace="1-1-1 (Rec. 709)" name="FFVideoFormat1080p${fps}"/>`,
    _FCP_EFFECT_RESOURCES,
  ];
  let assetIdx = 0;
  const projects = [];
  const eventClips = [];   // browser clips (shown in the FCP Event/browser, not just the timeline)

  for (const seg of segments) {
    const segTitle  = _fcpXe(seg.title || 'مقطع');
    const shots     = seg.shots || [];
    const spineClips = [];
    let timelineFr   = 0;

    for (let i = 0; i < shots.length; i++) {
      const s      = shots[i];
      const title  = s.title || `مشهد ${i+1}`;
      const cams   = [
        [(s.filename  || '').trim(), 'A'],
        [(s.filename2 || '').trim(), 'B'],
        [(s.filename3 || '').trim(), 'C'],
        [(s.filename4 || '').trim(), 'D'],
      ].filter(([f]) => f);
      const mkrs   = _fcpBuildMarkers(s, fps, fN, fD);
      const multiCam = cams.length > 1;

      const addClip = (fname, label) => {
        if (!fname) return;
        // Use actual file duration if available, otherwise fall back to calculated duration
        const fileDurSec = durationMap && (durationMap[fname] || durationMap[fname + '.mp4']);
        const durFr = (fileDurSec && isFinite(fileDurSec) && fileDurSec > 0)
          ? Math.round(fileDurSec * fps)
          : _fcpShotDurFrames(s, fps);
        const dur = `${durFr * fN}/${fD}s`;

        // Use server-resolved path, or full path pasted directly, or null (→ gap)
        const fpath    = fileMap[fname] || fileMap[fname + '.mp4'] || (fname.startsWith('/') ? fname : null);
        const clipName = _fcpXe(title + (label || ''));
        const offset   = `${timelineFr * fN}/${fD}s`;

        if (fpath) {
          // Real file — emit an asset-clip with resolved path
          assetIdx++;
          const aid = `r${assetIdx + 1}`;
          const uid = crypto.randomUUID().replace(/-/g,'').toUpperCase();
          resources.push(
            `    <asset id="${aid}" name="${clipName}" uid="${uid}" ` +
            `start="0s" duration="${dur}" ` +
            `hasVideo="1" videoSources="1" hasAudio="1" audioSources="1" audioChannels="2" audioRate="48000" ` +
            `format="r1">\n      <media-rep kind="original-media" src="${_fcpPathToUri(fpath)}"/>\n    </asset>`
          );
          const clipInner = (mkrs ? '\n' + mkrs : '') + '\n' + _FCP_PRESET_VIDEO_FILTERS + _FCP_PRESET_AUDIO_FILTER + '\n          </asset-clip>';
          spineClips.push(
            `          <asset-clip name="${clipName}" ref="${aid}" ` +
            `offset="${offset}" duration="${dur}" start="0s" format="r1" tcFormat="NDF">` +
            clipInner
          );
          // Also expose this clip in the FCP browser (Event) so it isn't only in the timeline
          eventClips.push(
            `      <asset-clip name="${clipName}" ref="${aid}" ` +
            `duration="${dur}" start="0s" format="r1" tcFormat="NDF"/>`
          );
        } else {
          // No resolved path — emit a gap placeholder (FCP won't choke; replace media manually)
          spineClips.push(
            `          <gap name="${clipName}" offset="${offset}" duration="${dur}" start="0s">` +
            (mkrs ? '\n' + mkrs + '\n          </gap>' : '</gap>')
          );
        }

        timelineFr += durFr;
      };

      cams.forEach(([fname, letter]) => addClip(fname, multiCam ? ' — ' + letter : ''));
    }

    if (!spineClips.length) continue;

    projects.push(
      `      <project name="${segTitle}">\n` +
      `        <sequence format="r1" duration="${timelineFr * fN}/${fD}s" ` +
      `tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">\n` +
      `          <spine>\n` +
      spineClips.join('\n') + '\n' +
      `          </spine>\n        </sequence>\n      </project>`
    );
  }

  const eventName = _fcpXe(projectName || 'مشروع');
  const eventBody = [
    eventClips.join('\n'),   // browser clips first so they show in the Event browser
    projects.join('\n'),     // then the projects/timelines
  ].filter(Boolean).join('\n');
  const event = projects.length || eventClips.length
    ? `    <event name="${eventName}">\n` + eventBody + '\n    </event>'
    : '';

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.10">\n' +
    '  <resources>\n' + resources.join('\n') + '\n  </resources>\n' +
    '  <library>\n'   + event + '\n  </library>\n</fcpxml>'
  );
}

function fcpDownload() {
  if (!cur) return;
  const segments = cur.segments || [];
  if (!segments.length) return;
  const xml  = fcpBuildXML(segments, fcpFileMap || {}, cur.fps || 25, cur.name, fcpDurationMap || {});
  const blob = new Blob([xml], { type: 'application/xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const safe = (cur.name || 'مشروع').replace(/[^\w\u0600-\u06FF\s\-_]/g,'').trim() || 'export';
  a.href = url;
  a.download = safe + '.fcpxml';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  // update status
  const st = document.getElementById('fcpStatus');
  if (st) {
    st.className = 'fcp-status ok';
    st.textContent = `✅ تم تحميل ${safe}.fcpxml\n\nافتح الملف في Final Cut Pro وأعد ربط الوسائط إذا لزم.`;
  }
}

function fcpLaunchApp() {
  if (!cur) return;
  const folder = document.getElementById('fcpFolderInput').value.trimStart().replace(/^['"]|['"]$/, '');
  const st = document.getElementById('fcpStatus');

  // Deep-copy segments and ensure filenames include .mp4 extension
  const segments = JSON.parse(JSON.stringify(cur.segments || []));
  segments.forEach(seg => {
    (seg.shots || []).forEach(s => {
      if (s.filename  && !s.filename.includes('.'))  s.filename  += '.mp4';
      if (s.filename2 && !s.filename2.includes('.')) s.filename2 += '.mp4';
      if (s.filename3 && !s.filename3.includes('.')) s.filename3 += '.mp4';
      if (s.filename4 && !s.filename4.includes('.')) s.filename4 += '.mp4';
    });
  });

  // Hand the app the absolute paths Mersad already resolved during matching,
  // so it links media directly instead of relying solely on re-scanning the
  // folder. Drop blob: URLs (only meaningful inside the browser).
  const fileMap = {};
  for (const [name, path] of Object.entries(fcpFileMap || {})) {
    if (typeof path === 'string' && path.startsWith('/')) fileMap[name] = path;
  }

  // If the folder field is empty (e.g. files picked from Finder), derive it
  // from a resolved absolute path so the app still has a path to work with.
  let outFolder = folder;
  if (!outFolder) {
    const anyPath = Object.values(fileMap)[0];
    if (anyPath) outFolder = anyPath.slice(0, anyPath.lastIndexOf('/'));
  }

  const payload = JSON.stringify({
    project:  { name: cur.name },
    segments,
    folder:   outFolder,
    fileMap,
    durationMap: fcpDurationMap || {},
    fps: cur.fps || 25
  });

  // The native app reads this payload from the clipboard the instant it
  // launches, so the write MUST complete *before* we open the URL scheme.
  // navigator.clipboard.writeText is async — if we don't block on it, the app
  // reads stale/empty clipboard data and reports "0 files" with unlinked clips.
  // execCommand('copy') writes synchronously and keeps the user-gesture chain,
  // guaranteeing the payload is on the clipboard before the app starts.
  let copied = false;
  try {
    const ta = document.createElement('textarea');
    ta.value = payload;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, payload.length);
    copied = document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) { copied = false; }

  // Fallback for browsers without execCommand support — async, best effort.
  if (!copied) {
    navigator.clipboard.writeText(payload).catch(e => {
      st.className = 'fcp-status err';
      st.textContent = '❌ تعذّر النسخ للحافظة: ' + e.message;
    });
  }

  st.className = 'fcp-status ok';
  st.textContent = '✅ تم نسخ البيانات\nجاري فتح مِرصاد…';

  // Must be called synchronously within the user gesture
  window.open('musawwir://open-fcp', '_self');
}

async function fcpLaunch() {
  const folder = document.getElementById('fcpFolderInput').value.trimStart().replace(/^['"]|['"]$/, '');
  const st = document.getElementById('fcpStatus');
  st.className = 'fcp-status';
  st.textContent = 'جاري إنشاء الملف وفتح Final Cut Pro…';
  document.getElementById('fcpLaunchBtn').disabled = true;

  try {
    const res = await fetch('https://localhost:8080/open-fcp', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        project:  { name: cur.name },
        segments: cur.segments || [],
        folder,
        fps: cur.fps || 25
      })
    });
    if (!res.ok) throw new Error('خطأ في الاتصال بالخادم');
    const data = await res.json();

    if (data.opened) {
      st.className = 'fcp-status ok';
      st.textContent = `✅ تم فتح Final Cut Pro!\n\nربط ${data.matched} من ${data.total} مشهد بملفات فيديو حقيقية.\nمسار الملف: ${data.path}`;
      setTimeout(() => closeFcpModal(), 2500);
    } else {
      st.className = 'fcp-status';
      st.textContent = `⚠️ تم إنشاء الملف لكن تعذّر فتح Final Cut Pro تلقائياً.\n\nافتح الملف يدوياً:\n${data.path}`;
    }
    document.getElementById('fcpLaunchBtn').disabled = false;
  } catch(e) {
    st.className = 'fcp-status err';
    st.textContent = 'فشل فتح Final Cut Pro.\n' + e.message;
    document.getElementById('fcpLaunchBtn').disabled = false;
  }
}

// ══════════════════════════════════════════
//  Rich Text Editor
// ══════════════════════════════════════════
let editorShotId = null;

function openEditor(shotId) {
  const s = _findShot(shotId);
  if (!s) return;
  editorShotId = shotId;

  const overlay = document.getElementById('reOverlay');
  const page    = document.getElementById('rePage');
  const title   = document.getElementById('reTitle');

  title.textContent = 'المحتوى — ' + (s.title || ('مشهد ' + _globalShotIndex(shotId)));

  // Load rich content or convert plain text to HTML
  if (s.contentRich) {
    page.innerHTML = sanitizeRichHTML(s.contentRich);
  } else if (s.content) {
    // Convert plain text to paragraphs
    page.innerHTML = s.content.split('\n').map(l => `<p>${esc(l)||'<br>'}</p>`).join('');
  } else {
    page.innerHTML = '';
  }

  overlay.style.display = 'flex';
  updateWordCount();
  setTimeout(() => { page.focus(); }, 80);
}

function closeEditor(save) {
  if (save && editorShotId) {
    const s    = _findShot(editorShotId);
    const page = document.getElementById('rePage');
    if (s) {
      s.contentRich = page.innerHTML;
      s.content = page.innerText.trim();
      // Update the textarea in the background
      const ta = document.getElementById('ctxt-' + editorShotId);
      if (ta) ta.value = s.content;
      const sf = document.getElementById('sfContent');
      if (sf) sf.value = s.content;
      autoSave();
    }
  }
  document.getElementById('reOverlay').style.display = 'none';
  editorShotId = null;
}

function execCmd(cmd, value) {
  document.getElementById('rePage').focus();
  document.execCommand(cmd, false, value || null);
  updateWordCount();
}

function updateWordCount() {
  const page = document.getElementById('rePage');
  const text = page ? page.innerText.trim() : '';
  const words = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
  const el = document.getElementById('reWordCount');
  if (!el) return;
  let durStr = '—';
  if (words > 0) {
    const totalSec = Math.round((words / 130) * 60);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    durStr = m > 0 ? m + ':' + String(s).padStart(2, '0') + ' د' : s + ' ث';
  }
  el.textContent = words + ' كلمة · ' + text.length + ' حرف · ' + durStr + ' إلقاء';
}

function handleEditorKey(e) {
  // Close on Escape
  if (e.key === 'Escape') { closeEditor(true); return; }
  // Cmd+S to save
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); closeEditor(true); return; }
}

// Close editor on overlay click (outside the wrap)
document.getElementById('reOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeEditor(true);
});

// Close FCP modal on backdrop click
document.getElementById('fcpOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeFcpModal();
});

// ── Auto-save ──
document.addEventListener('change', ()=>{ if(cur) autoSave(); });
document.addEventListener('input',  ()=>{ if(cur) autoSave(); });
setInterval(()=>{ if(cur) autoSave(); }, 20000);

// ══════════════════════════════════════════
//  SHARE PROJECT
// ══════════════════════════════════════════
let _viewOnlyData = null;
let _editShareId = null;

function openShareModal() {
  if (!cur || cur._viewOnly || _editShareId) return;
  const hasShare = !!cur.shareId;
  const currentMode = cur.shareMode || 'view';
  document.getElementById('shareDesc').textContent = hasShare
    ? 'هذا المشروع مشارك. يمكنك نسخ الرابط أو إلغاء المشاركة.'
    : 'أنشئ رابطاً لمشاركة هذا المشروع مع آخرين.';
  document.getElementById('shareLinkRow').style.display = hasShare ? 'flex' : 'none';
  if (hasShare) {
    document.getElementById('shareLinkInput').value = buildShareUrl(cur.shareId);
    document.getElementById('shareModeView').checked = currentMode === 'view';
    document.getElementById('shareModeEdit').checked = currentMode === 'edit';
  }
  document.getElementById('shareRevokeBtn').style.display = hasShare ? '' : 'none';
  document.getElementById('shareGenBtn').textContent = hasShare ? 'تجديد الرابط' : 'إنشاء رابط';
  document.getElementById('shareStatus').textContent = '';
  document.getElementById('shareOverlay').style.display = 'flex';
}

function closeShareModal() {
  document.getElementById('shareOverlay').style.display = 'none';
}

function buildShareUrl(shareId) {
  return location.origin + location.pathname + '?share=' + shareId;
}

async function generateShare() {
  if (!cur || !fbUser) return;
  const status = document.getElementById('shareStatus');
  const genBtn = document.getElementById('shareGenBtn');
  const mode = document.querySelector('input[name="shareMode"]:checked')?.value || 'view';
  status.textContent = 'جاري الإنشاء…'; status.className = 'share-status';
  genBtn.disabled = true;
  try {
    if (cur.shareId) await deleteDoc(doc(db, 'sharedProjects', cur.shareId)).catch(()=>{});
    const shareId = secureId();
    await setDoc(doc(db, 'sharedProjects', shareId), {
      shareId, ownerUid: fbUser.uid, projectId: cur.id,
      data: JSON.parse(JSON.stringify(cur)), mode, createdAt: serverTimestamp()
    });
    cur.shareId = shareId;
    cur.shareMode = mode;
    await saveProject(cur);
    document.getElementById('shareLinkInput').value = buildShareUrl(shareId);
    document.getElementById('shareLinkRow').style.display = 'flex';
    document.getElementById('shareRevokeBtn').style.display = '';
    document.getElementById('shareDesc').textContent = 'الرابط جاهز. شارك هذا الرابط مع من تريد.';
    document.getElementById('shareGenBtn').textContent = 'تجديد الرابط';
    const modeLabel = mode === 'edit' ? 'تحرير' : 'مشاهدة فقط';
    status.textContent = `✓ تم إنشاء رابط ${modeLabel}`; status.className = 'share-status ok';
  } catch(e) {
    status.textContent = 'خطأ: ' + e.message; status.className = 'share-status err';
  } finally { genBtn.disabled = false; }
}

async function revokeShare() {
  if (!cur?.shareId || !await _showConfirm('إلغاء مشاركة هذا المشروع؟', { destructive: true, confirmLabel: 'إلغاء المشاركة' })) return;
  const status = document.getElementById('shareStatus');
  status.textContent = 'جاري الإلغاء…';
  try {
    await deleteDoc(doc(db, 'sharedProjects', cur.shareId));
    delete cur.shareId;
    delete cur.shareMode;
    await saveProject(cur);
    document.getElementById('shareLinkRow').style.display = 'none';
    document.getElementById('shareRevokeBtn').style.display = 'none';
    document.getElementById('shareDesc').textContent = 'تم إلغاء المشاركة.';
    document.getElementById('shareGenBtn').textContent = 'إنشاء رابط';
    status.textContent = ''; status.className = 'share-status';
  } catch(e) {
    status.textContent = 'خطأ: ' + e.message; status.className = 'share-status err';
  }
}

function copyShareLink() {
  const val = document.getElementById('shareLinkInput').value;
  navigator.clipboard.writeText(val).then(() => {
    const st = document.getElementById('shareStatus');
    st.textContent = '✓ تم نسخ الرابط'; st.className = 'share-status ok';
    setTimeout(() => { st.textContent = ''; }, 2000);
  });
}

async function claimSharedProject() {
  if (!fbUser) { _showToast('يجب تسجيل الدخول أولاً.', 'error'); return; }
  const isEditShare = !!_editShareId;
  const sourceData = isEditShare ? cur : _viewOnlyData;
  if (!sourceData) return;
  const btnId = isEditShare ? 'claimEditBtn' : 'claimBtn';
  const btn = document.getElementById(btnId);
  btn.disabled = true; btn.textContent = 'جاري الإضافة…';
  try {
    const cloned = JSON.parse(JSON.stringify(sourceData));
    cloned.id = uid(); cloned.lastModified = Date.now();
    cloned.folderId = null; delete cloned.shareId; delete cloned.shareMode;
    await saveProject(cloned);
    history.replaceState(null, '', location.pathname);
    document.getElementById('viewonlyBanner').style.display = 'none';
    document.getElementById('editShareBanner').style.display = 'none';
    _viewOnlyData = null;
    _editShareId = null;
    cur = null;
    await showHome();
    openProject(cloned.id);
    _showToast('تمت إضافة التصوير إلى مشاريعك', 'success', 2500);
  } catch(e) {
    _showToast('خطأ: ' + e.message, 'error');
    btn.disabled = false; btn.textContent = 'إضافة إلى مشاريعي';
  }
}

function renderViewOnly(p) {
  cur = JSON.parse(JSON.stringify(p));
  cur._viewOnly = true;
  document.getElementById('homePage').classList.remove('active');
  document.getElementById('projectPage').classList.add('active');
  document.getElementById('viewonlyBanner').style.display = 'flex';
  fillForm();
  renderShots();
  updateProgress();
  document.getElementById('topLeft').innerHTML = `
    <div class="brand"><div class="brand-icon">🎬</div>مِرصاد</div>
    <div class="tb-divider"></div>
    <span class="topbar-title">${esc(p.name || 'بدون عنوان')}</span>`;
  document.getElementById('topRight').innerHTML = `<span style="font-size:12px;color:var(--subtext)">عرض فقط</span>`;
  setTimeout(() => {
    document.querySelectorAll('#projectPage input, #projectPage textarea, #projectPage select').forEach(el => {
      el.setAttribute('readonly', ''); el.style.pointerEvents = 'none';
    });
    document.querySelectorAll('#projectPage button:not(#claimBtn)').forEach(el => el.style.pointerEvents = 'none');
  }, 100);
}

function renderEditShare(shareId, p) {
  _editShareId = shareId;
  cur = JSON.parse(JSON.stringify(p));
  cur._viewOnly = false;
  document.getElementById('homePage').classList.remove('active');
  document.getElementById('projectPage').classList.add('active');
  document.getElementById('editShareBanner').style.display = 'flex';
  fillForm();
  renderShots();
  updateProgress();
  document.getElementById('topLeft').innerHTML = `
    <div class="brand"><div class="brand-icon">🎬</div>مِرصاد</div>
    <div class="tb-divider"></div>
    <span class="topbar-title">${esc(p.name || 'بدون عنوان')}</span>`;
  document.getElementById('topRight').innerHTML = `<span style="font-size:12px;color:var(--subtext)">تحرير مشترك</span>`;
}

// ══════════════════════════════════════════
//  FOLDER LINK VIEW
// ══════════════════════════════════════════
let _flpProjects = [];

async function openFolderLink(shareId) {
  try {
    const linkSnap = await getDoc(doc(db, 'sharedFolderLinks', shareId));
    if (!linkSnap.exists()) { _showToast('الرابط غير صالح أو تم إلغاؤه.', 'error'); setTimeout(() => location.href = location.pathname, 2500); return; }
    const linkData = linkSnap.data();

    // Fetch projects in this folder from owner's collection
    const projSnap = await getDocs(query(
      collection(db, 'users', linkData.ownerUid, 'projects'),
      where('folderId', '==', linkData.folderId)
    ));
    _flpProjects = projSnap.docs.map(d => d.data()).filter(p => !p._deleted);

    document.getElementById('flpFolderName').textContent = linkData.folderName || 'ملف مشترك';
    document.getElementById('flpOwnerName').textContent = linkData.ownerName || '';

    const list = document.getElementById('flpProjectList');
    if (_flpProjects.length === 0) {
      list.innerHTML = '<div style="color:var(--subtext);font-size:14px;text-align:center;padding:40px 0">لا توجد تصاوير في هذا الملف</div>';
    } else {
      list.innerHTML = _flpProjects.map((p, i) => `
        <div onclick="flpOpenProject(${i})" style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px 18px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px;transition:background .15s" onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background='var(--card-bg)'">
          <div>
            <div style="font-size:16px;font-weight:600;color:var(--text-1)">${esc(p.name||'بدون عنوان')}</div>
            <div style="font-size:12px;color:var(--subtext);margin-top:4px">${(p.shots||[]).length} مشهد</div>
          </div>
          <div style="font-size:20px;color:var(--subtext)">‹</div>
        </div>`).join('');
    }

    // Show folder link page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('folderLinkPage').style.display = '';
    document.getElementById('folderLinkPage').classList.add('active');
    document.getElementById('topLeft').innerHTML = `
      <button class="back-btn" onclick="flpGoBack()">‹ العودة</button>
      <div class="tb-divider"></div>
      <span class="topbar-title">${esc(linkData.folderName||'ملف مشترك')}</span>`;
    document.getElementById('topRight').innerHTML = `<span style="font-size:12px;color:var(--subtext)">👁 عرض فقط</span>`;
  } catch(e) {
    console.error('openFolderLink:', e);
    _showToast('تعذّر تحميل الملف المشترك.', 'error');
    setTimeout(() => location.href = location.pathname, 2500);
  }
}

function flpOpenProject(idx) {
  const p = _flpProjects[idx];
  if (!p) return;
  document.getElementById('folderLinkPage').classList.remove('active');
  document.getElementById('folderLinkPage').style.display = 'none';
  _viewOnlyData = p;
  renderViewOnly(p);
  // Override back button to return to folder list
  const backToFolder = () => {
    document.getElementById('projectPage').classList.remove('active');
    document.getElementById('folderLinkPage').style.display = '';
    document.getElementById('folderLinkPage').classList.add('active');
    document.getElementById('topLeft').innerHTML = `
      <button class="back-btn" onclick="flpGoBack()">‹ العودة</button>
      <div class="tb-divider"></div>
      <span class="topbar-title">${esc(document.getElementById('flpFolderName').textContent)}</span>`;
    document.getElementById('topRight').innerHTML = `<span style="font-size:12px;color:var(--subtext)">👁 عرض فقط</span>`;
    document.getElementById('viewonlyBanner').style.display = 'none';
  };
  // Replace topLeft back button
  setTimeout(() => {
    const btn = document.querySelector('#topLeft .back-btn');
    if (btn) btn.onclick = backToFolder;
  }, 50);
}

function flpGoBack() {
  document.getElementById('folderLinkPage').classList.remove('active');
  document.getElementById('folderLinkPage').style.display = 'none';
  location.href = location.pathname;
}

// ══════════════════════════════════════════
//  FOLDER SHARING
// ══════════════════════════════════════════

// In-memory state for shared-with-me folders
let _sharedFolders = []; // [{folderId, ownerUid, ownerEmail, ownerName, folderName, role, open, projects:[]}]
let _fshFolderId = null; // folder currently open in share modal

// Called on sign-in to persist user profile for email lookup
async function saveUserProfile(user) {
  if (!user) return;
  try {
    await setDoc(doc(db, 'userProfiles', user.uid), {
      email: (user.email || '').toLowerCase(),
      displayName: user.displayName || '',
      photoURL: user.photoURL || ''
    }, { merge: true });
  } catch(e) { console.warn('saveUserProfile:', e); }
}

// Look up user by email in userProfiles
async function lookupUserByEmail(email) {
  const snap = await getDocs(query(collection(db, 'userProfiles'), where('email', '==', email.toLowerCase().trim())));
  if (snap.empty) return null;
  return { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

// Load folders shared WITH me
async function loadMySharedFolders() {
  if (!fbUser) return;
  try {
    const snap = await getDoc(doc(db, 'userShares', fbUser.uid));
    const list = snap.exists() ? (snap.data().list || []) : [];
    const results = [];
    for (const entry of list) {
      try {
        // Load projects from owner's collection for this folder
        const projSnap = await getDocs(query(
          collection(db, 'users', entry.ownerUid, 'projects'),
          where('folderId', '==', entry.folderId)
        ));
        const projects = projSnap.docs.map(d => ({
          ...d.data(), _ownerUid: entry.ownerUid, _role: entry.role
        }));
        results.push({
          folderId: entry.folderId,
          ownerUid: entry.ownerUid,
          ownerEmail: entry.ownerEmail || '',
          ownerName: entry.ownerName || '',
          folderName: entry.folderName,
          role: entry.role,
          open: true,
          projects
        });
      } catch(e) { console.warn('loadMySharedFolders entry:', e); }
    }
    _sharedFolders = results;
  } catch(e) { console.warn('loadMySharedFolders:', e); }
}

// Open folder share management modal
async function openFolderShare(folderId) {
  if (!fbUser) { _showToast('يجب تسجيل الدخول أولاً', 'error'); return; }
  const folders = loadFolders();
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;
  _fshFolderId = folderId;
  document.getElementById('fshFolderName').textContent = folder.name;
  document.getElementById('fshEmail').value = '';
  document.getElementById('fshStatus').textContent = '';
  document.getElementById('fshStatus').className = 'fsh-status';
  document.getElementById('fshLinkStatus').textContent = '';
  document.getElementById('fshLinkRow').style.display = 'none';
  document.getElementById('fshLinkRevokeBtn').style.display = 'none';
  document.getElementById('fshLinkGenBtn').textContent = 'إنشاء رابط';
  document.getElementById('folderShareOverlay').style.display = 'flex';
  await _fshLoadMembers(folderId);
  await _fshLoadLink(folderId);
}

async function _fshLoadLink(folderId) {
  try {
    const snap = await getDoc(doc(db, 'folderShares', folderId));
    if (!snap.exists()) return;
    const linkId = snap.data().publicLinkId;
    if (linkId) _fshShowLink(linkId);
  } catch(e) { console.warn('_fshLoadLink:', e); }
}

function _fshShowLink(linkId) {
  const url = location.origin + location.pathname + '?folderLink=' + linkId;
  document.getElementById('fshLinkInput').value = url;
  document.getElementById('fshLinkRow').style.display = 'flex';
  document.getElementById('fshLinkRevokeBtn').style.display = '';
  document.getElementById('fshLinkGenBtn').textContent = 'تجديد الرابط';
}

async function fshGenerateLink() {
  if (!_fshFolderId || !fbUser) return;
  const st = document.getElementById('fshLinkStatus');
  st.textContent = 'جارٍ الإنشاء...'; st.className = 'fsh-status';
  try {
    const folders = loadFolders();
    const folder = folders.find(f => f.id === _fshFolderId);
    const linkId = secureId();
    // Store link metadata
    await setDoc(doc(db, 'sharedFolderLinks', linkId), {
      shareId: linkId,
      ownerUid: fbUser.uid,
      ownerName: fbUser.displayName || fbUser.email,
      folderId: _fshFolderId,
      folderName: folder?.name || '',
      createdAt: Date.now()
    });
    // Mark folder as having a public link
    const shareRef = doc(db, 'folderShares', _fshFolderId);
    await setDoc(shareRef, {
      publicLinkEnabled: true,
      publicLinkId: linkId,
      ownerUid: fbUser.uid,
      folderId: _fshFolderId,
      folderName: folder?.name || ''
    }, { merge: true });
    _fshShowLink(linkId);
    st.textContent = '✓ الرابط جاهز'; st.className = 'fsh-status ok';
  } catch(e) {
    st.textContent = 'خطأ: ' + (e.message || e.code); st.className = 'fsh-status err';
  }
}

async function fshRevokeLink() {
  if (!_fshFolderId || !await _showConfirm('إلغاء رابط المشاركة؟', { destructive: true, confirmLabel: 'إلغاء الرابط' })) return;
  const st = document.getElementById('fshLinkStatus');
  try {
    const snap = await getDoc(doc(db, 'folderShares', _fshFolderId));
    if (snap.exists() && snap.data().publicLinkId) {
      await deleteDoc(doc(db, 'sharedFolderLinks', snap.data().publicLinkId)).catch(() => {});
    }
    await setDoc(doc(db, 'folderShares', _fshFolderId), {
      publicLinkEnabled: false,
      publicLinkId: null
    }, { merge: true });
    document.getElementById('fshLinkRow').style.display = 'none';
    document.getElementById('fshLinkRevokeBtn').style.display = 'none';
    document.getElementById('fshLinkGenBtn').textContent = 'إنشاء رابط';
    st.textContent = 'تم إلغاء الرابط'; st.className = 'fsh-status';
  } catch(e) {
    st.textContent = 'خطأ: ' + (e.message || e.code); st.className = 'fsh-status err';
  }
}

function fshCopyLink() {
  const val = document.getElementById('fshLinkInput').value;
  if (!val) return;
  navigator.clipboard.writeText(val).catch(() => {});
  const st = document.getElementById('fshLinkStatus');
  st.textContent = '✓ تم نسخ الرابط'; st.className = 'fsh-status ok';
  setTimeout(() => { if (st.textContent.includes('نسخ')) st.textContent = ''; }, 2000);
}

function closeFolderShare() {
  document.getElementById('folderShareOverlay').style.display = 'none';
  _fshFolderId = null;
}

async function _fshLoadMembers(folderId) {
  const membersEl = document.getElementById('fshMembers');
  membersEl.innerHTML = '<div style="color:var(--text-3);font-size:13px">جارٍ التحميل...</div>';
  try {
    const snap = await getDoc(doc(db, 'folderShares', folderId));
    if (!snap.exists()) {
      membersEl.innerHTML = '<div style="color:var(--text-3);font-size:13px">لا يوجد أعضاء بعد</div>';
      return;
    }
    _fshRenderMembers(snap.data());
  } catch(e) {
    console.error('_fshLoadMembers:', e);
    membersEl.innerHTML = `<div style="color:var(--red);font-size:13px">خطأ في التحميل: ${e.message}</div>`;
  }
}

function _fshRenderMembers(shareData) {
  const membersEl = document.getElementById('fshMembers');
  const members = shareData.members || [];
  const pending = shareData.pendingEmails || [];
  if (members.length === 0 && pending.length === 0) {
    membersEl.innerHTML = '<div style="color:var(--text-3);font-size:13px">لا يوجد أعضاء بعد</div>';
    return;
  }
  const activeHtml = members.map(m => `
    <div class="fsh-member-row">
      <div class="fsh-member-avatar">
        ${m.photoURL ? `<img src="${esc(m.photoURL)}" onerror="this.parentElement.textContent='👤'">` : '👤'}
      </div>
      <div class="fsh-member-info">
        <div class="fsh-member-name">${esc(m.displayName || _emailToDisplay(m.email) || m.email)}</div>
        <div class="fsh-member-email">${esc(_emailToDisplay(m.email))}</div>
      </div>
      <select class="fsh-role-badge" onchange="fshChangeRole('${m.uid}',this.value)">
        <option value="editor" ${m.role==='editor'?'selected':''}>محرر</option>
        <option value="viewer" ${m.role==='viewer'?'selected':''}>مشاهد</option>
      </select>
      <button class="fsh-remove-btn" onclick="fshRemoveMember('${m.uid}')" title="إزالة" aria-label="إزالة العضو">✕</button>
    </div>
  `).join('');

  const pendingHtml = pending.map(p => `
    <div class="fsh-member-row" style="opacity:0.65">
      <div class="fsh-member-avatar" style="font-size:18px">✉️</div>
      <div class="fsh-member-info">
        <div class="fsh-member-name">${esc(_emailToDisplay(p.email))}</div>
        <div class="fsh-member-email">في انتظار التسجيل</div>
      </div>
      <span class="fsh-owner-badge">${p.role === 'editor' ? 'محرر' : 'مشاهد'}</span>
      <button class="fsh-remove-btn" onclick="fshRemovePending('${esc(p.email)}')" title="إلغاء الدعوة" aria-label="إلغاء الدعوة">✕</button>
    </div>
  `).join('');

  membersEl.innerHTML = activeHtml + pendingHtml;
}

// Convert username input to internal email for lookup
function _usernameToEmail(input) {
  const v = input.trim().toLowerCase();
  // If already looks like a real email (contains @ but not @mersad.app), keep as-is
  if (v.includes('@') && !v.endsWith('@mersad.app')) return v;
  // Strip @mersad.app if typed, or append it
  return v.replace(/@mersad\.app$/, '') + '@mersad.app';
}

// Show friendly name instead of internal email
function _emailToDisplay(email) {
  if (!email) return '';
  if (email.endsWith('@mersad.app')) return email.replace('@mersad.app', '');
  return email;
}

async function fshInvite() {
  const rawInput = document.getElementById('fshEmail').value.trim();
  const email    = _usernameToEmail(rawInput);
  const role     = document.getElementById('fshRole').value;
  const status   = document.getElementById('fshStatus');
  if (!rawInput || !_fshFolderId) return;
  status.className = 'fsh-status';
  status.textContent = 'جارٍ البحث...';

  if (email === fbUser.email?.toLowerCase()) {
    status.className = 'fsh-status err';
    status.textContent = 'لا يمكنك دعوة نفسك.';
    return;
  }

  try {
    const folders = loadFolders();
    const folder = folders.find(f => f.id === _fshFolderId);
    const folderName = folder?.name || '';

    // Get current share doc
    const shareRef = doc(db, 'folderShares', _fshFolderId);
    const shareSnap = await getDoc(shareRef);
    let members    = shareSnap.exists() ? (shareSnap.data().members    || []) : [];
    let memberUids = shareSnap.exists() ? (shareSnap.data().memberUids || []) : [];
    let editorUids = shareSnap.exists() ? (shareSnap.data().editorUids || []) : [];

    // Look up the user by email in userProfiles
    const userSnap = await getDocs(query(collection(db, 'userProfiles'), where('email', '==', email)));

    if (userSnap.empty) {
      // ── User not found → store as pending invite ──
      const pendingRef = doc(db, 'pendingInvites', email);
      const pendingSnap = await getDoc(pendingRef).catch(() => null);
      let pendingList = pendingSnap?.exists() ? (pendingSnap.data().invites || []) : [];
      pendingList = pendingList.filter(e => e.folderId !== _fshFolderId);
      pendingList.push({
        folderId: _fshFolderId,
        ownerUid: fbUser.uid,
        ownerEmail: fbUser.email,
        ownerName: fbUser.displayName || '',
        folderName,
        role
      });
      await setDoc(pendingRef, { invites: pendingList });

      // Also store in share doc as pending so owner can see
      let pending = shareSnap.exists() ? (shareSnap.data().pendingEmails || []) : [];
      pending = pending.filter(e => e.email !== email);
      pending.push({ email, role });
      await setDoc(shareRef, {
        ownerUid: fbUser.uid,
        ownerEmail: fbUser.email,
        ownerName: fbUser.displayName || '',
        folderId: _fshFolderId,
        folderName,
        members,
        memberUids,
        editorUids,
        pendingEmails: pending
      }, { merge: true });

      status.className = 'fsh-status ok';
      status.textContent = `✓ تم إرسال دعوة إلى ${email} — ستُفعَّل عند أول تسجيل دخول له`;
      document.getElementById('fshEmail').value = '';
      _fshRenderMembers({ members, pendingEmails: pending });
      return;
    }

    // ── User found ──
    const memberUid  = userSnap.docs[0].id;
    const memberData = userSnap.docs[0].data();

    // Remove existing entry for this member/pending if any
    members    = members.filter(m => m.uid !== memberUid);
    memberUids = memberUids.filter(u => u !== memberUid);
    editorUids = editorUids.filter(u => u !== memberUid);
    let pending = shareSnap.exists() ? (shareSnap.data().pendingEmails || []) : [];
    pending = pending.filter(e => e.email !== email);

    // Add new entry
    const newMember = {
      uid: memberUid,
      email: memberData.email,
      displayName: memberData.displayName || '',
      photoURL: memberData.photoURL || '',
      role
    };
    members.push(newMember);
    memberUids.push(memberUid);
    if (role === 'editor') editorUids.push(memberUid);

    // Save folderShares doc
    await setDoc(shareRef, {
      ownerUid: fbUser.uid,
      ownerEmail: fbUser.email,
      ownerName: fbUser.displayName || '',
      folderId: _fshFolderId,
      folderName,
      members,
      memberUids,
      editorUids,
      pendingEmails: pending
    }, { merge: true });

    // Update member's userShares so they can discover this folder
    const userShareRef = doc(db, 'userShares', memberUid);
    const userShareSnap = await getDoc(userShareRef);
    let userShareList = userShareSnap.exists() ? (userShareSnap.data().list || []) : [];
    userShareList = userShareList.filter(e => e.folderId !== _fshFolderId);
    userShareList.push({ folderId: _fshFolderId, ownerUid: fbUser.uid, ownerEmail: fbUser.email, ownerName: fbUser.displayName || '', folderName, role });
    await setDoc(userShareRef, { list: userShareList });

    status.className = 'fsh-status ok';
    status.textContent = `✓ تمت دعوة ${memberData.displayName || email} كـ${role === 'editor' ? 'محرر' : 'مشاهد'}`;
    document.getElementById('fshEmail').value = '';
    _fshRenderMembers({ members, pendingEmails: pending });
  } catch(e) {
    console.error('fshInvite:', e);
    status.className = 'fsh-status err';
    status.textContent = 'خطأ: ' + (e.message || e.code);
  }
}

async function fshChangeRole(memberUid, newRole) {
  if (!_fshFolderId) return;
  try {
    const shareRef = doc(db, 'folderShares', _fshFolderId);
    const shareSnap = await getDoc(shareRef);
    if (!shareSnap.exists()) return;
    const data = shareSnap.data();
    const members = data.members.map(m => m.uid === memberUid ? { ...m, role: newRole } : m);
    let editorUids = members.filter(m => m.role === 'editor').map(m => m.uid);

    await setDoc(shareRef, { members, editorUids }, { merge: true });

    // Update member's userShares role
    const userShareRef = doc(db, 'userShares', memberUid);
    const userShareSnap = await getDoc(userShareRef);
    if (userShareSnap.exists()) {
      const list = (userShareSnap.data().list || []).map(e =>
        e.folderId === _fshFolderId ? { ...e, role: newRole } : e
      );
      await setDoc(userShareRef, { list });
    }
  } catch(e) { console.error('fshChangeRole:', e); }
}

async function fshRemoveMember(memberUid) {
  if (!_fshFolderId || !await _showConfirm('إزالة هذا العضو؟', { destructive: true, confirmLabel: 'إزالة' })) return;
  try {
    const shareRef = doc(db, 'folderShares', _fshFolderId);
    const shareSnap = await getDoc(shareRef);
    if (!shareSnap.exists()) return;
    const data = shareSnap.data();
    const members = data.members.filter(m => m.uid !== memberUid);
    const memberUids = members.map(m => m.uid);
    const editorUids = members.filter(m => m.role === 'editor').map(m => m.uid);

    await setDoc(shareRef, { members, memberUids, editorUids }, { merge: true });

    // Remove from member's userShares
    const userShareRef = doc(db, 'userShares', memberUid);
    const userShareSnap = await getDoc(userShareRef);
    if (userShareSnap.exists()) {
      const list = (userShareSnap.data().list || []).filter(e => e.folderId !== _fshFolderId);
      await setDoc(userShareRef, { list });
    }

    _fshRenderMembers({ members });
    const status = document.getElementById('fshStatus');
    status.className = 'fsh-status ok';
    status.textContent = '✓ تم إزالة العضو';
  } catch(e) {
    console.error('fshRemoveMember:', e);
  }
}

async function fshRemovePending(email) {
  if (!_fshFolderId || !await _showConfirm('إلغاء دعوة ' + email + '؟', { destructive: true, confirmLabel: 'إلغاء الدعوة' })) return;
  try {
    const shareRef = doc(db, 'folderShares', _fshFolderId);
    const shareSnap = await getDoc(shareRef);
    if (!shareSnap.exists()) return;
    const data = shareSnap.data();
    const pendingEmails = (data.pendingEmails || []).filter(e => e.email !== email);
    await setDoc(shareRef, { pendingEmails }, { merge: true });
    // Also remove from pendingInvites collection
    try {
      const pendingRef = doc(db, 'pendingInvites', email);
      const pendingSnap = await getDoc(pendingRef);
      if (pendingSnap.exists()) {
        const invites = (pendingSnap.data().invites || []).filter(e => e.folderId !== _fshFolderId);
        await setDoc(pendingRef, { invites });
      }
    } catch(e) {}
    _fshRenderMembers({ ...data, pendingEmails });
  } catch(e) { console.error('fshRemovePending:', e); }
}

// Process pending invitations for this user's email on login
async function processPendingInvites(user) {
  if (!user?.email) return;
  try {
    const pendingRef = doc(db, 'pendingInvites', user.email.toLowerCase());
    const pendingSnap = await getDoc(pendingRef);
    if (!pendingSnap.exists()) return;
    const invites = pendingSnap.data().invites || [];
    if (invites.length === 0) return;

    // For each pending invite: add to userShares and update folderShares
    const userShareRef = doc(db, 'userShares', user.uid);
    const userShareSnap = await getDoc(userShareRef);
    let userShareList = userShareSnap.exists() ? (userShareSnap.data().list || []) : [];

    for (const invite of invites) {
      // Add to userShares
      userShareList = userShareList.filter(e => e.folderId !== invite.folderId);
      userShareList.push(invite);

      // Update folderShares: move from pending to active member
      try {
        const shareRef = doc(db, 'folderShares', invite.folderId);
        const shareSnap = await getDoc(shareRef);
        if (shareSnap.exists()) {
          const data = shareSnap.data();
          let members    = data.members    || [];
          let memberUids = data.memberUids || [];
          let editorUids = data.editorUids || [];
          let pendingEmails = (data.pendingEmails || []).filter(e => e.email !== user.email.toLowerCase());
          members    = members.filter(m => m.uid !== user.uid);
          memberUids = memberUids.filter(u => u !== user.uid);
          editorUids = editorUids.filter(u => u !== user.uid);
          members.push({ uid: user.uid, email: user.email, displayName: user.displayName || '', photoURL: user.photoURL || '', role: invite.role });
          memberUids.push(user.uid);
          if (invite.role === 'editor') editorUids.push(user.uid);
          await setDoc(shareRef, { members, memberUids, editorUids, pendingEmails }, { merge: true });
        }
      } catch(e) { console.warn('processPendingInvites share update:', e); }
    }

    await setDoc(userShareRef, { list: userShareList });
    // Clear processed invites
    await setDoc(pendingRef, { invites: [] });
  } catch(e) { console.warn('processPendingInvites:', e); }
}

// Toggle shared folder open/close in home
function toggleSharedFolderOpen(folderId) {
  const sf = _sharedFolders.find(s => s.folderId === folderId);
  if (!sf) return;
  sf.open = !sf.open;
  const grid = document.getElementById('fg-sf-' + folderId);
  const btn  = document.getElementById('ft-sf-' + folderId);
  if (grid) grid.style.display = sf.open ? '' : 'none';
  if (btn)  btn.classList.toggle('closed', !sf.open);
}

// Open a shared project for editing/viewing
function openSharedProject(p, sf) {
  cur = JSON.parse(JSON.stringify(p));
  cur._shared = true;
  cur._ownerUid = sf.ownerUid;
  cur._role = sf.role;
  if (sf.role !== 'editor') cur._viewOnly = true;
  timers = {};
  _shotFilter = { done: 'all', face: '', rukn: '', chrono: false };
  if (!cur.segments && cur.shots) {
    cur.segments = [{ id: uid(), title: 'المشاهد', collapsed: false, shots: cur.shots }];
    delete cur.shots;
  } else if (!cur.segments) {
    cur.segments = [];
  }
  document.getElementById('homePage').classList.remove('active');
  document.getElementById('projectPage').classList.add('active');
  fillForm(); renderShots(); updateProgress(); renderTopProject();
  if (sf.role !== 'editor') {
    document.getElementById('viewonlyBanner').style.display = 'flex';
    setTimeout(() => {
      document.querySelectorAll('#projectPage input, #projectPage textarea, #projectPage select').forEach(el => {
        el.setAttribute('readonly', ''); el.style.pointerEvents = 'none';
      });
      document.querySelectorAll('#projectPage button:not(#claimBtn)').forEach(el => el.style.pointerEvents = 'none');
    }, 100);
  }
}

// Create project in a shared folder (editor only)
async function createSharedProject(folderId, ownerUid) {
  const p = { id: uid(), name: '', date: today(), location: '', notes: '', fps: 25, segments: [],
    folderId, _ownerUid: ownerUid, lastModified: Date.now() };
  await setDoc(doc(db, 'users', ownerUid, 'projects', p.id), p);
  // Add to local shared state and open
  const sf = _sharedFolders.find(s => s.folderId === folderId);
  if (sf) sf.projects.push({ ...p, _role: sf.role });
  cur = JSON.parse(JSON.stringify(p));
  cur._shared = true; cur._ownerUid = ownerUid; cur._role = 'editor';
  timers = {}; _shotFilter = { done: 'all', face: '', rukn: '', chrono: false };
  cur.segments = [];
  document.getElementById('homePage').classList.remove('active');
  document.getElementById('projectPage').classList.add('active');
  fillForm(); renderShots(); updateProgress(); renderTopProject();
}


// ══════════════════════════════════════════
//  TELEPROMPTER
// ══════════════════════════════════════════
let tpCh = null, tpWin = null, tpPlaying = false;
let tpSpeed = 1, tpFontSize = 52, tpScrollY = 0, tpShotId = null;
let tpMirror = true;

function tpSend(msg) {
  tpGetCh().postMessage(msg);
  if (tpWin && !tpWin.closed) tpWin.postMessage(msg, '*');
}

function tpGetCh() {
  if (!tpCh) {
    tpCh = new BroadcastChannel('musawwir-teleprompter');
    tpCh.onmessage = ({ data: d }) => {
      if (d.cmd === 'pos' && !tpPlaying) {
        const sc = document.getElementById('sfTpScroll');
        if (!sc) return;
        const max = sc.scrollHeight - sc.clientHeight;
        if (max > 0) { tpScrollY = d.pct * max; sc.scrollTop = tpScrollY; }
      }
      if (d.cmd === 'play'  && !tpPlaying) tpTogglePlay();
      if (d.cmd === 'pause' &&  tpPlaying) tpTogglePlay();
      if (d.cmd === 'reset') tpReset();
    };
  }
  return tpCh;
}

function openTp() {
  tpShotId = sfShotId;
  const s = _findShot(sfShotId);
  if (!s) return;
  tpPlaying = false; tpScrollY = 0;
  const el = document.getElementById('sfTpText');
  const baseContent = s.contentRich ? sanitizeRichHTML(s.contentRich) : (s.content ? `<p>${esc(s.content)}</p>` : '');
  el.innerHTML = baseContent;
  el.style.fontSize = tpFontSize + 'px';
  document.getElementById('sfTpScroll').scrollTop = 0;
  tpSyncControls();
  const panel = document.getElementById('sfTpPanel');
  panel.style.display = 'flex';
  tpSend({ cmd: 'load', text: s.contentRich ? sanitizeRichHTML(s.contentRich) : (s.content || ''), fontSize: tpFontSize, speed: tpSpeed });
}

function closeTp() {
  tpPlaying = false;
  document.getElementById('sfTpPanel').style.display = 'none';
  tpSend({ cmd: 'pause' });
}

function tpSyncControls() {
  const txt = tpPlaying ? '⏸ إيقاف' : '▶ تشغيل';
  ['sfTpPlayBtnT', 'sfTpPlayBtnB'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = txt; el.classList.toggle('active', tpPlaying); }
  });
  ['sfTpSpeedValT', 'sfTpSpeedValB'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = tpSpeed.toFixed(1) + 'x';
  });
  ['sfTpSpeedSliderT', 'sfTpSpeedSliderB'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = tpSpeed;
  });
  ['sfTpFontValT', 'sfTpFontValB'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = tpFontSize + 'px';
  });
  ['sfTpFontSliderT', 'sfTpFontSliderB'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = tpFontSize;
  });
}

function tpTogglePlay() {
  tpPlaying = !tpPlaying;
  tpSyncControls();
  tpSend({ cmd: tpPlaying ? 'play' : 'pause' });
  if (tpPlaying) tpTick();
}

function tpTick() {
  if (!tpPlaying) return;
  const el = document.getElementById('sfTpScroll');
  tpScrollY += tpSpeed * 0.6;
  if (tpScrollY > el.scrollHeight - el.clientHeight) {
    tpScrollY = el.scrollHeight - el.clientHeight;
    el.scrollTop = tpScrollY;
    tpPlaying = false; tpSyncControls();
    tpSend({ cmd: 'pause' });
    return;
  }
  el.scrollTop = tpScrollY;
  const max = el.scrollHeight - el.clientHeight;
  if (max > 0) tpSend({ cmd: 'pos', pct: tpScrollY / max });
  requestAnimationFrame(tpTick);
}

function tpReset() {
  tpPlaying = false; tpScrollY = 0;
  document.getElementById('sfTpScroll').scrollTop = 0;
  tpSyncControls();
  tpSend({ cmd: 'reset' });
}

function tpSetSpeed(v) {
  tpSpeed = parseFloat(v);
  tpSyncControls();
  tpSend({ cmd: 'speed', val: tpSpeed });
}

function tpSetFont(v) {
  tpFontSize = parseInt(v);
  document.getElementById('sfTpText').style.fontSize = tpFontSize + 'px';
  tpSyncControls();
  tpSend({ cmd: 'fontSize', val: tpFontSize });
}

function tpSetLineSize(v) {
  const px = parseInt(v);
  const line = document.querySelector('.sf-tp-reading-line');
  if (line) line.style.height = px + 'px';
  const lbl = document.getElementById('sfTpLineVal');
  if (lbl) lbl.textContent = px + 'px';
  const slider = document.getElementById('sfTpLineSlider');
  if (slider) slider.value = px;
  tpSend({ cmd: 'lineSize', val: px });
}

let _tpScrollTimer = null;
function tpStartScroll(dir) {
  tpStopScroll();
  tpSend({ cmd: 'scrollStart', dir });
  const step = () => {
    const el = document.getElementById('sfTpScroll');
    if (el) {
      tpScrollY = Math.max(0, el.scrollTop + dir * 4);
      el.scrollTop = tpScrollY;
      const max = el.scrollHeight - el.clientHeight;
      if (max > 0) tpSend({ cmd: 'pos', pct: tpScrollY / max });
    }
    _tpScrollTimer = requestAnimationFrame(step);
  };
  _tpScrollTimer = requestAnimationFrame(step);
}
function tpStopScroll() {
  if (_tpScrollTimer) { cancelAnimationFrame(_tpScrollTimer); _tpScrollTimer = null; }
  tpSend({ cmd: 'scrollStop' });
}

document.addEventListener('keydown', e => {
  const panel = document.getElementById('sfTpPanel');
  if (!panel || panel.style.display === 'none') return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
  if (e.code === 'Escape') {
    const p = document.getElementById('sfTpPanel');
    if (p && p.classList.contains('tp-css-fullscreen')) { p.classList.remove('tp-css-fullscreen'); }
  } else if (e.code === 'Space') {
    e.preventDefault();
    tpTogglePlay();
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    const el = document.getElementById('sfTpScroll');
    if (el) { tpScrollY = Math.min(tpScrollY + 60, el.scrollHeight - el.clientHeight); el.scrollTop = tpScrollY; }
  } else if (e.code === 'ArrowUp') {
    e.preventDefault();
    const el = document.getElementById('sfTpScroll');
    if (el) { tpScrollY = Math.max(tpScrollY - 60, 0); el.scrollTop = tpScrollY; }
  }
});

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    const el = document.getElementById('sfTpPanel');
    if (el) el.classList.remove('tp-css-fullscreen');
  }
});

function tpFullscreen() {
  const el = document.getElementById('sfTpPanel');
  if (!el) return;
  const isCssFull = el.classList.contains('tp-css-fullscreen');
  // Try native Fullscreen API first; fall back to CSS fullscreen (works on iOS/mobile)
  if (!document.fullscreenElement && !isCssFull) {
    const req = el.requestFullscreen ? el.requestFullscreen() : Promise.reject();
    req.catch(() => { el.classList.add('tp-css-fullscreen'); });
  } else if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    el.classList.remove('tp-css-fullscreen');
  }
}

function tpOpenDisplay() {
  tpWin = window.open('/teleprompter.html', 'tp_display', 'width=1024,height=768');
  const s = tpShotId ? _findShot(tpShotId) : null;
  setTimeout(() => {
    tpSend({ cmd: 'mirror', on: tpMirror });
    if (s) tpSend({ cmd: 'load', text: s.contentRich ? sanitizeRichHTML(s.contentRich) : (s.content || ''), fontSize: tpFontSize, speed: tpSpeed });
  }, 800);
}

function tpToggleMirror() {
  tpMirror = !tpMirror;
  tpSend({ cmd: 'mirror', on: tpMirror });
  const btn = document.getElementById('sfTpMirrorBtn');
  if (btn) {
    btn.textContent = tpMirror ? '🪞 معكوس' : '🔄 طبيعي';
    btn.classList.toggle('sf-active', !tpMirror);
  }
}

// ── Table View ──
let _tableView = JSON.parse(localStorage.getItem('sm_tableView') || 'false');
let _tableSort = localStorage.getItem('sm_tableSort') || 'order';
const _colVisDefault = { title: true, content: true, shooting: false, editMusic: false, face: true, files: true, done: true };
let _tableColVis = Object.assign({}, _colVisDefault, JSON.parse(localStorage.getItem('sm_tableColVis') || '{}'));
const _colWidthDefault = { title: 140, content: 300, shooting: 160, editMusic: 160, face: 120, files: 160 };
let _tableColWidths = Object.assign({}, _colWidthDefault, JSON.parse(localStorage.getItem('sm_tableColWidths') || '{}'));

function toggleColDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('sfColDropdown');
  const btn = document.getElementById('sfColBtn');
  if (!dd) return;
  Object.keys(_tableColVis).forEach(k => {
    const cb = document.getElementById('sfCol-' + k);
    if (cb) cb.checked = _tableColVis[k];
  });
  const isOpen = dd.classList.contains('open');
  if (!isOpen && btn) {
    const r = btn.getBoundingClientRect();
    dd.style.top   = (r.bottom + 6) + 'px';
    dd.style.left  = 'auto';
    dd.style.right = (window.innerWidth - r.right) + 'px';
  }
  dd.classList.toggle('open', !isOpen);
  if (btn) btn.classList.toggle('sf-active', !isOpen);
}

function setColVis(col, visible) {
  _tableColVis[col] = visible;
  localStorage.setItem('sm_tableColVis', JSON.stringify(_tableColVis));
  renderShots();
}

document.addEventListener('click', () => {
  const dd = document.getElementById('sfColDropdown');
  if (dd && dd.classList.contains('open')) {
    dd.classList.remove('open');
    const btn = document.getElementById('sfColBtn');
    if (btn) btn.classList.remove('sf-active');
  }
});



function buildTableViewHTML() {
  const segs = cur.segments || [];
  const ruknList = _getRuknList();
  const ruknOpts = (val) => ruknList.map(r=>`<option value="${r}" ${val===r?'selected':''}>${r}</option>`).join('');
  const { done: fDone, face: fFace, rukn: fRukn } = _shotFilter;
  const hasFilter = fDone !== 'all' || fFace || fRukn;

  let rows = '';
  let globalIdx = 0;
  segs.forEach(seg => {
    // filter shots for this segment
    let visibleShots = seg.shots;
    if (fDone === 'done')    visibleShots = visibleShots.filter(s => s.done);
    if (fDone === 'pending') visibleShots = visibleShots.filter(s => !s.done);
    if (fFace)               visibleShots = visibleShots.filter(s => (s.face||'').trim() === fFace);
    if (fRukn && (seg.rukn||'').trim() !== fRukn) visibleShots = [];
    if (hasFilter && !visibleShots.length) return; // skip segments with no matching shots

    const isCol = !!seg.collapsed;
    const totalShots = seg.shots.length;
    const doneShots = seg.shots.filter(s=>s.done).length;
    const pendingShots = totalShots - doneShots;
    const segRuknOpts = ruknList.map(r=>`<option value="${r}" ${(seg.rukn||'')===r?'selected':''}>${r}</option>`).join('');
    const {val: segFaceVal, ph: segFacePh} = _segFaceLabel(seg);
    const cv = _tableColVis;
    const colspanInfo = Math.max(1, (cv.title?1:0)+(cv.content?1:0)+(cv.shooting?1:0)+(cv.editMusic?1:0)+(cv.face?1:0));
    const colspanProg = Math.max(1, (cv.files?1:0)+(cv.done?1:0));
    rows += `<tr class="st-seg-row" onclick="stToggleSeg('${seg.id}')" style="cursor:pointer">
      <td style="white-space:nowrap;width:36px">
        <span id="st-arr-${seg.id}" style="display:inline-block;transition:transform .2s;transform:${isCol?'rotate(-90deg)':'rotate(0)'}">▾</span>
      </td>
      <td colspan="${colspanInfo}" style="white-space:nowrap" onclick="event.stopPropagation()">
        <span style="margin-left:4px">🎬</span>
        <input value="${esc(seg.title||'')}" placeholder="اسم المقطع"
          oninput="setSegTitle('${seg.id}',this.value)" onchange="autoSave()"
          style="background:transparent;border:none;outline:none;font-weight:600;font-size:inherit;color:var(--accent);width:auto;min-width:80px;max-width:180px;cursor:text;font-family:inherit">
        ${ruknList.length ? `<span style="color:var(--border);margin:0 4px">|</span>
        <select class="st-rukn-sel" style="font-size:12px;padding:2px 6px;border-radius:5px;max-width:120px" onchange="setSegRukn('${seg.id}',this.value);autoSave()">
          <option value="" ${!seg.rukn?'selected':''}>— ${_getRuknLabel()} —</option>${segRuknOpts}
        </select>` : ''}
        ${_isHatemFolder() ? '' : `<span style="color:var(--border);margin:0 4px">|</span>
        <input id="st-seg-face-${seg.id}" class="st-cell-input st-face-input"
          value="${esc(segFaceVal)}" placeholder="${segFacePh}"
          oninput="setSegFaceAll('${seg.id}',this.value)" onchange="autoSave()"
          style="font-size:11px;padding:2px 6px;width:auto;min-width:60px;max-width:120px;display:inline-block">`}
      </td>
      <td colspan="${colspanProg}" style="padding:4px 12px" onclick="event.stopPropagation()">
        <div style="display:flex;align-items:center;gap:8px;direction:rtl">
          <span id="st-prog-count-${seg.id}" style="font-size:12px;font-weight:700;color:var(--green);white-space:nowrap">${doneShots} / ${totalShots}</span>
          <div style="flex:1;min-width:60px;height:5px;background:rgba(52,199,89,0.18);border-radius:3px;overflow:hidden">
            <div id="st-prog-fill-${seg.id}" style="height:100%;width:100%;background:var(--green);border-radius:3px;transform:scaleX(${totalShots?doneShots/totalShots:0});transform-origin:right;transition:transform 0.4s;box-shadow:0 0 6px var(--green-glow)"></div>
          </div>
        </div>
      </td></tr>`;
    const cw = _tableColWidths;
    rows += `<tr class="st-seg-sub-${seg.id} st-header-row" style="display:${isCol?'none':''}">
      <th style="width:36px">#</th>
      ${cv.title     ? `<th><span>المشهد</span><div class="st-col-resize" onmousedown="stColResizeStart(event,'title')"></div></th>`   : ''}
      ${cv.content   ? `<th><span>المحتوى</span><div class="st-col-resize" onmousedown="stColResizeStart(event,'content')"></div></th>` : ''}
      ${cv.shooting  ? `<th><span>التصوير</span><div class="st-col-resize" onmousedown="stColResizeStart(event,'shooting')"></div></th>` : ''}
      ${cv.editMusic ? `<th><span>المونتاج</span><div class="st-col-resize" onmousedown="stColResizeStart(event,'editMusic')"></div></th>`: ''}
      ${cv.face      ? `<th><span>الوجه</span><div class="st-col-resize" onmousedown="stColResizeStart(event,'face')"></div></th>`    : ''}
      ${cv.files     ? `<th><span>الملفات</span><div class="st-col-resize" onmousedown="stColResizeStart(event,'files')"></div></th>` : ''}
      ${cv.done      ? `<th style="width:44px">✓</th>`       : ''}
    </tr>`;

    const sortedShots = [...visibleShots];
    if (_tableSort === 'face') sortedShots.sort((a,b)=>(a.face||'').localeCompare(b.face||'','ar'));
    else if (_tableSort === 'rukn') sortedShots.sort((a,b)=>(a.rukn||'').localeCompare(b.rukn||'','ar'));
    else if (_tableSort === 'done') sortedShots.sort((a,b)=>Number(a.done||false)-Number(b.done||false));
    sortedShots.forEach(s => {
      globalIdx++;
      rows += `<tr class="st-seg-sub-${seg.id} ${s.done?'done-row':''}" id="str-${s.id}" style="display:${isCol?'none':''};${s._rowHeight?'height:'+s._rowHeight+'px':''}">
        <td class="st-num" title="فتح المشهد" style="cursor:default;user-select:none;position:relative"><div onclick="openShotFull('${s.id}')" style="position:absolute;top:4px;right:4px;font-size:12px;color:var(--text-3);cursor:pointer;line-height:1" title="فتح المشهد">⛶</div><div style="padding-top:18px;font-size:12px;cursor:pointer" onclick="openShotFull('${s.id}')">${globalIdx}</div>
          <div class="st-row-drag" onclick="event.stopPropagation()" onmousedown="stRowResizeStart(event,'${s.id}')" ontouchstart="stRowResizeStart(event,'${s.id}')"></div>
        </td>
        ${cv.title ? `<td><textarea class="st-cell-input st-title-input" placeholder="عنوان المشهد" rows="1"
          style="${s._rowHeight?'height:'+(s._rowHeight-20)+'px':''}"
          oninput="stSet('${s.id}','title',this.value);if(!this.closest('tr').style.height){this.style.height='auto';this.style.height=this.scrollHeight+'px'}" onchange="autoSave()">${esc(s.title||'')}</textarea></td>` : ''}
        ${cv.content ? `<td><textarea class="st-cell-input st-content-input" placeholder="المحتوى"
          style="${s._rowHeight?'height:'+(s._rowHeight-20)+'px':''}"
          oninput="stSet('${s.id}','content',this.value);if(!this.closest('tr').style.height){this.style.height='auto';this.style.height=this.scrollHeight+'px'}" onchange="autoSave()">${esc(s.content||'')}</textarea></td>` : ''}
        ${cv.shooting ? `<td><textarea class="st-cell-input st-content-input" placeholder="الزاوية، الحركة، العدسة..."
          style="${s._rowHeight?'height:'+(s._rowHeight-20)+'px':''}"
          oninput="stSet('${s.id}','shooting',this.value);if(!this.closest('tr').style.height){this.style.height='auto';this.style.height=this.scrollHeight+'px'}" onchange="autoSave()">${esc(s.shooting||'')}</textarea></td>` : ''}
        ${cv.editMusic ? `<td><textarea class="st-cell-input st-content-input" placeholder="المونتاج، الموسيقى..."
          style="${s._rowHeight?'height:'+(s._rowHeight-20)+'px':''}"
          oninput="stSet('${s.id}','editMusic',this.value);if(!this.closest('tr').style.height){this.style.height='auto';this.style.height=this.scrollHeight+'px'}" onchange="autoSave()">${esc(s.editMusic||'')}</textarea></td>` : ''}
        ${cv.face ? `<td>
          <input class="st-cell-input st-face-input" value="${esc(s.face||'')}" placeholder="الوجه"
            oninput="stSet('${s.id}','face',this.value);_refreshSegFaceEl('${seg.id}')" onchange="autoSave()">
        </td>` : ''}
        ${cv.files ? `<td style="padding:0">
          <input class="st-cell-input st-file-input" value="${esc(s.filename||'')}" placeholder="A — الرقم"
            oninput="fmtFilename(this,'${s.id}','filename','A')" onchange="autoSave()" inputmode="numeric"
            style="border-bottom:1px solid var(--border)">
          <input class="st-cell-input st-file-input" value="${esc(s.filename2||'')}" placeholder="B — الرقم"
            oninput="fmtFilename(this,'${s.id}','filename2','B')" onchange="autoSave()" inputmode="numeric"
            style="border-bottom:1px solid var(--border)">
          <input class="st-cell-input st-file-input" value="${esc(s.filename3||'')}" placeholder="C — الرقم"
            oninput="fmtFilename(this,'${s.id}','filename3','C')" onchange="autoSave()" inputmode="numeric"
            style="border-bottom:1px solid var(--border)">
          <input class="st-cell-input st-file-input" value="${esc(s.filename4||'')}" placeholder="D — الرقم"
            oninput="fmtFilename(this,'${s.id}','filename4','D')" onchange="autoSave()" inputmode="numeric">
        </td>` : ''}
        ${cv.done ? `<td class="st-done-cell">
          <button onclick="stDelShot('${s.id}')" title="حذف المشهد"
            style="position:absolute;top:4px;left:4px;background:none;border:none;cursor:pointer;color:var(--text-3);font-size:13px;padding:2px;line-height:1;min-width:20px;min-height:20px"
            onmouseover="this.style.color='#e55'" onmouseout="this.style.color='var(--text-3)'">✕</button>
          <input type="checkbox" class="st-done-cb" ${s.done?'checked':''}
            onchange="stToggleDone('${s.id}',this.checked)">
        </td>` : ''}
      </tr>`;
    });
  });

  const totalCols = 1 + (_tableColVis.title?1:0) + (_tableColVis.content?1:0) + (_tableColVis.shooting?1:0) + (_tableColVis.editMusic?1:0) + (_tableColVis.face?1:0) + (_tableColVis.files?1:0) + (_tableColVis.done?1:0);
  if (hasFilter && !rows) rows = `<tr><td colspan="${totalCols}" style="text-align:center;padding:28px;color:var(--subtext);font-size:13px">لا توجد نتائج</td></tr>`;

  const cw = _tableColWidths;
  const cv = _tableColVis;
  const colgroup = `<colgroup>
    <col style="width:36px">
    ${cv.title     ? `<col id="stcol-title"     style="width:${cw.title}px">` : ''}
    ${cv.content   ? `<col id="stcol-content"   style="width:${cw.content}px">` : ''}
    ${cv.shooting  ? `<col id="stcol-shooting"  style="width:${cw.shooting}px">` : ''}
    ${cv.editMusic ? `<col id="stcol-editMusic" style="width:${cw.editMusic}px">` : ''}
    ${cv.face      ? `<col id="stcol-face"      style="width:${cw.face}px">` : ''}
    ${cv.files     ? `<col id="stcol-files"     style="width:${cw.files}px">` : ''}
    ${cv.done      ? `<col style="width:44px">` : ''}
  </colgroup>`;
  return `<div class="shots-table-wrap"><table class="shots-table">${colgroup}
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="${totalCols}" style="padding:10px 12px;border-top:1px solid var(--border)">
          <button onclick="addShotToLast()" style="background:transparent;border:1px dashed var(--border);border-radius:8px;color:var(--subtext);font-size:12px;padding:6px 18px;cursor:pointer;width:100%;transition:background .15s" onmouseover="this.style.background='var(--hover)'" onmouseout="this.style.background='transparent'">+ إضافة مشهد</button>
        </td>
      </tr>
    </tfoot>
  </table></div>`;
}

function stSet(shotId, field, val) {
  const s = _findShot(shotId); if (!s) return;
  s[field] = val;
}

async function stDelShot(shotId) {
  if (!await _showConfirm('حذف هذا المشهد؟', { destructive: true, confirmLabel: 'حذف' })) return;
  let deletedShot = null, parentSegTitle = '';
  for (const seg of (cur.segments||[])) {
    const sh = seg.shots.find(s => s.id === shotId);
    if (sh) { deletedShot = sh; parentSegTitle = seg.title||''; break; }
  }
  for (const seg of (cur.segments||[])) { seg.shots = seg.shots.filter(s => s.id !== shotId); }
  if (deletedShot) {
    if (!cur._trash) cur._trash = {};
    if (!cur._trash.shots) cur._trash.shots = [];
    cur._trash.shots.unshift({ ...deletedShot, _deletedAt: Date.now(), _parentSeg: parentSegTitle });
  }
  const list = document.getElementById('shotsList');
  if (list) list.innerHTML = buildTableViewHTML();
  updateProgress(); autoSave();
}

function stToggleDone(shotId, checked) {
  const s = _findShot(shotId); if (!s) return;
  s.done = checked;
  autoSave();   // persist first, before any UI update that could throw
  const row = document.getElementById('str-'+shotId);
  if (row) row.classList.toggle('done-row', checked);
  // Refresh segment progress in table view
  const seg = (cur.segments||[]).find(sg => sg.shots.some(sh => sh.id === shotId));
  if (seg) {
    const total = seg.shots.length, done = seg.shots.filter(sh=>sh.done).length;
    const fillEl = document.getElementById('st-prog-fill-'+seg.id);
    const countEl = document.getElementById('st-prog-count-'+seg.id);
    if (fillEl) fillEl.style.transform = 'scaleX(' + (total ? done/total : 0) + ')';
    if (countEl) countEl.textContent = done + ' / ' + total;
  }
  updateProgress();   // already persisted at the top of this function
}

function toggleTableView(val) {
  _tableView = val;
  localStorage.setItem('sm_tableView', JSON.stringify(_tableView));
  // Close any open view menus so the button reflects the new mode on next open
  const vm = document.getElementById('viewDropMenu'); if (vm) vm.style.display = 'none';
  const cd = document.getElementById('sfColDropdown'); if (cd) cd.classList.remove('open');
  _updateViewDropBtn();
  const sel = document.getElementById('tableSortSel');
  if (sel) sel.style.display = val ? '' : 'none';
  renderShots();
}

function setTableSort(val) {
  _tableSort = val;
  localStorage.setItem('sm_tableSort', val);
  const list = document.getElementById('shotsList');
  if (list) list.innerHTML = buildTableViewHTML();
}

// ── Text Import ──
let _tiCreateMode = false;
let _tiCreateFolder = null;

function parseTextToImport(text) {
  const lines = text.split('\n');
  const segments = [];
  let curSeg = null, curShot = null;
  for (const line of lines) {
    // Strip leading whitespace and invisible bidi/BOM marks (RLM, LRM, etc.)
    // which RTL keyboards often inject on the first line, breaking the ^# match.
    const stripped = line.replace(/^[\s\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]+/, '');
    const h1 = stripped.match(/^#\s+(.+)/);
    const h2 = stripped.match(/^#{2,4}\s+(.+)/);
    if (h1) {
      curSeg = { title: h1[1].trim(), shots: [] };
      segments.push(curSeg); curShot = null;
    } else if (h2) {
      if (!curSeg) { curSeg = { title: 'مقطع 1', shots: [] }; segments.push(curSeg); }
      curShot = { title: h2[1].trim(), content: '' };
      curSeg.shots.push(curShot);
    } else if (curShot) {
      curShot.content += (curShot.content ? '\n' : '') + line;
    }
  }
  segments.forEach(seg => seg.shots.forEach(sh => { sh.content = sh.content.trim(); }));
  return segments.filter(seg => seg.title || seg.shots.length);
}

function openTextImport(createMode = false, folderId = null) {
  _tiCreateMode = !!createMode;
  _tiCreateFolder = folderId || null;
  document.getElementById('tiText').value = '';
  document.getElementById('tiPreview').style.display = 'none';
  document.getElementById('tiImportBtn').disabled = true;
  document.getElementById('tiTitle').textContent = _tiCreateMode ? '📝 تصوير جديد من نص' : '📝 تحويل نص إلى مشاهد';
  document.getElementById('tiOverlay').style.display = 'flex';
  setTimeout(() => document.getElementById('tiText').focus(), 80);
}

function closeTextImport() {
  document.getElementById('tiOverlay').style.display = 'none';
}

function previewTextImport() {
  const segs = parseTextToImport(document.getElementById('tiText').value);
  const preview = document.getElementById('tiPreview');
  const btn = document.getElementById('tiImportBtn');
  if (!segs.length) { preview.style.display = 'none'; btn.disabled = true; return; }
  btn.disabled = false;
  const totalShots = segs.reduce((n, s) => n + s.shots.length, 0);
  let html = `<strong>سيتم إنشاء ${segs.length} مقطع و ${totalShots} مشهد:</strong><br>`;
  segs.forEach(seg => {
    html += `<div class="ti-seg">📁 ${escHtml(seg.title)} (${seg.shots.length} مشهد)</div>`;
    seg.shots.forEach((sh, i) => { html += `<div class="ti-shot">${i + 1}. ${escHtml(sh.title)}</div>`; });
  });
  preview.innerHTML = html;
  preview.style.display = 'block';
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function doTextImport() {
  const segs = parseTextToImport(document.getElementById('tiText').value);
  if (!segs.length) return;
  const buildSeg = (seg, idx) => ({
    id: uid(), title: seg.title || `مقطع ${idx + 1}`, collapsed: false,
    shots: seg.shots.map(sh => ({
      id: uid(), title: sh.title, done: false, content: sh.content,
      contentRich: '', shooting: '', editMusic: '',
      filename: '', filename2: '', filename3: '', filename4: '', timecodeNotes: [], tcOpen: false, collapsed: false
    }))
  });
  if (_tiCreateMode) {
    const p = { id: uid(), name: '', date: today(), location: '', notes: '', fps: 25,
      segments: segs.map(buildSeg), folderId: _tiCreateFolder, lastModified: Date.now() };
    try { await saveProject(p); } catch(e) { _showToast('أُنشئ محلياً لكن تعذّر رفعه للسحابة — تحقق من الاتصال', 'error', 4000); }
    closeTextImport();
    openProject(p.id);
  } else {
    if (!cur) return;
    if (!cur.segments) cur.segments = [];
    segs.forEach((seg, i) => cur.segments.push(buildSeg(seg, cur.segments.length + i)));
    renderShots(); updateProgress(); autoSave();
    closeTextImport();
  }
}

function stRowResizeStart(e, shotId) {
  e.preventDefault(); e.stopPropagation();
  const tr = document.getElementById('str-' + shotId);
  if (!tr) return;
  const startY = e.touches ? e.touches[0].clientY : e.clientY;
  const startH = tr.offsetHeight;
  function onMove(ev) {
    const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const h = Math.max(54, startH + (y - startY));
    tr.style.height = h + 'px';
    tr.querySelectorAll('textarea').forEach(ta => { ta.style.height = Math.max(32, h - 20) + 'px'; });
  }
  function onEnd() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    const s = _findShot(shotId);
    if (s) { s._rowHeight = parseInt(tr.style.height); autoSave(); }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
}

function stColResizeStart(e, colKey) {
  e.preventDefault(); e.stopPropagation();
  const startX = e.clientX;
  const startW = _tableColWidths[colKey] || _colWidthDefault[colKey] || 120;
  const col = document.getElementById('stcol-' + colKey);
  const handle = e.currentTarget;
  if (handle) handle.classList.add('resizing');
  function onMove(ev) {
    const w = Math.max(60, startW + (ev.clientX - startX));
    _tableColWidths[colKey] = w;
    if (col) col.style.width = w + 'px';
  }
  function onEnd() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    if (handle) handle.classList.remove('resizing');
    localStorage.setItem('sm_tableColWidths', JSON.stringify(_tableColWidths));
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
}

// ══════════════════════════════════════════
//  SCRIPT / CONTENT EDITOR  (Minimal Writer)
// ══════════════════════════════════════════

let _ceWriterTimer = null;
let _ceOpenSnapshot = null;
let _ceForceSaveTimer = null;

function _ceShowUndoToast(snapshot) {
  let container = document.getElementById('_toastContainer');
  if (!container) { container = document.createElement('div'); container.id = '_toastContainer'; document.body.appendChild(container); }
  const el = document.createElement('div');
  el.className = '_toast';
  el.style.cssText = 'display:flex;align-items:center;gap:16px;';
  const msg = document.createElement('span');
  msg.textContent = 'تم الحفظ';
  const btn = document.createElement('button');
  btn.textContent = 'تراجع';
  btn.style.cssText = 'background:none;border:none;color:var(--accent);font:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:0;flex-shrink:0;';
  el.appendChild(msg);
  el.appendChild(btn);
  container.appendChild(el);
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return; dismissed = true;
    el.style.animation = '_toastOut 0.18s var(--ease-out-quart) forwards';
    setTimeout(() => el.remove(), 200);
  };
  btn.addEventListener('click', () => {
    dismiss();
    if (cur) { cur.segments = JSON.parse(JSON.stringify(snapshot)); renderShots(); updateProgress(); autoSave(); }
  });
  setTimeout(dismiss, 7000);
}

function openContentEditor() {
  if (!cur) return;
  _ceOpenSnapshot = JSON.parse(JSON.stringify(cur.segments || []));
  _ceAllCollapsed = false;
  const cab = document.getElementById('ceCollapseAllBtn');
  if (cab) cab.textContent = '↕ طي';
  const cmb = document.getElementById('ceLineMenuBtn');
  if (cmb) cmb.style.display = 'none';
  ['ceMoveUpBtn','ceMoveDownBtn'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = 'none'; });
  _ceMenuTarget = null;
  document.getElementById('ceProjName').textContent = cur.name || '';
  ceWriterFromData();
  document.getElementById('ceOverlay').style.display = 'flex';
  clearInterval(_ceForceSaveTimer);
  _ceForceSaveTimer = setInterval(() => { ceWriterSave(); autoSave(); }, 30000);
  _ceSetupHoverMenu();
  setTimeout(() => {
    const w = document.getElementById('ceWriterDiv');
    if (w) {
      w.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(w);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, 60);
}

// Inline-rename the project from the content-editor title
function ceRenameProject() {
  if (!cur) return;
  const el = document.getElementById('ceProjName');
  const name = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (name === (cur.name || '')) return;
  cur.name = name;
  const pName = document.getElementById('pName');
  if (pName) pName.value = name;
  renderTopProject();
  autoSave();
}

function ceTitleInput() {
  if (!cur) return;
  const el = document.getElementById('ceProjName');
  const name = (el.textContent || '').replace(/\s+/g, ' ').trim();
  cur.name = name;
  const pName = document.getElementById('pName');
  if (pName) pName.value = name;
  renderTopProject();
}

function ceTitleKey(e) {
  // Enter commits the rename; Escape cancels
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  else if (e.key === 'Escape') {
    e.preventDefault();
    e.target.textContent = cur ? (cur.name || '') : '';
    e.target.blur();
  }
}

function closeContentEditor() {
  clearInterval(_ceForceSaveTimer); _ceForceSaveTimer = null;
  clearTimeout(_ceWriterTimer); _ceWriterTimer = null;
  const snapshot = _ceOpenSnapshot;
  _ceOpenSnapshot = null;
  ceWriterSave();
  autoSave();
  renderShots();
  updateProgress();
  document.getElementById('ceOverlay').style.display = 'none';
  const cmb = document.getElementById('ceLineMenuBtn');
  if (cmb) cmb.style.display = 'none';
  ['ceMoveUpBtn','ceMoveDownBtn'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = 'none'; });
  if (snapshot && cur && JSON.stringify(cur.segments) !== JSON.stringify(snapshot)) {
    _ceShowUndoToast(snapshot);
  }
}

function ceWriterFromData() {
  const div = document.getElementById('ceWriterDiv');
  if (!div) return;
  if (!cur || !cur.segments || !cur.segments.length) {
    div.innerHTML = '<div><br></div>';
    ceUpdateWriterPh();
    return;
  }
  let html = '';
  for (const seg of cur.segments) {
    html += `<div data-ltype="seg" data-rid="${esc(seg.id || '')}">${esc(seg.title || '') || '<br>'}</div>`;
    for (const shot of (seg.shots || [])) {
      html += `<div data-ltype="shot" data-rid="${esc(shot.id || '')}">${esc(shot.title || '') || '<br>'}</div>`;
      if (shot.content) {
        shot.content.split('\n').forEach(line => {
          html += `<div>${esc(line) || '<br>'}</div>`;
        });
      }
      html += '<div><br></div>';
    }
  }
  div.innerHTML = html || '<div><br></div>';
  ceUpdateWriterPh();
  ceUpdateStats();
}

function ceWriterOnInput() {
  const writer = document.getElementById('ceWriterDiv');
  if (!writer) return;

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) { ceUpdateWriterPh(); return; }

  // Walk up the DOM to find the direct child element of writer
  // (handles nested <span>/<bdo> inserted by RTL browser behaviour)
  let lineDiv = sel.anchorNode;
  while (lineDiv && lineDiv.parentElement !== writer) {
    lineDiv = lineDiv.parentElement;
  }

  if (lineDiv && lineDiv.nodeType === 1 && !lineDiv.dataset.ltype) {
    // Strip all Unicode format/control chars (Cf = BIDI marks, ZWS, etc.) then trim
    const text = (lineDiv.textContent || '').replace(/\p{Cf}/gu, '').trim();

    // Use \s so any whitespace character (not just ASCII space) triggers the heading
    if (/^##\s/.test(text)) {
      lineDiv.dataset.ltype = 'shot';
      if (!lineDiv.dataset.rid) lineDiv.dataset.rid = uid();
      lineDiv.textContent = text.replace(/^##\s+/, '');
      if (!lineDiv.textContent) lineDiv.innerHTML = '<br>';
      _ceCursorEnd(lineDiv);
    } else if (/^#\s/.test(text)) {
      lineDiv.dataset.ltype = 'seg';
      if (!lineDiv.dataset.rid) lineDiv.dataset.rid = uid();
      lineDiv.textContent = text.replace(/^#\s+/, '');
      if (!lineDiv.textContent) lineDiv.innerHTML = '<br>';
      _ceCursorEnd(lineDiv);
    }
  }

  ceUpdateWriterPh();
  ceUpdateStats();
  clearTimeout(_ceWriterTimer);
  _ceWriterTimer = setTimeout(() => { ceWriterSave(); autoSave(); }, 1200);
}

function ceWriterKeydown(e) {
  // When Enter is pressed inside a heading line (seg/shot), the browser clones
  // the current <div> — inheriting its data-ltype/data-rid — so the next line
  // becomes another heading. Insert a fresh, plain line instead.
  if (e.key !== 'Enter' || e.shiftKey) return;
  const writer = document.getElementById('ceWriterDiv');
  if (!writer) return;

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  // Walk up to the direct child <div> of the writer
  let lineDiv = sel.anchorNode;
  while (lineDiv && lineDiv.parentElement !== writer) {
    lineDiv = lineDiv.parentElement;
  }
  if (!lineDiv || lineDiv.nodeType !== 1 || !lineDiv.dataset.ltype) return;

  e.preventDefault();
  const newLine = document.createElement('div');
  newLine.innerHTML = '<br>';
  if (lineDiv.nextSibling) writer.insertBefore(newLine, lineDiv.nextSibling);
  else writer.appendChild(newLine);
  _ceCursorEnd(newLine);
  ceUpdateWriterPh();
  ceUpdateStats();
}

function ceWriterPaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  if (!text) return;
  let html = '';
  for (const line of text.split('\n')) {
    if (/^##\s+/.test(line)) {                                         // !! check ## before #
      html += `<div data-ltype="shot" data-rid="${uid()}">${esc(line.replace(/^##\s+/, ''))}</div>`;
    } else if (/^#\s+/.test(line)) {
      html += `<div data-ltype="seg" data-rid="${uid()}">${esc(line.replace(/^#\s+/, ''))}</div>`;
    } else {
      html += `<div>${esc(line) || '<br>'}</div>`;
    }
  }
  document.execCommand('insertHTML', false, html);
  ceUpdateWriterPh();
}

function _ceCursorEnd(el) {
  const sel = window.getSelection();
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

export function ceUpdateWriterPh() {
  const div = document.getElementById('ceWriterDiv');
  const ph  = document.getElementById('ceWriterPh');
  if (!ph) return;
  ph.style.display = div && div.textContent.trim() ? 'none' : 'block';
}

export function ceUpdateStats() {
  const div = document.getElementById('ceWriterDiv');
  if (!div) return;
  let segs = 0, shots = 0, words = 0;
  div.childNodes.forEach(node => {
    if (node.nodeType !== 1) return;
    const ltype = node.dataset && node.dataset.ltype;
    if (ltype === 'seg') segs++;
    else if (ltype === 'shot') shots++;
    const t = node.textContent.trim();
    if (t) words += t.split(/\s+/).filter(Boolean).length;
  });
  const durMin = words / 130; // ~130 Arabic words per minute for narration
  const durStr = words === 0 ? '—' : durMin < 1 ? Math.round(durMin * 60) + ' ث' : durMin.toFixed(1) + ' د';
  document.getElementById('ceStatSegs').textContent = 'المقاطع (' + segs + ')';
  document.getElementById('ceStatShots').textContent = 'المشاهد (' + shots + ')';
  document.getElementById('ceStatWords').textContent = 'الكلمات (' + words + ')';
  document.getElementById('ceStatDur').textContent = 'مدة الإلقاء (' + durStr + ')';
}

let _ceAllCollapsed = false;

function ceToggleAllCollapse() {
  const writer = document.getElementById('ceWriterDiv');
  const btn    = document.getElementById('ceCollapseAllBtn');
  if (!writer) return;

  if (_ceAllCollapsed) {
    // Expand all
    writer.childNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.dataset && node.dataset.ceHiddenBy) {
        node.style.display = '';
        delete node.dataset.ceHiddenBy;
      }
      if (node.dataset) delete node.dataset.ceCollapsed;
    });
    _ceAllCollapsed = false;
    if (btn) btn.textContent = '↕ طي';
  } else {
    // Collapse at seg level — hide only content lines, leave shot headings visible
    writer.childNodes.forEach(node => {
      if (node.nodeType !== 1 || !node.dataset || node.dataset.ltype !== 'seg') return;
      if (!node.dataset.ceId) node.dataset.ceId = 'h' + Date.now() + Math.random().toString(36).slice(2);
      const id = node.dataset.ceId;
      let next = node.nextSibling;
      while (next) {
        if (next.dataset && next.dataset.ltype === 'seg') break;
        if (!next.dataset || !next.dataset.ltype) {
          next.style.display = 'none';
          next.dataset.ceHiddenBy = id;
        }
        next = next.nextSibling;
      }
      node.dataset.ceCollapsed = '1';
    });
    _ceAllCollapsed = true;
    if (btn) btn.textContent = '↕ فك';
  }

  // Refresh the individual toggle button if it's visible
  const menuBtn = document.getElementById('ceLineMenuBtn');
  if (menuBtn && menuBtn.style.display !== 'none' && _ceMenuTarget) {
    menuBtn.textContent = _ceMenuTarget.dataset.ceCollapsed === '1' ? '▶' : '▼';
  }
}

export function ceWriterSave() {
  const div = document.getElementById('ceWriterDiv');
  if (!cur || !div) return;

  const newSegs = [];
  let curSeg = null, curShot = null;

  div.childNodes.forEach(node => {
    if (node.nodeType !== 1) return;
    const ltype = node.dataset && node.dataset.ltype;
    const text  = node.textContent || '';
    const rid   = (node.dataset && node.dataset.rid) || '';

    if (ltype === 'seg') {
      curSeg = { _rid: rid, title: text.trim(), shots: [] };
      newSegs.push(curSeg); curShot = null;
    } else if (ltype === 'shot') {
      if (!curSeg) { curSeg = { _rid: '', title: '', shots: [] }; newSegs.push(curSeg); }
      curShot = { _rid: rid, title: text.trim(), content: '' };
      curSeg.shots.push(curShot);
    } else {
      if (!curSeg) { curSeg = { _rid: '', title: '', shots: [] }; newSegs.push(curSeg); }
      if (!curShot) { curShot = { _rid: '', title: '', content: '' }; curSeg.shots.push(curShot); }
      curShot.content = curShot.content ? curShot.content + '\n' + text : text;
    }
  });

  for (const seg of newSegs) for (const shot of (seg.shots || [])) {
    shot.content = (shot.content || '').trimEnd();
  }

  // Match rebuilt shots back to existing ones so metadata (done, filename/2/3/4,
  // shooting, editMusic, timecodeNotes…) is NEVER lost during a rebuild.
  // Matching priority: id(rid) → title+content → title → position.
  // Every matched old shot is "claimed" so it can't be reused for another row.
  // This is critical: deleting a line in the contenteditable can strip a survivor's
  // data-rid; without claiming, the old absolute-index fallback would hand a
  // survivor the *deleted* shot's data (or blank it), wiping its file numbers.
  const oldSegs = cur.segments || [];
  const oldSegById = new Map(oldSegs.filter(s => s.id).map(s => [s.id, s]));
  const oldShotById = new Map();
  const oldShotPool = [];
  for (const s of oldSegs) for (const h of (s.shots || [])) { if (h.id) oldShotById.set(h.id, h); oldShotPool.push(h); }
  const claimedShots = new Set();
  const claimShot = (newShot, oldSeg, hi) => {
    const nt = (newShot.title || '').trim();
    const nc = (newShot.content || '').trim();
    // 1) by exact title + content — strongest identity signal. Deleting a line in
    //    the contenteditable can leave a survivor carrying the DELETED shot's
    //    data-rid but the surviving shot's text; trusting rid there would wipe the
    //    survivor's file numbers, so an exact text match wins over rid.
    if (nt || nc) {
      const h = oldShotPool.find(o => !claimedShots.has(o) && (o.title||'').trim() === nt && (o.content||'').trim() === nc);
      if (h) { claimedShots.add(h); return h; }
    }
    // 2) by id/rid — handles renames/edits (title or content changed) reliably
    if (newShot._rid) {
      const h = oldShotById.get(newShot._rid);
      if (h && !claimedShots.has(h)) { claimedShots.add(h); return h; }
    }
    // 3) by exact non-empty title
    if (nt) {
      const h = oldShotPool.find(o => !claimedShots.has(o) && (o.title||'').trim() === nt);
      if (h) { claimedShots.add(h); return h; }
    }
    // 4) positional within the same old segment: next still-unclaimed shot, in order
    if (oldSeg) {
      const h = (oldSeg.shots || []).find(o => !claimedShots.has(o));
      if (h) { claimedShots.add(h); return h; }
    }
    return null;
  };

  const blankNewShots = [];   // new shots created without an old match (for the safety net)
  const newShotCount = newSegs.reduce((n, s) => n + s.shots.length, 0);

  cur.segments = newSegs.map((newSeg, si) => {
    const oldSeg = (newSeg._rid && oldSegById.get(newSeg._rid)) || oldSegs[si] || null;
    return {
      id:        oldSeg ? oldSeg.id : (newSeg._rid || uid()),
      title:     newSeg.title,
      collapsed: oldSeg ? (oldSeg.collapsed || false) : false,
      shots: newSeg.shots.map((newShot, hi) => {
        const oldShot = claimShot(newShot, oldSeg, hi);
        if (oldShot) return { ...oldShot, title: newShot.title, content: newShot.content };
        const created = {
          id: newShot._rid || uid(), title: newShot.title || ('مشهد ' + (hi + 1)),
          done: false, content: newShot.content || '', contentRich: '',
          shooting: '', editMusic: '', filename: '', filename2: '', filename3: '', filename4: '',
          timecodeNotes: [], tcOpen: false, collapsed: false
        };
        blankNewShots.push(created);
        return created;
      })
    };
  });

  // ── SAFETY NET: file numbers must NEVER vanish from a rebuild ──
  // If no shot was actually removed (new count >= old count) yet some old shot with
  // file numbers ended up unmatched, its data was about to be lost. Re-attach those
  // numbers (and the rest of its metadata) onto the unmatched blank new shots, in order.
  // When a shot is genuinely deleted (new count < old count) we leave its numbers gone.
  if (newShotCount >= oldShotPool.length && blankNewShots.length) {
    const orphans = oldShotPool.filter(o => !claimedShots.has(o) &&
      (o.filename || o.filename2 || o.filename3 || o.filename4 ||
       o.done || (o.timecodeNotes && o.timecodeNotes.length) || o.shooting || o.editMusic));
    for (let i = 0; i < blankNewShots.length && orphans.length; i++) {
      const src = orphans.shift(); const dst = blankNewShots[i];
      dst.filename = src.filename || ''; dst.filename2 = src.filename2 || '';
      dst.filename3 = src.filename3 || ''; dst.filename4 = src.filename4 || '';
      dst.done = src.done || false; dst.shooting = src.shooting || '';
      dst.editMusic = src.editMusic || ''; dst.face = src.face || '';
      dst.timecodeNotes = src.timecodeNotes || [];
    }
  }
}

// kept for compatibility — no longer used internally
function ceParseLines(lines) {
  const segments = [];
  let curSeg = null, curShot = null;
  for (const line of lines) {
    const text = line.trimEnd();
    if (/^# .+/.test(text)) {
      curSeg = { title: text.slice(2).trim(), shots: [] };
      segments.push(curSeg); curShot = null;
    } else if (/^## .+/.test(text)) {
      if (!curSeg) { curSeg = { title: '', shots: [] }; segments.push(curSeg); }
      curShot = { title: text.slice(3).trim(), content: '' };
      curSeg.shots.push(curShot);
    } else {
      if (!curSeg) { curSeg = { title: '', shots: [] }; segments.push(curSeg); }
      if (!curShot) { curShot = { title: '', content: '' }; curSeg.shots.push(curShot); }
      curShot.content = curShot.content ? curShot.content + '\n' + line : line;
    }
  }
  for (const seg of segments) {
    for (const shot of (seg.shots || [])) {
      shot.content = (shot.content || '').trimEnd();
    }
  }
  return segments;
}

// ── Heading collapse toggle ──
let _ceMenuTarget = null;
let _ceMenuHideTimer = null;

function _ceSetupHoverMenu() {
  const writer  = document.getElementById('ceWriterDiv');
  const btn     = document.getElementById('ceLineMenuBtn');
  const upBtn   = document.getElementById('ceMoveUpBtn');
  const downBtn = document.getElementById('ceMoveDownBtn');
  if (!writer || !btn || btn._ceMenuReady) return;
  btn._ceMenuReady = true;

  function hideAll() {
    btn.style.display = 'none';
    upBtn.style.display = 'none';
    downBtn.style.display = 'none';
  }

  function showBtn(node) {
    _ceMenuTarget = node;
    const rect  = node.getBoundingClientRect();
    const vw    = window.innerWidth;
    const bSize = 28;
    const midY  = rect.top + (rect.height - bSize) / 2;

    // Collapse toggle: to the right of the heading
    const rightPos = rect.right + 8;
    const colLeft  = (rightPos + bSize <= vw) ? rightPos : Math.max(4, rect.left - bSize - 4);
    btn.style.top  = midY + 'px';
    btn.style.left = colLeft + 'px';
    btn.style.display = 'flex';
    btn.textContent = node.dataset.ceCollapsed === '1' ? '▶' : '▼';

    // Move buttons: [↑][↓] to the left of the heading
    const gap       = 3;
    const downLeft  = Math.max(bSize + gap + 4, rect.left - gap - bSize);
    const upLeft    = Math.max(4, downLeft - gap - bSize);
    upBtn.style.top    = midY + 'px';
    upBtn.style.left   = upLeft + 'px';
    upBtn.style.display = 'flex';
    downBtn.style.top  = midY + 'px';
    downBtn.style.left = downLeft + 'px';
    downBtn.style.display = 'flex';
  }

  function scheduleHide() {
    clearTimeout(_ceMenuHideTimer);
    _ceMenuHideTimer = setTimeout(() => {
      if (!btn.matches(':hover') && !upBtn.matches(':hover') && !downBtn.matches(':hover')) {
        hideAll();
      }
    }, 200);
  }

  // Desktop: hover
  writer.addEventListener('mouseover', e => {
    let node = e.target;
    while (node && node.parentElement !== writer) node = node.parentElement;
    if (!node || !node.dataset || !node.dataset.ltype) { scheduleHide(); return; }
    clearTimeout(_ceMenuHideTimer);
    showBtn(node);
  });
  writer.addEventListener('mouseleave', scheduleHide);
  btn.addEventListener('mouseenter', () => clearTimeout(_ceMenuHideTimer));
  btn.addEventListener('mouseleave', scheduleHide);
  upBtn.addEventListener('mouseenter', () => clearTimeout(_ceMenuHideTimer));
  upBtn.addEventListener('mouseleave', scheduleHide);
  downBtn.addEventListener('mouseenter', () => clearTimeout(_ceMenuHideTimer));
  downBtn.addEventListener('mouseleave', scheduleHide);

  // Mobile: touch on heading reveals the buttons
  writer.addEventListener('touchstart', e => {
    let node = e.target;
    while (node && node.parentElement !== writer) node = node.parentElement;
    if (!node || !node.dataset || !node.dataset.ltype) { hideAll(); return; }
    clearTimeout(_ceMenuHideTimer);
    showBtn(node);
  }, { passive: true });

  // Hide all buttons when scrolling
  const ceBody = document.querySelector('.ce-minimal-body');
  if (ceBody) ceBody.addEventListener('scroll', () => { hideAll(); }, { passive: true });
}

function ceCollapseToggle() {
  const writer = document.getElementById('ceWriterDiv');
  const btn    = document.getElementById('ceLineMenuBtn');
  const target = _ceMenuTarget;
  if (!writer || !target || !target.parentElement) return;

  const isCollapsed = target.dataset.ceCollapsed === '1';
  const ltype = target.dataset.ltype;

  if (isCollapsed) {
    // Expand: restore nodes hidden by this heading
    if (!target.dataset.ceId) { delete target.dataset.ceCollapsed; return; }
    const id = target.dataset.ceId;
    let next = target.nextSibling;
    while (next) {
      if (next.dataset && next.dataset.ceHiddenBy === id) {
        next.style.display = '';
        delete next.dataset.ceHiddenBy;
      }
      next = next.nextSibling;
    }
    delete target.dataset.ceCollapsed;
    if (btn.style.display !== 'none') btn.textContent = '▼';
  } else {
    // Collapse: hide content-only nodes (skip sub-headings) until next same-or-higher heading
    if (!target.dataset.ceId) target.dataset.ceId = 'h' + Date.now();
    const id = target.dataset.ceId;
    let next = target.nextSibling;
    while (next) {
      const nl = next.dataset && next.dataset.ltype;
      if (nl === 'seg' || (ltype === 'shot' && nl === 'shot')) break;
      if (!nl) { // only hide non-heading nodes
        next.style.display = 'none';
        next.dataset.ceHiddenBy = id;
      }
      next = next.nextSibling;
    }
    target.dataset.ceCollapsed = '1';
    if (btn.style.display !== 'none') btn.textContent = '▶';
  }
}

function ceMoveHeading(dir) {
  const writer = document.getElementById('ceWriterDiv');
  const target = _ceMenuTarget;
  if (!writer || !target) return;

  const ltype = target.dataset.ltype;
  if (ltype !== 'seg' && ltype !== 'shot') return;

  // Snapshot of all child nodes (elements + text nodes)
  const allNodes = Array.from(writer.childNodes);

  // A node is a block boundary for our ltype if it's a heading at same or higher level
  function isBoundary(n) {
    if (n.nodeType !== 1) return false;
    const nl = n.dataset && n.dataset.ltype;
    return ltype === 'seg' ? nl === 'seg' : nl === 'seg' || nl === 'shot';
  }

  const ti = allNodes.indexOf(target);
  if (ti < 0) return;

  // Collect our block: target + everything until the next boundary
  const ourBlock = [];
  for (let i = ti; i < allNodes.length; i++) {
    if (i > ti && isBoundary(allNodes[i])) break;
    ourBlock.push(allNodes[i]);
  }

  if (dir === -1) {
    // Moving up: find the previous heading of the same level
    let prevHi = -1;
    for (let i = ti - 1; i >= 0; i--) {
      if (isBoundary(allNodes[i])) {
        if (ltype === 'shot' && allNodes[i].dataset.ltype === 'seg') break; // can't cross seg
        prevHi = i; break;
      }
    }
    if (prevHi < 0) return; // already at top

    // Insert our block before the previous heading → our block moves up
    const anchor = allNodes[prevHi];
    for (const n of ourBlock) writer.insertBefore(n, anchor);

  } else {
    // Moving down: find the next heading of the same level
    let nextHi = -1;
    const afterOur = ti + ourBlock.length;
    for (let i = afterOur; i < allNodes.length; i++) {
      if (isBoundary(allNodes[i])) {
        if (ltype === 'shot' && allNodes[i].dataset.ltype === 'seg') break; // can't cross seg
        nextHi = i; break;
      }
    }
    if (nextHi < 0) return; // already at bottom

    // Collect the next block
    const nextBlock = [];
    for (let i = nextHi; i < allNodes.length; i++) {
      if (i > nextHi && isBoundary(allNodes[i])) break;
      nextBlock.push(allNodes[i]);
    }

    // Insert the next block before our block → our block moves down
    const anchor = ourBlock[0];
    for (const n of nextBlock) writer.insertBefore(n, anchor);
  }

  ceUpdateStats();
  clearTimeout(_ceWriterTimer);
  _ceWriterTimer = setTimeout(() => { ceWriterSave(); autoSave(); }, 1200);
}

// ── Custom dialog system (replaces browser confirm / alert / prompt) ──
function _showToast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('_toastContainer');
  if (!container) { container = document.createElement('div'); container.id = '_toastContainer'; document.body.appendChild(container); }
  const el = document.createElement('div');
  el.className = '_toast' + (type !== 'info' ? ' _toast-' + type : '');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = '_toastOut 0.18s var(--ease-out-quart) forwards';
    setTimeout(() => el.remove(), 200);
  }, duration);
}

function _closeSheetOverlay(overlay) {
  const sheet = document.getElementById('_sheet');
  return new Promise(res => {
    sheet.classList.add('closing');
    overlay.classList.add('closing');
    sheet.addEventListener('animationend', () => {
      sheet.classList.remove('closing');
      overlay.classList.remove('open', 'closing');
      res();
    }, { once: true });
  });
}

function _showConfirm(msg, { destructive = false, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء' } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('_sheetOverlay');
    document.getElementById('_sheetMsg').textContent = msg;
    document.getElementById('_sheetInput').style.display = 'none';
    const confirmBtn = document.getElementById('_sheetConfirmBtn');
    confirmBtn.textContent = confirmLabel;
    confirmBtn.className = destructive ? '_destructive' : '';
    document.getElementById('_sheetCancelBtn').textContent = cancelLabel;
    overlay.classList.add('open');
    const done = (val) => {
      document.removeEventListener('keydown', onKey);
      _closeSheetOverlay(overlay).then(() => resolve(val));
    };
    confirmBtn.onclick = () => done(true);
    document.getElementById('_sheetCancelBtn').onclick = () => done(false);
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onKey);
    const onOverlayClick = (e) => { if (e.target === overlay) { overlay.removeEventListener('click', onOverlayClick); done(false); } };
    overlay.addEventListener('click', onOverlayClick);
  });
}

function _showPrompt(msg, defaultVal = '') {
  return new Promise(resolve => {
    const overlay = document.getElementById('_sheetOverlay');
    document.getElementById('_sheetMsg').textContent = msg;
    const inp = document.getElementById('_sheetInput');
    inp.value = defaultVal; inp.style.display = 'block';
    document.getElementById('_sheetConfirmBtn').textContent = 'حفظ';
    document.getElementById('_sheetConfirmBtn').className = '';
    document.getElementById('_sheetCancelBtn').textContent = 'إلغاء';
    overlay.classList.add('open');
    setTimeout(() => inp.focus(), 150);
    const done = (val) => { inp.style.display = 'none'; _closeSheetOverlay(overlay).then(() => resolve(val)); };
    document.getElementById('_sheetConfirmBtn').onclick = () => { const v = inp.value.trim(); if (v) done(v); };
    document.getElementById('_sheetCancelBtn').onclick = () => done(null);
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); inp.removeEventListener('keydown', onKey); const v = inp.value.trim(); done(v || null); }
      if (e.key === 'Escape') { inp.removeEventListener('keydown', onKey); done(null); }
    };
    inp.addEventListener('keydown', onKey);
    const onOverlayClick = (e) => { if (e.target === overlay) { overlay.removeEventListener('click', onOverlayClick); done(null); } };
    overlay.addEventListener('click', onOverlayClick);
  });
}

// ── Expose to window (needed for type="module") ──
Object.assign(window, {
  createFolder, renameFolder, deleteFolder, toggleFolderOpen,
  showMoveModal, selectMfOption, closeMoveModal, confirmMove,
  openMoveSegModal, closeMoveSegModal, executeMoveOrCopySeg,
  createProject, createProjectInFolder, duplicateProject, openProject, confirmDel,
  trashRestoreProject, trashPermDelete, trashEmptyAll,
  toggleProjTrash, restoreSegFromTrash, permDeleteSegFromTrash,
  restoreShotFromTrash, permDeleteShotFromTrash,
  setShotFilter,
  goHome, goToFolder, addShot, addShotToSeg, addShotToLast, addSegment, deleteSegment, toggleSegCollapse, setSegTitle,
  delShot, toggleDone, setF, autoSave, toggleTC,
  startTimer, pauseTimer, resetTimer, toggleCollapse,
  addNote, addNotePreset, sfAddNotePreset, delNote, toggleTcNotes, fmtFilename, saveFPS, toggleInfo, togglePrepCard, addPrepTask, addPrepTaskPreset, togglePrepTask, deletePrepTask, onNameChange, toggleAllSegments, updateDateDisplay,
  exportJSON, importProject, handleImport, importExcel, handleExcelImport, exportFCP, toggleImportDrop, toggleCreateDrop,
  togglePublishMenu, closePublishMenu, toggleViewMenu, closeViewMenu, onTopTitleInput, onTopTitleBlur, onTopTitlePaste,
  openFirstShotFull, openShotFull, closeShotFull, sfAddNote, sfDelNote,
  sfShowAddPreset, sfHideAddPreset, sfSavePreset, sfDeletePreset,
  listShowAddPreset, listHideAddPreset, listSavePreset, listDeletePreset,
  openSegFull, closeSegFull, segfSetTitle, segfSetField, segfToggleDone, segfAddShot,
  setSegRukn, setSegFace, setSegFaceAll, setSegLink, segLinkAction, segLinkEdit, segLinkOpen, segLinkSave, closeSegLinkModal, _segFaceLabel, _refreshSegFaceEl, segfSetFace,
  _getRuknList, _getRuknLabel, _getFolderName,
  setSyncState,
  sfStartTimer, sfPauseTimer, sfResetTimer,
  openEditorCurrent: () => openEditor(sfShotId),
  openEditor, closeEditor, execCmd, updateWordCount, handleEditorKey,
  closeFcpModal, fcpBrowseFolder, fcpSetFolder, fcpScanFolder, fcpFoundFiles, fcpDropFolder, fcpPickFiles, fcpHandleFilePick, fcpLaunch, fcpLaunchApp, fcpDownload, fcpBuildXML, fcpOnFolderInput, fcpSetSteps,
  signOutUser, toggleTheme, changeDisplayName,
  openShareModal, closeShareModal, generateShare, revokeShare, copyShareLink, claimSharedProject,
  openFolderShare, closeFolderShare, fshInvite, fshChangeRole, fshRemoveMember, fshRemovePending,
  fshGenerateLink, fshRevokeLink, fshCopyLink,
  flpOpenProject, flpGoBack,
  toggleSharedFolderOpen, openSharedOrLocal, createSharedProject,
  setViewMode, setHomeViewMode, openFolderView, closeFolderView, setFolderViewMode,
  showHome,
  openTp, closeTp, tpTogglePlay, tpSetSpeed, tpSetFont, tpSetLineSize, tpReset, tpOpenDisplay, tpToggleMirror, tpFullscreen, tpStartScroll, tpStopScroll,
  sfNavigate, _sfUpdateNavBtns,
  stRowResizeStart, stColResizeStart,
  openContentEditor, closeContentEditor, ceTitleInput, ceTitleKey, ceRenameProject, ceWriterOnInput, ceWriterKeydown, ceWriterPaste,
  ceCollapseToggle, ceToggleAllCollapse, ceMoveHeading,
  shotDragStart, shotDragEnd,
  openTextImport, closeTextImport, previewTextImport, doTextImport,
  setTableSort,
  toggleTableView, stSet, stToggleDone, stToggleSeg, stDelShot,
  toggleColDropdown, setColVis,
  toggleSegChat, sendSegChat, segChatKeydown,
  _onSyncDotClick, _onSavePillClick, _closeProfileDropdown,
});

// ── Content-editor heading hover menu ──
_ceSetupHoverMenu();

// ── View toggle buttons (wired directly — no window lookup needed) ──
document.getElementById('viewBtnCompact')?.addEventListener('click', () => setViewMode('compact'));
document.getElementById('viewBtnExpanded')?.addEventListener('click', () => setViewMode('expanded'));
document.getElementById('viewDropBtn')?.addEventListener('click', e => { e.stopPropagation(); toggleViewDropdown(); });
document.getElementById('vsFields') ?.addEventListener('change', e => applyViewSetting('showShotFields', e.target.checked));
document.getElementById('vsTCNotes')?.addEventListener('change', e => applyViewSetting('showTCNotes',    e.target.checked));
document.getElementById('vsTable')  ?.addEventListener('change', e => toggleTableView(e.target.checked));

// ── Theme ──
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const emoji = theme === 'light' ? '☀️' : '🌙';
  document.querySelectorAll('.theme-icon').forEach(el => { el.textContent = emoji; });
  localStorage.setItem('sm_theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ══════════════════════════════════════════
//  Firebase
// ══════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyAlomMYLl6d7KKQFYkiAlINuRf_sjuZqzw",
  authDomain: "mersad-hatem.web.app",
  projectId: "mersad-hatem",
  storageBucket: "mersad-hatem.firebasestorage.app",
  messagingSenderId: "1038676297124",
  appId: "1:1038676297124:web:062822438deb2008696d31",
  measurementId: "G-4Y17G20YMR"
};

let fbApp;
try { fbApp = getApp(); } catch(e) { fbApp = initializeApp(firebaseConfig); }

// IndexedDB persistence — more reliable than sessionStorage on iOS WKWebView
let auth;
try {
  auth = initializeAuth(fbApp, { persistence: [indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver });
} catch(e) {
  auth = getAuth(fbApp); // Already initialized — reuse existing instance
}

const db      = getFirestore(fbApp);
const storage = getStorage(fbApp);

// ── Auth helpers — defined early so login works even if later code errors ──
const _localEmail = (u) => u.toLowerCase().trim() + '@mersad.app';

window._mSignInLocal = async function() {
  const userVal = (document.getElementById('loginUser')?.value || '').trim();
  const passVal = (document.getElementById('loginPass')?.value || '').trim();
  const errEl   = document.getElementById('loginError');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  if (!userVal || !passVal) {
    if (errEl) { errEl.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور'; errEl.style.display = 'block'; }
    return;
  }
  const btn = document.getElementById('loginSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'جارٍ تسجيل الدخول...'; }
  try {
    await signInWithEmailAndPassword(auth, _localEmail(userVal), passVal);
  } catch(e) {
    let msg = 'اسم المستخدم أو كلمة المرور غير صحيحة';
    if (e.code === 'auth/too-many-requests')      msg = 'محاولات كثيرة جداً، يرجى المحاولة لاحقاً';
    if (e.code === 'auth/user-not-found')         msg = 'المستخدم غير موجود. أنشئ حساباً جديداً أو انقل بيانات Google';
    if (e.code === 'auth/wrong-password')         msg = 'كلمة المرور غير صحيحة';
    if (e.code === 'auth/invalid-credential')     msg = 'اسم المستخدم أو كلمة المرور غير صحيحة';
    if (e.code === 'auth/operation-not-allowed')  msg = 'تسجيل الدخول بكلمة المرور غير مفعّل في الإعدادات';
    if (e.code === 'auth/network-request-failed') msg = 'تعذّر الاتصال، تحقق من الإنترنت';
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    else _showToast(msg, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = window._authMode === 'register' ? 'إنشاء الحساب' : 'تسجيل الدخول'; }
  }
};

window._mRegisterLocal = async function() {
  const userVal = (document.getElementById('loginUser')?.value || '').trim();
  const passVal = (document.getElementById('loginPass')?.value || '').trim();
  const confVal = (document.getElementById('loginPassConfirm')?.value || '').trim();
  const errEl   = document.getElementById('loginError');
  if (errEl) { errEl.style.display = 'none'; }
  if (!userVal) {
    if (errEl) { errEl.textContent = 'يرجى إدخال اسم المستخدم'; errEl.style.display = 'block'; } return;
  }
  if (passVal.length < 6) {
    if (errEl) { errEl.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'; errEl.style.display = 'block'; } return;
  }
  if (passVal !== confVal) {
    if (errEl) { errEl.textContent = 'كلمتا المرور غير متطابقتين'; errEl.style.display = 'block'; } return;
  }
  const btn = document.getElementById('loginSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'جارٍ إنشاء الحساب...'; }
  try {
    await createUserWithEmailAndPassword(auth, _localEmail(userVal), passVal);
  } catch(e) {
    let msg = 'تعذّر إنشاء الحساب';
    if (e.code === 'auth/email-already-in-use') msg = 'اسم المستخدم مستخدم بالفعل';
    if (e.code === 'auth/invalid-email')        msg = 'اسم المستخدم غير صالح';
    if (e.code === 'auth/weak-password')        msg = 'كلمة المرور ضعيفة جداً';
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    else _showToast(msg, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'إنشاء الحساب'; }
  }
};

// Module loaded — enable login button
(function() {
  const b = document.getElementById('loginSubmitBtn');
  if (b && b.textContent === 'جارٍ التحميل...') {
    b.disabled = false; b.style.opacity = ''; b.textContent = 'تسجيل الدخول';
  }
})();

let fbUser = null;

window._mUploadAvatar = async function(input) {
  const file = input.files?.[0];
  if (!file || !fbUser) return;
  input.value = '';
  const statusEl = document.getElementById('avatarUploadStatus');
  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'جارٍ الرفع...'; }
  try {
    // Resize and compress to base64 using canvas (max 200x200, quality 0.7)
    const base64 = await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const size = 200;
        const canvas = document.createElement('canvas');
        const ratio = Math.min(size / img.width, size / img.height);
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = url;
    });
    await setDoc(doc(db, 'userProfiles', fbUser.uid), { photoURL: base64 }, { merge: true });
    updateUserPill({ ...fbUser, photoURL: base64 });
    _closeProfileDropdown();
    if (statusEl) statusEl.style.display = 'none';
  } catch(e) {
    if (statusEl) { statusEl.textContent = 'فشل الرفع: ' + (e.code || e.message); }
    else _showToast('فشل رفع الصورة: ' + (e.message || e.code), 'error');
  }
};

function projsCol()    { return collection(db, 'users', fbUser.uid, 'projects'); }
function foldersCol()  { return collection(db, 'users', fbUser.uid, 'folders'); }

// ── Override storage ops to use Firestore ──
// localStorage = fast display cache | Firestore = source of truth

getAllProjects = async () => loadLS();

// Save to localStorage immediately + Firestore right away (fire-and-forget)

// ── Sync Status Indicator ────────────────────────────────────────
let _lastSyncTime = null;
let _syncTickInterval = null;

function _showSyncStatus(show) {
  const v = show && !!fbUser ? 'flex' : 'none';
  const el  = document.getElementById('syncStatus');
  const cel = document.getElementById('ceSyncStatus');
  if (el)  el.style.display  = v;
  if (cel) cel.style.display = v;
}

function setSyncState(state, time) {
  const el   = document.getElementById('syncStatus');
  const cel  = document.getElementById('ceSyncStatus');
  const txt  = document.getElementById('syncText');
  const ctxt = document.getElementById('ceSyncText');
  if (!el && !cel) return;
  [el, cel].forEach(e => { if (e) e.className = state; });
  _showSyncStatus(true);
  if (time) _lastSyncTime = time;
  const setText = s => { if (txt) txt.textContent = s; if (ctxt) ctxt.textContent = s; if (el) el.title = s; if (cel) cel.title = s; };
  if (state === 'syncing') {
    setText('جارٍ الحفظ...');
  } else if (state === 'synced') {
    _updateSyncTime();
    if (!_syncTickInterval) _syncTickInterval = setInterval(_updateSyncTime, 30000);
  } else if (state === 'failed') {
    setText('فشل الحفظ ✕');
  } else if (state === 'offline') {
    setText('غير متصل');
  }
}

function _updateSyncTime() {
  if (!_lastSyncTime) return;
  const diff = Math.floor((Date.now() - _lastSyncTime) / 1000);
  let label;
  if (diff < 10)        label = 'تمّت المزامنة ✓';
  else if (diff < 60)   label = 'منذ ' + diff + 'ث';
  else if (diff < 3600) label = 'منذ ' + Math.floor(diff/60) + 'د';
  else                  label = 'منذ ' + Math.floor(diff/3600) + 'س';
  const txt  = document.getElementById('syncText');
  const ctxt = document.getElementById('ceSyncText');
  if (txt)  txt.textContent  = label;
  if (ctxt) ctxt.textContent = label;
  const clock = new Date(_lastSyncTime).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  const title = 'آخر مزامنة: ' + clock + ' (' + label + ')';
  const el  = document.getElementById('syncStatus');
  const cel = document.getElementById('ceSyncStatus');
  if (el)  el.title  = title;
  if (cel) cel.title = title;
}

function _onSyncDotClick(dot) {
  const el = dot || document.getElementById('syncStatus');
  if (!el) return;
  if (el.classList.contains('synced')) {
    if (_lastSyncTime) {
      const timeStr = new Date(_lastSyncTime).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
      _showToast('اطمئن، حُفظت بياناتك في ' + timeStr, 'info', 3500);
    } else {
      _showToast('اطمئن، بياناتك محفوظة', 'info', 3500);
    }
  } else if (el.classList.contains('syncing')) {
    _showToast('جارٍ حفظ بياناتك الآن…', 'info', 2500);
  } else if (el.classList.contains('failed')) {
    _showToast('تعذّر الحفظ — تحقق من الاتصال بالإنترنت', 'error', 3500);
  } else if (el.classList.contains('offline')) {
    _showToast('أنت غير متصل بالإنترنت حالياً', 'info', 3000);
  } else {
    _showToast('اطمئن، بياناتك محفوظة', 'info', 3500);
  }
}

// Monitor online/offline
window.addEventListener('online',  () => {
  // Re-push the open project instead of just relabeling the dot — a save that
  // failed while offline only lives in this device's localStorage until
  // something re-sends it, otherwise it can vanish if this device's storage
  // is ever cleared before another edit happens to trigger autoSave again.
  if (cur) autoSave();
  else if (_lastSyncTime) setSyncState('synced');
});
window.addEventListener('offline', () => setSyncState('offline'));

saveProject = async (p) => {
  // For shared projects (owned by someone else), don't store in own localStorage
  // but save directly to owner's Firestore collection
  if (p._ownerUid && p._ownerUid !== fbUser?.uid) {
    if (!fbUser) return;
    setSyncState('syncing');
    // Strip internal markers before saving
    const clean = Object.assign({}, p);
    delete clean._ownerUid; delete clean._shared; delete clean._role; delete clean._viewOnly;
    // Update local shared cache
    const sf = _sharedFolders.find(s => s.ownerUid === p._ownerUid && s.folderId === p.folderId);
    if (sf) {
      const idx = sf.projects.findIndex(x => x.id === p.id);
      if (idx >= 0) sf.projects[idx] = { ...p };
      else sf.projects.push({ ...p });
    }
    // Awaited: the caller (autoSave) must see a rejection when the network
    // write actually fails, otherwise it reports "saved" before the data
    // ever reaches Firestore — the edit can then vanish if it never leaves
    // this device (e.g. storage cleared, or opened fresh on another device).
    try {
      await setDoc(doc(db, 'users', p._ownerUid, 'projects', p.id), clean);
      setSyncState('synced', Date.now());
    } catch (e) {
      console.error('☁️ shared save failed:', e); setSyncState('failed'); throw e;
    }
    return;
  }
  upsertLS(p);
  if (!fbUser) return;
  setSyncState('syncing');
  try {
    await setDoc(doc(projsCol(), p.id), p);
    setSyncState('synced', Date.now());
  } catch (e) {
    console.error('☁️ save failed:', e); setSyncState('failed'); throw e;
  }
  if (p.shareId) {
    setDoc(doc(db, 'sharedProjects', p.shareId), {
      shareId: p.shareId, ownerUid: fbUser.uid,
      projectId: p.id, data: JSON.parse(JSON.stringify(p)),
      createdAt: serverTimestamp()
    }, { merge: true }).catch(() => {});
  }
};

deleteProject = async (p) => {
  delLS(p.id);
  if (!fbUser) return;
  await deleteDoc(doc(projsCol(), p.id));
};

// ── Override folders ops ──
async function saveFoldersRemote(folders) {
  if (!fbUser) return;
  // store as single doc for simplicity
  await setDoc(doc(db, 'users', fbUser.uid, 'meta', 'folders'), { list: folders });
}

async function loadFoldersRemote() {
  if (!fbUser) return loadFolders();
  try {
    const snap = await getDocs(collection(db, 'users', fbUser.uid, 'meta'));
    const d = snap.docs.find(d => d.id === 'folders');
    return d ? (d.data().list || []) : [];
  } catch { return loadFolders(); }
}

// Override storeFolders so every write also goes to Firestore
const _origStoreFolders = storeFolders;
// Write locally first (sync), then return the remote-save promise so callers
// can await it and guarantee the change is flushed to Firestore before exit.
const storeFoldersSync  = (f) => { _origStoreFolders(f); return saveFoldersRemote(f).catch(e => console.error('folder sync:', e)); };
// Replace globally — all calls to storeFolders now sync to cloud
storeFolders = storeFoldersSync;

// CSS auth-gate
onAuthStateChanged(auth, user => {
  document.body.classList[user ? 'add' : 'remove']('auth-ready');
});

window._mSignOut = async function() {
  if (!await _showConfirm('تسجيل الخروج؟', { confirmLabel: 'خروج' })) return;
  localStorage.removeItem(lsKey());
  localStorage.removeItem(lsFKey());
  cur = null; timers = {};
  await signOut(auth);
};

async function signOutUser() { window._mSignOut(); }

function _pillAvatarHtml(user, size = 'small') {
  const cls = size === 'large' ? 'profile-avatar-img' : 'user-avatar';
  const initCls = size === 'large' ? 'profile-avatar-initials' : 'user-avatar-initials';
  const initSize = size === 'large' ? 24 : 11;
  const initial = (user.displayName?.[0] || user.email?.[0] || '?').toUpperCase();
  if (user.photoURL) {
    return `<img class="${cls}" src="${user.photoURL}" alt="${user.displayName || user.email || 'مستخدم'}" loading="lazy" onerror="this.outerHTML='<div class=\\'${initCls}\\'>${initial}</div>'">`;
  }
  return `<div class="${initCls}" style="font-size:${initSize}px">${initial}</div>`;
}

function updateUserPill(user) {
  const pill     = document.getElementById('userPill');
  const cePill   = document.getElementById('ceUserPill');
  const loginBtn = document.getElementById('loginBtn');
  if (!user) {
    if (pill)   pill.style.display   = 'none';
    if (cePill) cePill.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    _closeProfileDropdown();
    return;
  }
  if (loginBtn) loginBtn.style.display = 'none';
  const name = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'مستخدم';
  const pillHtml = `
    <div class="user-pill" role="button" tabindex="0" onclick="toggleProfileDropdown(event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleProfileDropdown(event)}" title="الملف الشخصي" aria-label="الملف الشخصي لـ ${name}" aria-haspopup="true">
      ${_pillAvatarHtml(user)}
      <span>${name}</span>
    </div>`;
  if (pill)   { pill.style.display   = 'flex'; pill.innerHTML   = pillHtml; }
  if (cePill) { cePill.style.display = 'flex'; cePill.innerHTML = pillHtml; }
}

function _closeProfileDropdown() {
  document.getElementById('profileDropdown')?.remove();
}

window.toggleProfileDropdown = function(e) {
  e.stopPropagation();
  const existing = document.getElementById('profileDropdown');
  if (existing) { existing.remove(); return; }
  const user = fbUser;
  if (!user) return;
  const name = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'مستخدم';
  const drop = document.createElement('div');
  drop.className = 'profile-dropdown';
  drop.id = 'profileDropdown';
  drop.innerHTML = `
    <div class="profile-avatar-wrap">
      ${_pillAvatarHtml(user, 'large')}
      <div class="profile-name">${name}</div>
      <button class="profile-change-photo" onclick="document.getElementById('avatarFileInput').click()">تغيير الصورة الشخصية</button>
      <div class="profile-uploading" id="avatarUploadStatus" style="display:none">جارٍ الرفع...</div>
    </div>
    <hr class="profile-divider">
    <button class="btn btn-glass btn-sm" style="width:100%;justify-content:center;color:#111827;border-color:#e5e7eb" onclick="toggleTheme();_closeProfileDropdown()">${document.documentElement.getAttribute('data-theme') === 'light' ? '🌙 الوضع الداكن' : '☀️ الوضع الفاتح'}</button>
    <button class="btn btn-glass btn-sm" style="width:100%;justify-content:center;color:#111827;border-color:#e5e7eb" onclick="changeDisplayName()">✏️ تغيير الاسم</button>
    <button class="btn btn-glass btn-sm" style="width:100%;justify-content:center;color:#111827;border-color:#e5e7eb" onclick="signOutUser()">تسجيل الخروج</button>`;
  document.body.appendChild(drop);
  const rect = document.getElementById('userPill').getBoundingClientRect();
  drop.style.top  = (rect.bottom + 8) + 'px';
  const dropW = 210;
  drop.style.left = Math.max(8, rect.right - dropW) + 'px';
  setTimeout(() => document.addEventListener('click', _closeProfileDropdown, { once: true }), 0);
};

async function changeDisplayName(e) {
  e && e.stopPropagation && e.stopPropagation();
  _closeProfileDropdown();
  const current = auth.currentUser?.displayName || '';
  const newName = await _showPrompt('الاسم المعروض الجديد', current);
  if (!newName) return;
  const trimmed = newName.trim();
  try {
    await updateProfile(auth.currentUser, { displayName: trimmed });
    await saveUserProfile(auth.currentUser);
    updateUserPill(fbUser ? { ...fbUser, displayName: trimmed } : auth.currentUser);
  } catch(err) {
    _showToast('تعذّر تغيير الاسم: ' + err.message, 'error');
  }
}

// ── Init ──
(async () => {
  const savedTheme = localStorage.getItem('sm_theme') || 'light';
  applyTheme(savedTheme);

  // Check for project share link — works without login
  const shareId = new URLSearchParams(location.search).get('share');
  if (shareId) {
    document.body.classList.add('auth-ready');
    document.getElementById('loginPage').style.display = 'none';
    try {
      const snap = await getDoc(doc(db, 'sharedProjects', shareId));
      if (!snap.exists()) {
        _showToast('رابط المشاركة غير صالح أو انتهت صلاحيته.', 'error');
        setTimeout(() => location.href = location.pathname, 2500);
      } else {
        _viewOnlyData = snap.data().data;
        if (snap.data().mode === 'edit') {
          renderEditShare(shareId, _viewOnlyData);
        } else {
          renderViewOnly(_viewOnlyData);
        }
      }
    } catch(e) {
      alert('تعذّر تحميل المشروع المشارك.');
      location.href = location.pathname;
    }
    onAuthStateChanged(auth, user => { fbUser = user; updateUserPill(user); });
    return;
  }

  // Check for folder link — public access, no login required
  const folderLinkId = new URLSearchParams(location.search).get('folderLink');
  if (folderLinkId) {
    document.body.classList.add('auth-ready');
    document.getElementById('loginPage').style.display = 'none';
    onAuthStateChanged(auth, async user => {
      fbUser = user; updateUserPill(user);
    });
    await openFolderLink(folderLinkId);
    return;
  }

  let _userSharesUnsub = null;

  onAuthStateChanged(auth, async user => {
    fbUser = user;
    if (user) {
      // Load photoURL from Firestore (supports base64 avatars not stored in Auth)
      try {
        const profile = await getDoc(doc(db, 'userProfiles', user.uid));
        if (profile.exists() && profile.data().photoURL) {
          fbUser = { ...user, photoURL: profile.data().photoURL };
          user = fbUser;
        }
      } catch(_) {}
    }
    updateUserPill(user);

    if (!fbUser) {
      // Not logged in → show login page (body stays without auth-ready class)
      document.body.classList.remove('auth-ready');
      document.getElementById('projectPage').classList.remove('active');
      if (_userSharesUnsub) { _userSharesUnsub(); _userSharesUnsub = null; }
      _sharedFolders = [];
      return;
    }

    // Logged in → reveal app
    document.body.classList.add('auth-ready');
    document.getElementById('loginPage').style.display = 'none';
    _showSyncStatus(true);

    // ── Save user profile for email lookup ──
    await saveUserProfile(user).catch(() => {});

    // ── Process pending invites & load shared folders before first render ──
    await processPendingInvites(user).catch(() => {});
    await loadMySharedFolders().catch(() => {});

    // ── Real-time listener: update shared folders whenever owner adds this user ──
    if (_userSharesUnsub) _userSharesUnsub();
    _userSharesUnsub = onSnapshot(doc(db, 'userShares', user.uid), async () => {
      await loadMySharedFolders().catch(() => {});
      if (document.getElementById('homePage').classList.contains('active')) renderHome();
    }, err => { console.warn('userShares snapshot:', err); });

    // ── Sync folders: merge remote + local (last-write-wins by lastModified) ──
    const remoteFolders = await loadFoldersRemote();
    const localFolders  = loadFolders();
    const folderMap = {};
    for (const f of remoteFolders) folderMap[f.id] = f;
    for (const f of localFolders) {
      if (!folderMap[f.id] || (f.lastModified||0) >= (folderMap[f.id].lastModified||0)) folderMap[f.id] = f;
    }
    const mergedFolders = Object.values(folderMap);
    _origStoreFolders(mergedFolders);
    await saveFoldersRemote(mergedFolders).catch(() => {});

    // ── Push ALL local projects to Firestore unconditionally ──
    // This ensures any device with local data syncs it to the cloud on login
    const initLocal = loadLS();
    if (initLocal.length) {
      await Promise.all(initLocal.map(p => setDoc(doc(projsCol(), p.id), p).catch(() => {})));
    }

    // ── Clean up any trashed projects still in Firestore (e.g. failed delete) ──
    const trashedIds = new Set(loadTrash().map(p => p.id));
    if (trashedIds.size) {
      await Promise.all([...trashedIds].map(id => deleteDoc(doc(projsCol(), id)).catch(() => {})));
    }

    // ── Real-time listener: keeps all devices in sync automatically ──
    let _firstSnapshot = true;
    onSnapshot(projsCol(), snapshot => {
      const remote = snapshot.docs.map(d => d.data());
      const currentTrashedIds = new Set(loadTrash().map(p => p.id));

      // Merge: remote wins unless local version is strictly newer
      // Skip remote projects that are in local trash (user deleted them)
      const local = loadLS();
      const map = {};
      for (const p of remote) {
        if (!currentTrashedIds.has(p.id)) map[p.id] = p;
      }
      for (const p of local) {
        if (currentTrashedIds.has(p.id)) continue;
        if (!map[p.id] || (p.lastModified||0) > (map[p.id].lastModified||0)) map[p.id] = p;
      }
      storeLS(Object.values(map));

      if (_firstSnapshot) {
        _firstSnapshot = false;
        showHome();
      } else if (document.getElementById('homePage').classList.contains('active')) {
        renderHome();
      }
    }, err => { console.error('Snapshot error:', err); if (_firstSnapshot) { _firstSnapshot=false; showHome(); } });
  });
})();
