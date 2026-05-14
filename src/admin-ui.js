export function getAdminHTML() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Nginx-CF 管理面板</title>
  <style>
    :root{color-scheme:dark;--bg:#141414;--card:#1e1e1e;--border:#2a2a2a;--text:#f5f5f5;--muted:#9ca3af;--accent:#4f8cff;--accent-soft:rgba(79,140,255,.12);--success:#22c55e;--danger:#ef4444;--warning:#f59e0b;--shadow:0 18px 40px rgba(0,0,0,.28)}
    *{box-sizing:border-box}
    html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    button,input,textarea{font:inherit}
    button{border:1px solid var(--border);background:#252525;color:var(--text);border-radius:10px;padding:10px 14px;cursor:pointer;transition:.2s}
    button:hover{border-color:#3a3a3a;transform:translateY(-1px)}
    button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
    button.danger{background:rgba(239,68,68,.12);color:#fca5a5;border-color:rgba(239,68,68,.2)}
    button.success{background:rgba(34,197,94,.12);color:#86efac;border-color:rgba(34,197,94,.2)}
    button:disabled{opacity:.4;cursor:not-allowed;transform:none}
    input,textarea{width:100%;border:1px solid var(--border);border-radius:10px;padding:11px 12px;background:#181818;color:var(--text);outline:none;resize:vertical}
    input:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
    .hidden{display:none!important}
    /* ── Setup Wizard ── */
    .setup-shell{min-height:100vh;display:grid;place-items:center;padding:24px}
    .setup-card{width:min(100%,480px);background:var(--card);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow);padding:32px}
    .setup-logo{font-size:26px;font-weight:900;letter-spacing:.04em;margin-bottom:4px}
    .setup-sub{color:var(--muted);margin-bottom:28px}
    .step-indicator{display:flex;gap:8px;margin-bottom:28px}
    .step-dot{flex:1;height:4px;border-radius:2px;background:var(--border);transition:.3s}
    .step-dot.active{background:var(--accent)}
    .step-dot.done{background:var(--success)}
    .step-title{font-size:18px;font-weight:700;margin-bottom:6px}
    .step-desc{color:var(--muted);margin-bottom:20px;font-size:13px}
    .field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
    .field label{font-size:13px;color:var(--muted)}
    .error-msg{color:#fca5a5;font-size:13px;min-height:20px}
    .success-box{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:12px;padding:16px;text-align:center;margin-bottom:20px}
    .success-icon{font-size:32px;margin-bottom:8px}
    .url-box{background:#181818;border:1px solid var(--border);border-radius:10px;padding:12px;font-family:monospace;font-size:13px;word-break:break-all;margin:8px 0}
    /* ── Login ── */
    .login-shell{min-height:100vh;display:grid;place-items:center;padding:24px}
    .login-card{width:min(100%,420px);background:var(--card);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow);padding:28px}
    .login-title{font-size:24px;font-weight:800;margin-bottom:4px}
    .login-sub{color:var(--muted);margin-bottom:20px}
    /* ── App ── */
    .app-shell{display:flex;flex-direction:column;min-height:100vh}
    .topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 24px;border-bottom:1px solid var(--border);background:rgba(20,20,20,.92);backdrop-filter:blur(12px);position:sticky;top:0;z-index:20}
    .brand{font-size:20px;font-weight:800;letter-spacing:.04em}
    .topbar-right{display:flex;align-items:center;gap:10px}
    .tag{padding:5px 10px;border-radius:999px;border:1px solid var(--border);color:var(--muted);font-size:12px}
    .tag.ok{border-color:rgba(34,197,94,.3);color:#86efac;background:rgba(34,197,94,.08)}
    .tag.warn{border-color:rgba(245,158,11,.3);color:#fcd34d;background:rgba(245,158,11,.08)}
    .layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px;padding:24px;flex:1}
    .sidebar,.main-panel{background:var(--card);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow)}
    .sidebar{padding:18px;min-height:0}
    .sidebar-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .sidebar-title,.main-title{font-size:18px;font-weight:700}
    .sidebar-list{display:flex;flex-direction:column;gap:10px;max-height:calc(100vh - 220px);overflow:auto}
    .sidebar-item{width:100%;padding:12px;border-radius:14px;background:#181818;border:1px solid transparent;text-align:left;cursor:pointer}
    .sidebar-item:hover,.sidebar-item.active{border-color:var(--accent);background:rgba(79,140,255,.08)}
    .dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto;background:var(--danger)}
    .dot.healthy{background:var(--success)}
    .truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .sidebar-meta{margin-top:6px;color:var(--muted);font-size:12px}
    .main-panel{padding:22px;min-width:0}
    .toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
    .toolbar-right{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .search-wrap{min-width:180px;flex:1}
    .table-wrap{border:1px solid var(--border);border-radius:16px;overflow:hidden;background:#181818}
    table{width:100%;border-collapse:collapse}
    th,td{padding:14px 16px;border-bottom:1px solid var(--border);text-align:left;vertical-align:middle}
    th{color:var(--muted);font-weight:600;background:rgba(255,255,255,.02)}
    tbody tr:last-child td{border-bottom:none}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:12px;border:1px solid transparent}
    .badge.healthy{color:#86efac;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.18)}
    .badge.unhealthy{color:#fca5a5;background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.18)}
    .empty-state{padding:48px 20px;text-align:center;color:var(--muted)}
    .pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap}
    .pagination-controls{display:flex;gap:8px}
    .footer{padding:16px 24px 24px;text-align:center;color:var(--muted);font-size:12px}
    .modal{position:fixed;inset:0;background:rgba(0,0,0,.52);display:grid;place-items:center;padding:24px;z-index:30}
    .modal-card{width:min(100%,460px);background:var(--card);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow);padding:24px}
    .modal-header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}
    .modal-title{font-size:18px;font-weight:700}
    .muted{color:var(--muted)}
    .text-right{text-align:right}
    @media(max-width:900px){.layout{grid-template-columns:1fr;padding:16px}.sidebar-list{flex-direction:row;overflow:auto;max-height:none}.sidebar-item{min-width:200px}}
    @media(max-width:640px){.topbar{margin:12px 12px 0;padding:14px;border-radius:16px}.layout{padding:12px;gap:12px}.table-wrap{overflow-x:auto}table{min-width:640px}}
  </style>
</head>
<body>

<!-- ══════════════ SETUP WIZARD ══════════════ -->
<section id="setupView" class="setup-shell hidden">
  <div class="setup-card">
    <div class="setup-logo">🚀 Nginx-CF</div>
    <div class="setup-sub">欢迎！首次使用请完成初始化配置</div>
    <div class="step-indicator">
      <div class="step-dot active" id="dot0"></div>
      <div class="step-dot" id="dot1"></div>
      <div class="step-dot" id="dot2"></div>
    </div>

    <!-- Step 0: Set token -->
    <div id="step0">
      <div class="step-title">第一步：设置管理员密码</div>
      <div class="step-desc">这是你登录管理面板的密码，请设置一个强密码并妥善保存，之后无法在面板内查看。</div>
      <div class="field"><label>管理员密码（至少 8 位）</label><input id="s0token" type="password" placeholder="请输入密码"/></div>
      <div class="field"><label>确认密码</label><input id="s0confirm" type="password" placeholder="再次输入密码"/></div>
      <div class="error-msg" id="s0err"></div>
      <button class="primary" style="width:100%" onclick="goStep1()">下一步 →</button>
    </div>

    <!-- Step 1: Upstreams -->
    <div id="step1" class="hidden">
      <div class="step-title">第二步：填写上游地址</div>
      <div class="step-desc">填写你的后端服务器地址，每行一个，支持多个地址自动健康选优。</div>
      <div class="field">
        <label>上游地址（每行一个）</label>
        <textarea id="s1upstreams" rows="4" placeholder="https://your-server.example.com&#10;https://backup.example.com"></textarea>
      </div>
      <div class="error-msg" id="s1err"></div>
      <div style="display:flex;gap:8px">
        <button onclick="gotoStep(0)" style="flex:1">← 上一步</button>
        <button class="primary" style="flex:2" onclick="submitSetup()">完成初始化</button>
      </div>
    </div>

    <!-- Step 2: Done -->
    <div id="step2" class="hidden">
      <div class="success-box">
        <div class="success-icon">✅</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">初始化完成！</div>
        <div class="muted" style="font-size:13px">Nginx-CF 已就绪，可以开始使用了。</div>
      </div>
      <div id="memoryModeWarn" class="hidden" style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:12px;margin-bottom:14px;font-size:13px;color:#fcd34d">
        ⚠️ 当前运行在内存模式（未绑定 KV），配置将在 Worker 重启后丢失。如需持久化，请在 Cloudflare Dashboard → Worker → Settings → Bindings 里绑定 KV 命名空间。
      </div>
      <div class="step-desc">你的 Worker 地址：</div>
      <div class="url-box" id="workerUrl"></div>
      <button class="primary" style="width:100%;margin-top:8px" onclick="enterPanel()">进入管理面板 →</button>
    </div>
  </div>
</section>

<!-- ══════════════ LOGIN ══════════════ -->
<section id="loginView" class="login-shell hidden">
  <div class="login-card">
    <div class="login-title">Nginx-CF</div>
    <div class="login-sub">输入管理员密码进入管理面板</div>
    <div class="field" style="margin-top:16px"><label>管理员密码</label><input id="tokenInput" type="password" placeholder="X-Admin-Token" autocomplete="off"/></div>
    <div class="error-msg" id="loginErr"></div>
    <button class="primary" style="width:100%;margin-top:4px" onclick="doLogin()">登录</button>
  </div>
</section>

<!-- ══════════════ APP ══════════════ -->
<section id="appView" class="app-shell hidden">
  <header class="topbar">
    <div class="brand">Nginx-CF</div>
    <div class="topbar-right">
      <span class="tag" id="kvTag">KV</span>
      <span class="tag" id="timeTag"></span>
      <button onclick="doLogout()">退出</button>
    </div>
  </header>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-title">上游列表</div>
        <span id="sidebarCount" class="muted">0</span>
      </div>
      <div id="sidebarList" class="sidebar-list"></div>
    </aside>
    <main class="main-panel">
      <div class="toolbar">
        <div>
          <div class="main-title">上游管理</div>
          <div class="muted">查看状态、增删上游、触发健康检查</div>
        </div>
        <div class="toolbar-right">
          <div class="search-wrap"><input id="searchInput" type="search" placeholder="搜索 URL..." oninput="renderTable()"/></div>
          <button id="refreshBtn" onclick="doRefresh(this)">↻ 刷新</button>
          <button class="success" id="healthBtn" onclick="triggerHealth()">⚡ 立即健康检查</button>
          <button class="primary" onclick="openAddModal()">＋ 添加上游</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>URL</th><th>备注</th><th>状态</th><th>延迟</th><th>最后检查</th><th class="text-right">操作</th></tr></thead>
          <tbody id="tableBody"></tbody>
        </table>
        <div id="emptyState" class="empty-state hidden">暂无上游，点击「添加上游」开始配置。</div>
      </div>
      <div class="pagination">
        <div id="pageInfo" class="muted"></div>
        <div class="pagination-controls">
          <button id="prevBtn" onclick="changePage(-1)">← 上一页</button>
          <button id="nextBtn" onclick="changePage(1)">下一页 →</button>
        </div>
      </div>
    </main>
  </div>
  <footer class="footer">Nginx-CF v1.1.0 · <span id="nowLabel"></span></footer>
</section>

  <!-- Modal -->
  <div id="modal" class="modal hidden">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-title" id="modalTitle">添加上游</div>
        <button onclick="closeModal()">✕</button>
      </div>
      <div class="field"><label>URL 地址</label><input id="modalUrl" type="url" placeholder="https://your-server.example.com"/></div>
      <div class="field"><label>备注（可选）</label><input id="modalNote" type="text" placeholder="例如：主站点 / 备用节点"/></div>
      <div class="error-msg" id="modalErr"></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button style="flex:1" onclick="closeModal()">取消</button>
        <button class="primary" style="flex:2" onclick="submitModal()">确认</button>
      </div>
    </div>
  </div>

<script>
// ── State ──
let TOKEN = '';
let allUpstreams = [];
let allHealth = [];
let page = 1;
const PAGE_SIZE = 10;
let editingIndex = -1;

// ── Boot ──
(async function boot() {
  const res = await fetch('/_admin/setup-status').catch(() => null);
  if (!res || !res.ok) { show('loginView'); return; }
  const data = await res.json();
  if (!data.setupDone) { show('setupView'); return; }
  const saved = sessionStorage.getItem('ngx_token');
  if (saved) { TOKEN = saved; show('appView'); await loadStatus(); }
  else show('loginView');
})();

function show(id) {
  ['setupView','loginView','appView'].forEach(v => document.getElementById(v).classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ── Setup Wizard ──
let s0token = '';
function gotoStep(n) {
  [0,1,2].forEach(i => {
    document.getElementById('step'+i).classList.toggle('hidden', i !== n);
    const dot = document.getElementById('dot'+i);
    dot.className = 'step-dot' + (i < n ? ' done' : i === n ? ' active' : '');
  });
}
function goStep1() {
  const t = document.getElementById('s0token').value.trim();
  const c = document.getElementById('s0confirm').value.trim();
  const err = document.getElementById('s0err');
  if (t.length < 8) { err.textContent = '密码至少 8 位'; return; }
  if (t !== c) { err.textContent = '两次密码不一致'; return; }
  err.textContent = '';
  s0token = t;
  gotoStep(1);
}
async function submitSetup() {
  const raw = document.getElementById('s1upstreams').value;
  const upstreams = raw.split('\\n').map(s => s.trim()).filter(Boolean);
  const err = document.getElementById('s1err');
  if (upstreams.length === 0) { err.textContent = '请至少填写一个上游地址'; return; }
  const btn = document.querySelector('#step1 button.primary');
  if (btn) btn.disabled = true;
  err.textContent = '提交中…';
  const res = await fetch('/_admin/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: s0token, upstreams })
  });
  const data = await res.json();
  // 无 KV 时同一 Worker 实例内存已标记完成，幂等视为成功
  if (!res.ok && res.status !== 409) { if (btn) btn.disabled = false; err.textContent = data.error || '初始化失败'; return; }
  TOKEN = s0token;
  sessionStorage.setItem('ngx_token', TOKEN);
  document.getElementById('workerUrl').textContent = location.origin + '/_admin';
  // 无 KV 时显示内存模式提醒
  if (data.memoryMode) document.getElementById('memoryModeWarn').classList.remove('hidden');
  gotoStep(2);
}
function enterPanel() { show('appView'); loadStatus(); }

// ── Login ──
async function doLogin() {
  const t = document.getElementById('tokenInput').value.trim();
  const err = document.getElementById('loginErr');
  if (!t) { err.textContent = '请输入密码'; return; }
  err.textContent = '验证中…';
  const res = await fetch('/_admin/status', { headers: { 'X-Admin-Token': t } });
  if (res.status === 401) { err.textContent = '密码错误'; return; }
  if (!res.ok) { err.textContent = '服务器错误，请稍后重试'; return; }
  TOKEN = t;
  sessionStorage.setItem('ngx_token', TOKEN);
  err.textContent = '';
  show('appView');
  await applyStatus(await res.json());
}
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('loginView').classList.contains('hidden')) doLogin();
});
function doLogout() { TOKEN = ''; sessionStorage.removeItem('ngx_token'); show('loginView'); }

// ── App ──
async function doRefresh(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '刷新中…'; }
  await loadStatus();
  if (btn) { btn.disabled = false; btn.textContent = '↻ 刷新'; }
}
async function loadStatus() {
  const res = await authFetch('/_admin/status');
  if (!res) return;
  const data = await res.json();
  await applyStatus(data);
}
async function applyStatus(data) {
  allUpstreams = data.upstreams || [];
  allHealth = data.health || [];
  const kvTag = document.getElementById('kvTag');
  if (Boolean(data.hasKV)) { kvTag.textContent = 'KV ✓'; kvTag.className = 'tag ok'; }
  else { kvTag.textContent = '⚠️ 内存模式（重启丢失）'; kvTag.className = 'tag warn'; }
  document.getElementById('timeTag').textContent = new Date(data.now || Date.now()).toLocaleTimeString('zh-CN');
  document.getElementById('nowLabel').textContent = '当前时间 ' + new Date().toLocaleString('zh-CN');
  renderSidebar();
  renderTable();
}

async function triggerHealth() {
  const btn = document.getElementById('healthBtn');
  btn.disabled = true;
  btn.textContent = '检查中…';
  const res = await authFetch('/_admin/trigger-health', { method: 'POST' });
  btn.disabled = false;
  btn.textContent = '⚡ 立即健康检查';
  if (!res) return;
  const data = await res.json();
  allHealth = data.health || [];
  renderSidebar();
  renderTable();
}

function getHealthRecord(url) {
  return allHealth.find(h => h.url === url) || null;
}

function getEntry(i) {
  const e = allUpstreams[i];
  return typeof e === 'object' ? e : { url: e, note: '' };
}

function escapeHTML(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isValidUpstreamUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderSidebar() {
  const list = document.getElementById('sidebarList');
  document.getElementById('sidebarCount').textContent = allUpstreams.length;
  list.innerHTML = allUpstreams.map((entry, i) => {
    const { url, note } = typeof entry === 'object' ? entry : { url: entry, note: '' };
    const h = getHealthRecord(url);
    const healthy = h?.healthy;
    const latency = h ? (h.latency >= 0 ? h.latency + 'ms' : '超时') : '未知';
    const label = note || url;
    return \`<div class="sidebar-item" onclick="highlightRow(\${i})">
      <div class="sidebar-item-row"><span class="dot \${healthy ? 'healthy' : ''}"></span><span class="truncate" title="\${escapeHTML(url)}">\${escapeHTML(label)}</span></div>
      <div class="sidebar-meta">\${healthy === undefined ? '暂无数据' : (healthy ? '健康' : '不健康')} · \${escapeHTML(latency)}</div>
    </div>\`;
  }).join('');
}

function renderTable() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase();
  const filtered = allUpstreams.map((entry, i) => {
    const { url, note } = typeof entry === 'object' ? entry : { url: entry, note: '' };
    return { url, note, i };
  }).filter(({ url, note }) => url.toLowerCase().includes(q) || note.toLowerCase().includes(q));
  const total = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.min(page, total);
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const tbody = document.getElementById('tableBody');
  const empty = document.getElementById('emptyState');
  if (slice.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); }
  else {
    empty.classList.add('hidden');
    tbody.innerHTML = slice.map(({ url, note, i }) => {
      const h = getHealthRecord(url);
      const healthy = h?.healthy;
      const latency = h ? (h.latency >= 0 ? h.latency + 'ms' : '超时') : '—';
      const lastCheck = h?.lastCheck ? new Date(h.lastCheck).toLocaleString('zh-CN') : '—';
      const badge = healthy === undefined ? '' : \`<span class="badge \${healthy ? 'healthy' : 'unhealthy'}">\${healthy ? '✓ 健康' : '✗ 不健康'}</span>\`;
      return \`<tr id="row-\${i}">
        <td class="truncate" style="max-width:200px" title="\${escapeHTML(url)}">\${escapeHTML(url)}</td>
        <td class="muted truncate" style="max-width:100px" title="\${escapeHTML(note)}">\${escapeHTML(note || '—')}</td>
        <td>\${badge || '<span class="muted">—</span>'}</td>
        <td>\${escapeHTML(latency)}</td>
        <td>\${escapeHTML(lastCheck)}</td>
        <td class="text-right" style="white-space:nowrap"><button onclick="openEditModal(\${i})">编辑</button> <button class="danger" onclick="removeUpstream(\${i})">删除</button></td>
      </tr>\`;
    }).join('');
  }
  document.getElementById('pageInfo').textContent = \`第 \${page} / \${total} 页，共 \${filtered.length} 条\`;
  document.getElementById('prevBtn').disabled = page <= 1;
  document.getElementById('nextBtn').disabled = page >= total;
}

function highlightRow(i) {
  document.querySelectorAll('tr[id^="row-"]').forEach(r => r.classList.remove('highlight'));
  const el = document.getElementById('row-' + i);
  if (el) { el.classList.add('highlight'); el.scrollIntoView({ block: 'nearest' }); }
}
function changePage(d) { page += d; renderTable(); }

// ── Modal ──
function openAddModal() {
  editingIndex = -1;
  document.getElementById('modalTitle').textContent = '添加上游';
  document.getElementById('modalUrl').value = '';
  document.getElementById('modalNote').value = '';
  document.getElementById('modalErr').textContent = '';
  document.getElementById('modal').classList.remove('hidden');
}
function openEditModal(i) {
  editingIndex = i;
  const { url, note } = getEntry(i);
  document.getElementById('modalTitle').textContent = '编辑上游';
  document.getElementById('modalUrl').value = url;
  document.getElementById('modalNote').value = note || '';
  document.getElementById('modalErr').textContent = '';
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

async function submitModal() {
  const url = document.getElementById('modalUrl').value.trim();
  const note = document.getElementById('modalNote').value.trim();
  const err = document.getElementById('modalErr');
  if (!isValidUpstreamUrl(url)) { err.textContent = '请输入有效的 URL（以 http:// 或 https:// 开头）'; return; }
  let list = allUpstreams.map(e => typeof e === 'object' ? e : { url: e, note: '' });
  if (editingIndex >= 0) list[editingIndex] = { url, note };
  else list.push({ url, note });
  err.textContent = '保存中…';
  const res = await authFetch('/_admin/upstreams', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ upstreams: list }) });
  if (!res) { err.textContent = '请求失败'; return; }
  const data = await res.json();
  if (!res.ok) { err.textContent = data.error || '保存失败'; return; }
  allUpstreams = data.upstreams || list;
  closeModal();
  renderSidebar();
  renderTable();
}

async function removeUpstream(i) {
  const { url, note } = getEntry(i);
  if (!confirm(\`确定删除该上游？\n\${note ? note + '  ' : ''}\${url}\`)) return;
  const list = allUpstreams.filter((_, idx) => idx !== i);
  const res = await authFetch('/_admin/upstreams', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ upstreams: list }) });
  if (!res) return;
  const data = await res.json();
  if (!res.ok) { alert(data.error || '删除失败'); return; }
  allUpstreams = data.upstreams || list;
  renderSidebar();
  renderTable();
}

// ── Helpers ──
async function authFetch(url, opts = {}) {
  opts.headers = Object.assign({}, opts.headers, { 'X-Admin-Token': TOKEN });
  const res = await fetch(url, opts).catch(() => null);
  if (!res) return null;
  if (res.status === 401) { alert('登录已失效，请重新登录'); doLogout(); return null; }
  return res;
}
</script>
</body>
</html>`;
}
