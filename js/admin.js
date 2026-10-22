/**
 * Sushmita Sharma Portfolio - Content Management System (Admin Controller)
 * Architecture: Static Client-Side CMS supporting GitHub Commits & File System Access API
 */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const SESSION_KEY     = 'adminSession';
  const GIT_KEY         = 'adminGit';
  const IDB_NAME        = 'portfolio-admin';
  const IDB_STORE_FILE  = 'h';
  const IDB_STORE_DIR   = 'dir';
  const MAX_ATTEMPTS    = 5;
  const LOCKOUT_MS      = 15 * 60 * 1000;
  const SESSION_MS      = 30 * 24 * 60 * 60 * 1000;
  const VIDEO_FOLDER    = 'media/videos';
  const IMAGES_FOLDER   = 'media/images';
  const DOCS_FOLDER     = 'media/docs';

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const dom = {
    gate:              $('gate'),
    panel:             $('panel'),
    editor:            $('editor'),
    loginForm:         $('lf'),
    loginMsg:          $('lmsg'),
    logoutBtn:         $('logout'),
    gitForm:           $('gf'),
    connectBtn:        $('connect'),
    forgetBtn:         $('forget'),
    downloadBtn:       $('dl'),
    downloadSitemapBtn:$('dlmap'),
    fileNote:          $('filenote'),
    entryForm:         $('f'),
    entriesContainer:  $('entries'),
    statusMsg:         $('msg'),
    saveBtn:           $('save'),
    cancelBtn:         $('cancel'),
    // Works-only fields
    dashboardUrlField: $('dashboard-url-field'),
    videoUploadField:  $('video-upload-field'),
    videoInput:        $('entry-video'),
    videoUploadPrompt: $('video-upload-prompt'),
    videoPreviewWrap:  $('video-preview-wrap'),
    videoPreview:      $('video-preview'),
    videoMeta:         $('video-meta'),
    videoClearBtn:     $('video-clear-btn'),
    videoCurrent:      $('video-current'),
    videoCurrentPath:  $('video-current-path'),
    videoRemoveSavedBtn:$('video-remove-saved-btn'),
    // Attachments (all entry types)
    attachDropzone:    $('attach-dropzone'),
    attachFileInput:   $('entry-attachments'),
    attachGrid:        $('attach-grid'),
  };

  // ── Runtime state ──────────────────────────────────────────────────────────
  let gitConfig         = null;
  let localFileHandle   = null;
  let cachedFileHandle  = null;
  let projectDirHandle  = null;
  let githubCommitSha   = '';
  let isSlugEdited      = false;
  let failedLoginCount  = 0;
  let lockoutTimestamp  = 0;

  // Video state
  let pendingVideoFile    = null;
  let removeExistingVideo = false;

  // Attachment state
  // Each item: { id, file (File|null), path, name, isImage, objectUrl }
  let attachItems    = [];
  let attachIdSeed   = 0;
  let attachDragSrc  = -1;
  const nextId       = () => `a${++attachIdSeed}`;

  const authConfig = window.SITE_AUTH;

  // ── Tiny helpers ───────────────────────────────────────────────────────────
  const setStatus = (msg) => { if (dom.statusMsg) dom.statusMsg.textContent = msg; };

  const slug = (text) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

  const todayIso = () => new Date().toISOString().slice(0, 10);

  const isImage = (name) => /\.(jpe?g|png|gif|webp|svg|bmp|avif|ico)$/i.test(name);

  const getJson = (key) => { try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; } catch { return null; } };
  const setJson = (key, val) => { try { val == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(val)); } catch {} };

  const triggerDownload = (name, content, mime) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── IndexedDB (persist file/dir handles across sessions) ──────────────────
  const openDb = () => new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_FILE)) db.createObjectStore(IDB_STORE_FILE);
      if (!db.objectStoreNames.contains(IDB_STORE_DIR))  db.createObjectStore(IDB_STORE_DIR);
    };
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });

  const idbGet = async (store, key) => {
    try {
      const db = await openDb();
      return new Promise(r => {
        const req = db.transaction(store, 'readonly').objectStore(store).get(key);
        req.onsuccess = () => r(req.result ?? null);
        req.onerror   = () => r(null);
      });
    } catch { return null; }
  };

  const idbSet = async (store, key, val) => {
    try {
      const db = await openDb();
      return new Promise(r => {
        const tx = db.transaction(store, 'readwrite');
        val ? tx.objectStore(store).put(val, key) : tx.objectStore(store).delete(key);
        tx.oncomplete = () => r(true);
        tx.onerror    = () => r(false);
      });
    } catch { return false; }
  };

  const getFileHandle = ()   => idbGet(IDB_STORE_FILE, 'file');
  const setFileHandle = (h)  => idbSet(IDB_STORE_FILE, 'file', h);
  const getDirHandle  = ()   => idbGet(IDB_STORE_DIR,  'root');
  const setDirHandle  = (h)  => idbSet(IDB_STORE_DIR,  'root', h);

  // ── Content serializer ─────────────────────────────────────────────────────
  const serialize = () =>
    `/* THE STORAGE FILE: all work and blog entries live here. Replace this file with the one downloaded from the admin panel to publish changes. */\nwindow.SITE_CONTENT = ${JSON.stringify({ works: window.App.store.works, posts: window.App.store.posts }, null, 2)};\n`;

  const parseScript = (text) => {
    try {
      const json = JSON.parse(text.slice(text.indexOf('=') + 1, text.lastIndexOf(';')).trim());
      return Array.isArray(json.works) && Array.isArray(json.posts) ? json : null;
    } catch { return null; }
  };

  const b64enc = (str) => { const b = new TextEncoder().encode(str); let s=''; b.forEach(x=>s+=String.fromCharCode(x)); return btoa(s); };
  const b64dec = (s)   => { const c = atob(s.replace(/\s/g,'')); const b = new Uint8Array(c.length); for(let i=0;i<c.length;i++) b[i]=c.charCodeAt(i); return new TextDecoder().decode(b); };

  // ── GitHub API helper ─────────────────────────────────────────────────────
  const ghFetch = async (method, path, body) => {
    const url = `https://api.github.com/repos/${gitConfig.repo}/contents/${path}${method==='GET'?`?ref=${encodeURIComponent(gitConfig.branch)}`:''}`;
    const r = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${gitConfig.token}`, Accept: 'application/vnd.github+json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status===401) throw new Error('GitHub token is invalid or expired.');
      if (r.status===404) throw new Error('Repository or file not found. Check repo name, branch, and token scope.');
      if (r.status===409) throw new Error('Conflict: file was modified remotely. Reload and try again.');
      throw new Error(d.message || `GitHub HTTP ${r.status}`);
    }
    return d;
  };

  // ── Persist a binary file (local or GitHub) ────────────────────────────────
  const saveFileToDisk = async (file, subfolder) => {
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
    const relPath  = `${subfolder}/${safeName}`;

    // ── GitHub upload ──────────────────────────────────────────────────────
    if (gitConfig) {
      const MAX_BYTES = 25 * 1024 * 1024;
      if (file.size > MAX_BYTES) {
        setStatus(`"${file.name}" exceeds 25 MB limit for GitHub. Skipped.`);
        return null;
      }
      try {
        const buf  = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = ''; bytes.forEach(b => binary += String.fromCharCode(b));
        const b64 = btoa(binary);

        // Check if the file already exists to get its SHA (needed for update)
        let existSha = '';
        try { const ex = await ghFetch('GET', relPath); existSha = ex.sha || ''; } catch {}

        await ghFetch('PUT', relPath, {
          message: `Add media: ${safeName}`,
          content: b64,
          branch: gitConfig.branch,
          ...(existSha ? { sha: existSha } : {})
        });
        return relPath;
      } catch (err) {
        setStatus(`Could not upload "${file.name}": ${err.message}`);
        return null;
      }
    }

    // ── Local FileSystem Access API ────────────────────────────────────────
    if (!projectDirHandle && window.showDirectoryPicker) {
      try {
        setStatus('Select your project root folder so files can be saved there…');
        projectDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await setDirHandle(projectDirHandle);
      } catch {
        // fallback: download
        triggerDownload(safeName, file, file.type);
        return relPath;
      }
    }

    if (projectDirHandle) {
      try {
        let perm = await projectDirHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') perm = await projectDirHandle.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') throw new Error('Permission denied');

        const [part1, part2] = subfolder.split('/'); // e.g. 'media', 'images'
        const mediaDir  = await projectDirHandle.getDirectoryHandle(part1, { create: true });
        const targetDir = await mediaDir.getDirectoryHandle(part2, { create: true });
        const fh = await targetDir.getFileHandle(safeName, { create: true });
        const wr = await fh.createWritable();
        await wr.write(file); await wr.close();
        return relPath;
      } catch (err) {
        setStatus(`Could not save "${file.name}": ${err.message}`);
        return null;
      }
    }

    // Final fallback: trigger browser download
    triggerDownload(safeName, file, file.type);
    setStatus(`Downloaded "${safeName}". Move it into your project's ${subfolder}/ folder.`);
    return relPath;
  };

  // ── Video helpers ─────────────────────────────────────────────────────────
  const clearVideoPreview = () => {
    pendingVideoFile = null;
    if (dom.videoInput)       dom.videoInput.value = '';
    if (dom.videoPreview)     { dom.videoPreview.pause(); dom.videoPreview.src = ''; }
    if (dom.videoPreviewWrap) dom.videoPreviewWrap.hidden = true;
    if (dom.videoUploadPrompt) dom.videoUploadPrompt.hidden = false;
  };

  const showVideoPreview = (file) => {
    if (!dom.videoPreview) return;
    dom.videoPreview.src = URL.createObjectURL(file);
    if (dom.videoMeta) dom.videoMeta.textContent = `${file.name}  ·  ${(file.size/(1024*1024)).toFixed(1)} MB`;
    if (dom.videoUploadPrompt) dom.videoUploadPrompt.hidden = true;
    if (dom.videoPreviewWrap)  dom.videoPreviewWrap.hidden = false;
  };

  if (dom.videoInput) {
    dom.videoInput.addEventListener('change', (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      pendingVideoFile = f; showVideoPreview(f);
    });
  }
  if (dom.videoClearBtn)      dom.videoClearBtn.addEventListener('click', clearVideoPreview);
  if (dom.videoRemoveSavedBtn) {
    dom.videoRemoveSavedBtn.addEventListener('click', () => {
      removeExistingVideo = true;
      if (dom.videoCurrent) dom.videoCurrent.hidden = true;
    });
  }

  const resolveVideo = async (existing) => {
    if (removeExistingVideo && !pendingVideoFile) return '';
    if (!pendingVideoFile) return existing || '';
    return (await saveFileToDisk(pendingVideoFile, VIDEO_FOLDER)) || existing || '';
  };

  // ── Attachment helpers ────────────────────────────────────────────────────

  /** Revoke all blob URLs and empty the items array. */
  const clearAttachments = () => {
    attachItems.forEach(i => { if (i.objectUrl) URL.revokeObjectURL(i.objectUrl); });
    attachItems = [];
    renderAttachGrid();
  };

  /** Add File objects from a FileList into the items array. */
  const addFiles = (fileList) => {
    for (const f of Array.from(fileList)) {
      const img = isImage(f.name);
      attachItems.push({
        id: nextId(),
        file: f,
        path: '',
        name: f.name,
        isImage: img,
        objectUrl: img ? URL.createObjectURL(f) : null,
      });
    }
    renderAttachGrid();
  };

  /** Populate items from an existing saved `attachments` path array. */
  const loadExistingAttachments = (paths) => {
    clearAttachments();
    (paths || []).forEach(p => {
      const name = p.split('/').pop();
      attachItems.push({ id: nextId(), file: null, path: p, name, isImage: isImage(name), objectUrl: null });
    });
    renderAttachGrid();
  };

  /** Render the drag-sortable grid of attachment cards. */
  const renderAttachGrid = () => {
    const grid = dom.attachGrid;
    if (!grid) return;
    if (!attachItems.length) { grid.innerHTML = ''; return; }

    grid.innerHTML = attachItems.map((item, idx) => {
      const thumb = item.isImage
        ? `<img src="${item.objectUrl || item.path}" alt="${item.name}" class="ac-thumb" loading="lazy">`
        : `<div class="ac-doc-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>`;
      return `
        <div class="attach-card" data-id="${item.id}" draggable="true">
          <div class="ac-order">${idx + 1}</div>
          <div class="ac-drag-handle" title="Drag to reorder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="8" x2="19" y2="8"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="16" x2="19" y2="16"/></svg>
          </div>
          <button type="button" class="ac-remove" data-rid="${item.id}" title="Remove" aria-label="Remove ${item.name}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          ${thumb}
          <div class="ac-name" title="${item.name}">${item.name}</div>
          ${!item.file ? '<span class="ac-saved-badge">saved</span>' : ''}
        </div>`;
    }).join('');

    // Remove buttons
    grid.querySelectorAll('[data-rid]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = attachItems.findIndex(i => i.id === btn.dataset.rid);
        if (idx >= 0) {
          if (attachItems[idx].objectUrl) URL.revokeObjectURL(attachItems[idx].objectUrl);
          attachItems.splice(idx, 1);
          renderAttachGrid();
        }
      });
    });

    // HTML5 Drag-and-Drop reorder
    let overIdx = -1;
    grid.querySelectorAll('.attach-card').forEach((card, ci) => {
      card.addEventListener('dragstart', (e) => {
        attachDragSrc = ci;
        card.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        grid.querySelectorAll('.attach-card').forEach(c => c.classList.remove('drag-over'));
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        grid.querySelectorAll('.attach-card').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
        overIdx = ci;
      });
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        if (attachDragSrc !== -1 && attachDragSrc !== overIdx) {
          const [moved] = attachItems.splice(attachDragSrc, 1);
          attachItems.splice(overIdx, 0, moved);
          attachDragSrc = -1; overIdx = -1;
          renderAttachGrid();
        }
      });
    });
  };

  // Wire up the dropzone (click = file picker, drag-over = highlight, drop = add files)
  if (dom.attachFileInput) {
    dom.attachFileInput.addEventListener('change', (e) => {
      if (e.target.files?.length) addFiles(e.target.files);
      dom.attachFileInput.value = ''; // allow re-selecting same files
    });
  }
  if (dom.attachDropzone) {
    dom.attachDropzone.addEventListener('dragover', (e) => {
      e.preventDefault(); dom.attachDropzone.classList.add('dragover');
    });
    dom.attachDropzone.addEventListener('dragleave', () => {
      dom.attachDropzone.classList.remove('dragover');
    });
    dom.attachDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dom.attachDropzone.classList.remove('dragover');
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    });
  }

  /** Save all new attachment files; return ordered array of resolved paths. */
  const resolveAttachments = async () => {
    const paths = [];
    for (const item of attachItems) {
      if (item.file) {
        const folder = item.isImage ? IMAGES_FOLDER : DOCS_FOLDER;
        const p = await saveFileToDisk(item.file, folder);
        if (p) paths.push(p);
      } else if (item.path) {
        paths.push(item.path);
      }
    }
    return paths;
  };

  // ── Works-only field toggle ────────────────────────────────────────────────
  const syncWorksFields = () => {
    if (!dom.entryForm) return;
    const isWork = dom.entryForm.kind.value === 'works';
    if (dom.dashboardUrlField) dom.dashboardUrlField.style.display = isWork ? '' : 'none';
    if (dom.videoUploadField)  dom.videoUploadField.style.display  = isWork ? '' : 'none';
    if (!isWork) {
      const di = $('entry-dashboard-url');
      if (di) di.value = '';
      clearVideoPreview();
    }
  };

  // ── Auth ──────────────────────────────────────────────────────────────────
  const showDashboard = () => {
    if (dom.gate)  dom.gate.hidden  = true;
    if (dom.panel) dom.panel.hidden = false;
    restoreConnection();
  };

  if (!authConfig) {
    if (dom.loginMsg) dom.loginMsg.textContent = 'No admin account configured yet. Open setup.html to generate one.';
    const btn = dom.loginForm?.querySelector('button');
    if (btn) btn.disabled = true;
  }

  if (dom.loginForm) {
    dom.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!authConfig) return;
      if (Date.now() < lockoutTimestamp) {
        dom.loginMsg.textContent = 'Too many attempts. Please wait 15 minutes.';
        return;
      }
      const user = dom.loginForm.username.value.trim();
      const pass = dom.loginForm.password.value;
      try {
        const hash = await window.Auth.derive(pass, authConfig.salt, authConfig.iter);
        if (hash === authConfig.hash && user === authConfig.user) {
          failedLoginCount = 0;
          setJson(SESSION_KEY, { exp: Date.now() + SESSION_MS });
          dom.loginForm.reset();
          showDashboard();
        } else {
          if (++failedLoginCount >= MAX_ATTEMPTS) { lockoutTimestamp = Date.now() + LOCKOUT_MS; failedLoginCount = 0; }
          dom.loginMsg.textContent = 'Invalid username or password.';
          dom.loginForm.password.value = '';
        }
      } catch (err) { dom.loginMsg.textContent = err.message; }
    });
  }

  if (dom.logoutBtn) dom.logoutBtn.addEventListener('click', () => { setJson(SESSION_KEY, null); location.reload(); });

  const sess = getJson(SESSION_KEY);
  if (authConfig && sess?.exp > Date.now()) showDashboard();

  // ── GitHub / local persistence ─────────────────────────────────────────────
  const loadFromGitHub = async () => {
    const r = await ghFetch('GET', 'data/content.js');
    githubCommitSha = r.sha;
    const parsed = parseScript(b64dec(r.content));
    if (!parsed) throw new Error('data/content.js on GitHub does not contain valid structured data.');
    return parsed;
  };

  const persist = async () => {
    if (gitConfig) {
      try {
        const result = await ghFetch('PUT', 'data/content.js', {
          message: 'Update content via portfolio admin panel',
          content: b64enc(serialize()),
          sha: githubCommitSha,
          branch: gitConfig.branch
        });
        githubCommitSha = result.content.sha;
        return true;
      } catch (err) { setStatus(`Could not save to GitHub: ${err.message}`); return false; }
    }
    if (!localFileHandle) { setStatus('Please connect your website or local file before saving.'); return false; }
    try {
      const wr = await localFileHandle.createWritable();
      await wr.write(serialize()); await wr.close();
      return true;
    } catch (err) { setStatus(`Could not write to local file: ${err.message}`); return false; }
  };

  const activateEditor = (data, note) => {
    window.App.set(data);
    if (dom.editor)     dom.editor.hidden   = false;
    if (dom.gitForm)    dom.gitForm.hidden  = true;
    if (dom.connectBtn) dom.connectBtn.hidden = true;
    if (dom.forgetBtn)  dom.forgetBtn.hidden  = false;
    if (dom.fileNote)   dom.fileNote.textContent = note;
    setStatus(''); resetForm(); renderList();
  };

  // GitHub form
  if (dom.gitForm) {
    dom.gitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawUrl = dom.gitForm.url.value.trim();
      let repo = dom.gitForm.repo.value.trim();
      const m = /^https?:\/\/([^\/.]+)\.github\.io(?:\/([^\/?#]+))?/i.exec(rawUrl);
      if (!repo && m) repo = `${m[1]}/${m[2] || `${m[1]}.github.io`}`;
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { setStatus('Enter your GitHub repository as owner/repo.'); return; }
      gitConfig = { url: rawUrl, repo, branch: dom.gitForm.branch.value.trim() || 'main', token: dom.gitForm.token.value.trim() };
      dom.gitForm.repo.value = repo;
      setStatus('Connecting to GitHub repository…');
      try {
        const data = await loadFromGitHub();
        setJson(GIT_KEY, gitConfig);
        dom.gitForm.token.value = '';
        activateEditor(data, `Connected to ${gitConfig.repo}. Changes are committed automatically.`);
      } catch (err) { gitConfig = null; setStatus(err.message); }
    });
  }

  // Local file picker
  const attachLocalHandle = async (handle, prompt) => {
    let perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted' && prompt) perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return false;
    const text = await (await handle.getFile()).text();
    const data = parseScript(text);
    if (!data) { setStatus('The selected file is not a valid content.js file.'); return false; }
    await setFileHandle(handle);
    localFileHandle = handle;
    activateEditor(data, 'Connected to your local content.js. All edits save directly to disk instantly.');
    return true;
  };

  if (dom.connectBtn) {
    dom.connectBtn.addEventListener('click', async () => {
      if (!window.showOpenFilePicker) { setStatus('Your browser does not support the File System Access API. Use Chrome/Edge or connect via GitHub.'); return; }
      try {
        let handle = cachedFileHandle;
        if (!handle) {
          const files = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'content.js', accept: { 'text/javascript': ['.js'] } }] });
          handle = files[0];
          if (handle.name !== 'content.js') { setStatus("Please select the file named 'content.js' inside the data/ folder."); return; }
        }
        if (!(await attachLocalHandle(handle, true))) setStatus('Write permission was not granted.');
      } catch {
        if (cachedFileHandle) {
          cachedFileHandle = null; await setFileHandle(null);
          dom.connectBtn.textContent = 'Use a local file instead';
          setStatus('Could not open the saved file handle. Please select it again.');
        } else { setStatus('File selection was cancelled.'); }
      }
    });
  }

  if (dom.forgetBtn) {
    dom.forgetBtn.addEventListener('click', async () => {
      setJson(GIT_KEY, null); await setFileHandle(null); await setDirHandle(null); location.reload();
    });
  }

  async function restoreConnection() {
    const saved = getJson(GIT_KEY);
    if (saved) {
      gitConfig = saved;
      if (dom.gitForm) { dom.gitForm.url.value = saved.url || ''; dom.gitForm.repo.value = saved.repo || ''; dom.gitForm.branch.value = saved.branch || 'main'; }
      setStatus('Reconnecting to GitHub…');
      try { const data = await loadFromGitHub(); activateEditor(data, `Connected to ${gitConfig.repo}.`); return; }
      catch (err) { setStatus(`Reconnection failed: ${err.message}`); gitConfig = null; return; }
    }
    if (!window.showOpenFilePicker) return;
    cachedFileHandle = await getFileHandle();
    projectDirHandle = await getDirHandle();
    if (!cachedFileHandle) return;
    try {
      if (!(await attachLocalHandle(cachedFileHandle, false))) {
        if (dom.connectBtn) dom.connectBtn.textContent = 'Allow access to local content.js';
        if (dom.fileNote)   dom.fileNote.textContent   = 'Welcome back. Click "Allow access" to reconnect.';
      }
    } catch { cachedFileHandle = null; await setFileHandle(null); }
  }

  // Downloads
  if (dom.downloadBtn) dom.downloadBtn.addEventListener('click', () => triggerDownload('content.js', serialize(), 'text/javascript;charset=utf-8'));

  if (dom.downloadSitemapBtn) {
    dom.downloadSitemapBtn.addEventListener('click', () => {
      const base = (dom.gitForm?.url.value.trim() || '').replace(/\/$/, '');
      if (!/^https?:\/\//.test(base)) { setStatus('Enter a valid website URL in the connection box first.'); return; }
      const pages = ['index.html','about.html','work.html','blog.html'].map(p=>[p]);
      window.App.all('works').forEach(i => pages.push([`work-detail.html?slug=${encodeURIComponent(i.slug)}`, i.date]));
      window.App.all('posts').forEach(i => pages.push([`blog-post.html?slug=${encodeURIComponent(i.slug)}`,  i.date]));
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p,d])=>`  <url>\n    <loc>${window.App.esc(`${base}/${p}`)}</loc>${d?`\n    <lastmod>${d}</lastmod>`:''}\n  </url>`).join('\n')}\n</urlset>\n`;
      triggerDownload('sitemap.xml', xml, 'application/xml;charset=utf-8');
      setStatus('sitemap.xml downloaded. Place it in the root folder of your website.');
    });
  }

  // ── CMS CRUD ──────────────────────────────────────────────────────────────
  const validate = (e) => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug) || e.slug.length > 80) return 'Slug: lowercase letters, numbers and hyphens (max 80 chars).';
    if (!e.title || e.title.length > 120) return 'Title is required (up to 120 characters).';
    if (!e.summary || e.summary.length > 200) return 'Summary is required (up to 200 characters).';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return 'Date must be YYYY-MM-DD.';
    if (!e.body) return 'Content body is required.';
    return '';
  };

  const resetForm = () => {
    if (!dom.entryForm) return;
    dom.entryForm.reset();
    dom.entryForm.orig.value = '';
    dom.entryForm.kind.disabled = false;
    dom.entryForm.date.value = todayIso();
    if (dom.saveBtn)   dom.saveBtn.textContent = 'Add entry';
    if (dom.cancelBtn) dom.cancelBtn.hidden = true;
    isSlugEdited = false;
    // Reset video state
    pendingVideoFile = null; removeExistingVideo = false;
    clearVideoPreview();
    if (dom.videoCurrent) dom.videoCurrent.hidden = true;
    if (dom.videoCurrentPath) dom.videoCurrentPath.textContent = '';
    // Reset attachments
    clearAttachments();
    syncWorksFields();
  };

  const renderList = () => {
    if (!dom.entriesContainer) return;
    let html = '';
    [['works','Work'],['posts','Blog']].forEach(([col, label]) => {
      window.App.all(col).forEach(item => {
        html += `
          <div class="li">
            <span class="li-title"><span class="li-type-badge">${label}</span>${window.App.esc(item.title)}</span>
            <span class="li-actions">
              <button class="o" type="button" data-edit="${col}|${window.App.esc(item.slug)}">Edit</button>
              <button class="o" type="button" data-delete="${col}|${window.App.esc(item.slug)}">Delete</button>
            </span>
          </div>`;
      });
    });
    dom.entriesContainer.innerHTML = html || '<p class="note">No entries created yet.</p>';

    // Edit
    dom.entriesContainer.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [col, sl] = btn.dataset.edit.split('|');
        const item = (window.App.store[col] || []).find(e => e.slug === sl);
        if (!item || !dom.entryForm) return;

        dom.entryForm.kind.value     = col;
        dom.entryForm.kind.disabled  = true;
        dom.entryForm.orig.value     = item.slug;
        dom.entryForm.title.value    = item.title;
        dom.entryForm.slug.value     = item.slug;
        dom.entryForm.summary.value  = item.summary;
        dom.entryForm.tags.value     = (item.tags || []).join(', ');
        dom.entryForm.date.value     = item.date;
        dom.entryForm.body.value     = item.body;

        // Dashboard URL
        const di = $('entry-dashboard-url');
        if (di) di.value = item.dashboardUrl || '';

        // Video
        pendingVideoFile = null; removeExistingVideo = false; clearVideoPreview();
        if (item.videoPath && dom.videoCurrent && dom.videoCurrentPath) {
          dom.videoCurrentPath.textContent = item.videoPath;
          dom.videoCurrent.hidden = false;
        } else if (dom.videoCurrent) dom.videoCurrent.hidden = true;

        // Attachments
        loadExistingAttachments(item.attachments);

        syncWorksFields();
        if (dom.saveBtn)   dom.saveBtn.textContent = 'Save changes';
        if (dom.cancelBtn) dom.cancelBtn.hidden = false;
        isSlugEdited = true;
        setStatus(`Editing: "${item.title}"`);
        dom.entryForm.scrollIntoView({ behavior: 'smooth' });
      });
    });

    // Delete
    dom.entriesContainer.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const [col, sl] = btn.dataset.delete.split('|');
        if (!confirm(`Permanently delete "${sl}"?`)) return;
        const prev = window.App.store[col];
        window.App.store[col] = prev.filter(e => e.slug !== sl);
        setStatus('Saving deletion…');
        if (await persist()) { renderList(); setStatus('Entry deleted.'); }
        else window.App.store[col] = prev;
      });
    });
  };

  if (dom.entryForm) {
    dom.entryForm.title.addEventListener('input', () => {
      if (!isSlugEdited && !dom.entryForm.orig.value)
        dom.entryForm.slug.value = slug(dom.entryForm.title.value);
    });
    dom.entryForm.slug.addEventListener('input', () => { isSlugEdited = true; });
    dom.entryForm.kind.addEventListener('change', syncWorksFields);

    if (dom.cancelBtn) dom.cancelBtn.addEventListener('click', () => { resetForm(); setStatus('Edit cancelled.'); });

    dom.entryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const kind = dom.entryForm.kind.value;
      const orig = dom.entryForm.orig.value;

      // Dashboard URL (works only)
      const di = $('entry-dashboard-url');
      const dashUrl = (di && kind === 'works') ? di.value.trim() : '';

      // Existing video path
      const existingEntry = orig ? (window.App.store[kind] || []).find(e => e.slug === orig) : null;
      const existingVideo = existingEntry?.videoPath || '';

      const entry = {
        slug:    dom.entryForm.slug.value.trim(),
        title:   dom.entryForm.title.value.trim(),
        summary: dom.entryForm.summary.value.trim(),
        tags:    dom.entryForm.tags.value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10),
        date:    dom.entryForm.date.value,
        body:    dom.entryForm.body.value.trim(),
      };

      if (dashUrl) entry.dashboardUrl = dashUrl;

      const err = validate(entry);
      if (err) { setStatus(err); return; }

      // Save video (works only)
      if (kind === 'works') {
        setStatus('Processing video…');
        const vp = await resolveVideo(existingVideo);
        if (vp) entry.videoPath = vp;
      }

      // Save attachments
      if (attachItems.length > 0) {
        setStatus('Saving attachments…');
        const paths = await resolveAttachments();
        if (paths.length) entry.attachments = paths;
      } else if (existingEntry?.attachments?.length) {
        // Keep existing if none selected (user didn't change them)
        // loadExistingAttachments already put them in attachItems; if user removed all, paths will be []
        // If attachItems is empty AND there were existing ones, that means user removed all
        // (loadExistingAttachments was called → user deleted each one → attachItems=[] → no attachments key)
      }

      const col = window.App.store[kind] || [];
      const idx = orig ? col.findIndex(i => i.slug === orig) : -1;

      if (col.some((i, n) => i.slug === entry.slug && n !== idx)) {
        setStatus('An entry with that slug already exists.'); return;
      }

      const backup = [...col];
      idx >= 0 ? (col[idx] = entry) : col.push(entry);

      setStatus('Saving entry…');
      if (await persist()) {
        renderList();
        setStatus(orig ? 'Changes saved successfully.' : 'New entry published successfully.');
        resetForm();
      } else window.App.store[kind] = backup;
    });
  }
})();
