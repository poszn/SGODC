/* ═══════════════════════════════════════════════
   SGODC – app.js v2.0
   Lógica principal da aplicação (versão completa)
═══════════════════════════════════════════════ */

// ── GLOBAL STATE ──
let currentUser    = null;
let currentCompany = null;
let reportPeriod   = 'month';
let aprovFilter    = 'pending';
let pendingDecision = null; // { expId, action }
let dashChart      = null;
let repChartCat    = null;
let repChartStatus = null;
let repChartMonthly = null;

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().slice(0, 10);
  ['proc-data', 'campo-data-inicio', 'plan-inicio', 'plan-fim'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  const actOutro = document.getElementById('act-outro');
  if (actOutro) {
    actOutro.addEventListener('change', function () {
      document.getElementById('outro-label-wrap')?.classList.toggle('hidden', !this.checked);
    });
  }

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Check existing session
  const sess = DB.getSession();
  if (sess) {
    const u = DB.getUser(sess.userId);
    if (u) { loginAs(u); return; }
  }
  showScreen('screen-auth');
  showView('view-login');
});

// ── SCREENS / VIEWS ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}
function showView(id) {
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}
function showPage(id) {
  closeAllModals();   // fechar todos os modais antes de navegar
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item, .bnav-btn').forEach(n => n.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll(`[data-page="${id}"]`).forEach(n => n.classList.add('active'));
  if (window.innerWidth < 768) closeSidebar();
  document.getElementById('user-menu')?.classList.add('hidden');

  switch (id) {
    case 'page-dashboard':     renderDashboard();          break;
    case 'page-despesas':      renderExpenseList();        break;
    case 'page-aprovacoes':    renderAprovacoes();         break;
    case 'page-relatorios':    renderRelatorios();         break;
    case 'page-planeamento':   renderPlaneamento();        break;
    case 'page-utilizadores':  renderUtilizadores();       break;
    case 'page-perfil':        renderPerfil();             break;
    case 'page-fraude':        renderFraudePage();         break;
    case 'page-notificacoes':  renderNotificacoes();       break;
    case 'page-config':        renderConfig();             break;
    case 'page-tendencias':    renderTendencias();         break;
    case 'page-divididas':     renderDespesasDivididas();  break;
    case 'page-fornecedores':  renderFornecedores();       break;
  }
}

// ── SIDEBAR NAV GROUPS (colapsáveis) ──
function toggleNavGroup(id) {
  const group = document.getElementById(id);
  const caretId = 'caret-' + id.replace('nav-', '');
  const caret = document.getElementById(caretId);
  if (!group) return;
  const isOpen = !group.classList.contains('nav-group-closed');
  group.classList.toggle('nav-group-closed', isOpen);
  if (caret) caret.textContent = isOpen ? '▶' : '▼';
}

// ── NOVA DESPESA PICKER ──
function openNovaDespesaModal() {
  openModal('modal-nova-despesa');
}
function escolherFormulario(tipo) {
  closeModal('modal-nova-despesa');
  showCampoForm(tipo);
}

// ── CAMPO FORM SELECTOR ──
function showCampoForm(tipo) {
  showPage('page-campo');
  setTimeout(() => selectCampoOpcao(tipo), 100);
}

// ── SIDEBAR ──
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb?.classList.toggle('open');
  ov?.classList.toggle('hidden', !sb?.classList.contains('open'));
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.add('hidden');
}

// ── TOAST ──
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ── MODAL ──
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }
function openModal(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function closeAllModals() {
  // Fecha todos os modais: sistema novo (.modal) e antigo (.modal-overlay)
  document.querySelectorAll('.modal:not(.hidden), .modal-overlay:not(.hidden)').forEach(m => {
    m.classList.add('hidden');
  });
}

// ── AUTH ──
function togglePw(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  if (el.type === 'password') { el.type = 'text'; btn.textContent = '🙈'; }
  else { el.type = 'password'; btn.textContent = '👁'; }
}
function toggleUserMenu() {
  document.getElementById('user-menu')?.classList.toggle('hidden');
}

function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showToast('Preencha email e palavra-passe', 'error'); return; }
  const user = DB.findUserByEmail(email);
  if (!user || user.password !== pass) { showToast('Email ou palavra-passe incorretos', 'error'); return; }
  DB.setSession({ userId: user.id });
  loginAs(user);
}

function loginAs(user) {
  currentUser    = user;
  currentCompany = DB.getCompany(user.companyId);

  document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('sidebar-company').textContent = currentCompany?.name || 'SGDC';

  // Topbar user info (desktop)
  const tnEl = document.getElementById('topbar-user-name');
  const trEl = document.getElementById('topbar-user-role');
  if (tnEl) tnEl.textContent = user.name;
  if (trEl) trEl.textContent = roleLabel(user.role);

  document.getElementById('user-menu-info').innerHTML =
    `<strong>${user.name}</strong><br/>${user.email}<br/><span class="role-badge ${user.role}">${roleLabel(user.role)}</span>`;

  // Show/hide role-gated elements
  const isFunc   = user.role === 'funcionario';
  const isSuper  = ['supervisor','coordenador','gestor','director','financeiro','admin'].includes(user.role);
  const isCoord  = ['coordenador','gestor','director','financeiro','admin'].includes(user.role);
  const isDir    = ['director','financeiro','admin'].includes(user.role);
  const isAdmin  = user.role === 'admin';

  document.querySelectorAll('.manager-only').forEach(el =>
    el.classList.toggle('hidden', isFunc));
  document.querySelectorAll('.supervisor-only').forEach(el =>
    el.classList.toggle('hidden', !isSuper));
  document.querySelectorAll('.coord-only').forEach(el =>
    el.classList.toggle('hidden', !isCoord));
  document.querySelectorAll('.director-only').forEach(el =>
    el.classList.toggle('hidden', !isDir));
  document.querySelectorAll('.admin-only').forEach(el =>
    el.classList.toggle('hidden', !isAdmin));

  showScreen('screen-app');
  showPage('page-dashboard');
  updateBadges();
  _loadCompanyLogo();

  // Check scheduled reports (non-blocking)
  setTimeout(() => checkScheduledReports(currentCompany?.id), 1500);
}

// ── LOGÓTIPO DA EMPRESA ──
function _loadCompanyLogo() {
  if (!currentCompany) return;
  const key  = `company_logo_${currentCompany.id}`;
  const logo = localStorage.getItem(key);
  const img  = document.getElementById('sidebar-logo-img');
  const ltr  = document.getElementById('sidebar-brand-letter');
  if (logo && img && ltr) {
    img.src = logo;
    img.classList.remove('hidden');
    ltr.classList.add('hidden');
  } else if (img && ltr) {
    img.classList.add('hidden');
    ltr.classList.remove('hidden');
    ltr.textContent = (currentCompany.name || 'S').charAt(0).toUpperCase();
  }
  // Só admin pode clicar para mudar o logo
  const wrap = document.getElementById('sidebar-logo-wrap');
  if (wrap) wrap.style.cursor = currentUser?.role === 'admin' ? 'pointer' : 'default';
}

function triggerLogoUpload() {
  if (currentUser?.role !== 'admin') return;
  document.getElementById('logo-file-input')?.click();
}

function onLogoFileChange(input) {
  const file = input.files?.[0];
  if (!file || !currentCompany) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('Imagem muito grande. Máximo 2 MB.', 'error'); return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target.result;
    localStorage.setItem(`company_logo_${currentCompany.id}`, data);
    _loadCompanyLogo();
    showToast('Logótipo actualizado! 🖼️', 'success');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function doLogout() {
  DB.clearSession();
  currentUser = null; currentCompany = null;
  showScreen('screen-auth');
  showView('view-login');
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value  = '';
}

// ── REGISTER ──
function regNextStep() {
  const company = document.getElementById('reg-company').value.trim();
  if (!company) { showToast('Insira o nome da empresa', 'error'); return; }
  document.getElementById('reg-step-1')?.classList.add('hidden');
  document.getElementById('reg-step-2')?.classList.remove('hidden');
  document.getElementById('step-dot-1')?.classList.add('done');
  document.getElementById('step-dot-2')?.classList.add('active');
}
function regPrevStep() {
  document.getElementById('reg-step-2')?.classList.add('hidden');
  document.getElementById('reg-step-1')?.classList.remove('hidden');
  document.getElementById('step-dot-2')?.classList.remove('active');
  document.getElementById('step-dot-1')?.classList.remove('done');
  document.getElementById('step-dot-1')?.classList.add('active');
}
function doRegister() {
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  if (!name || !email || !pass) { showToast('Preencha todos os campos', 'error'); return; }
  if (pass.length < 6)          { showToast('Palavra-passe: mínimo 6 caracteres', 'error'); return; }
  if (DB.findUserByEmail(email)) { showToast('Email já registado', 'error'); return; }

  const types = [];
  if (document.getElementById('act-proc')?.checked)  types.push('procurement');
  if (document.getElementById('act-campo')?.checked) types.push('campo');
  if (document.getElementById('act-outro')?.checked) {
    const lbl = document.getElementById('act-outro-name')?.value.trim();
    types.push(lbl || 'outro');
  }

  const company = DB.saveCompany({
    id: DB.uid(),
    name: document.getElementById('reg-company').value.trim(),
    currency: document.getElementById('reg-currency').value,
    activityTypes: types,
    approvalChain: [
      { level: 1, label: 'Supervisor',    roleRequired: 'supervisor' },
      { level: 2, label: 'Coordenador',   roleRequired: 'coordenador' },
      { level: 3, label: 'Director',      roleRequired: 'director' },
      { level: 4, label: 'Financeiro',    roleRequired: 'financeiro' },
    ],
    createdAt: new Date().toISOString(),
  });

  const user = DB.saveUser({
    id: DB.uid(), companyId: company.id,
    name, email, password: pass, role: 'admin',
  });

  DB.setSession({ userId: user.id });
  showToast('Empresa registada! 🎉', 'success');
  loginAs(user);
}

// ── UTILS ──
function roleLabel(role) {
  return {
    admin:        'Administrador',
    gestor:       'Gestor',
    director:     'Director',
    financeiro:   'Financeiro',
    coordenador:  'Coordenador',
    supervisor:   'Supervisor',
    funcionario:  'Funcionário',
  }[role] || role;
}
function fmtCurrency(val, currency = 'MZN') {
  return new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0) + ' ' + currency;
}
function fmtDate(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}
function typeLabel(t) {
  return {
    alojamento: 'Alojamento', alimentacao: 'Alimentação', transporte: 'Transporte',
    perdiem: 'Per Diem', comunicacao: 'Comunicação', outro: 'Outro',
    compra: 'Compra', contrato: 'Contrato', 'compra-direta': 'Compra Direta',
  }[t] || t || '—';
}
function expenseIcon(exp) {
  if (exp.type === 'procurement') return '🛒';
  const icons = { alojamento: '🏨', alimentacao: '🍽️', transporte: '🚗', perdiem: '💳', comunicacao: '📱' };
  return icons[exp.expenseType] || '🌍';
}
function statusLabel(s) {
  return { pending: '⏳ Pendente', approved: '✅ Aprovado', rejected: '❌ Rejeitado', draft: '📝 Rascunho' }[s] || s;
}
function expenseName(exp) {
  return exp.name || (exp.type === 'procurement' ? 'Procurement' : 'Despesa de Campo');
}
function payMethodLabel(pm) {
  return { cash: '💵 Numerário', mpesa: '📱 M-Pesa', emola: '📱 eMola', mpesk: '📱 mPesk', bank: '🏦 Transferência Bancária' }[pm] || pm || '—';
}
function getMyExpenses() {
  if (!currentUser || !currentCompany) return [];
  if (currentUser.role === 'funcionario') return DB.getExpensesByUser(currentUser.id);
  return DB.getExpensesByCompany(currentCompany.id);
}
function filterByPeriod(expenses, period) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow   = (now.getDay() + 6) % 7;
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - dow);
  const months3 = new Date(today); months3.setMonth(today.getMonth() - 3);
  const months6 = new Date(today); months6.setMonth(today.getMonth() - 6);
  return expenses.filter(e => {
    const dateStr = e.data || (e.submittedAt ? e.submittedAt.slice(0,10) : null);
    if (!dateStr) return period === 'all';
    const d = new Date(dateStr + 'T00:00:00');
    if (period === 'day')     return d >= today;
    if (period === 'week')    return d >= weekStart;
    if (period === 'month')   return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (period === '3months') return d >= months3;
    if (period === '6months') return d >= months6;
    if (period === 'quarter') { const q = Math.floor(now.getMonth()/3); return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth()/3) === q; }
    if (period === 'year')    return d.getFullYear() === now.getFullYear();
    return true;
  });
}
function periodLabel(period) {
  return {
    day: 'Hoje', week: 'Esta Semana', month: 'Este Mês',
    '3months': 'Últimos 3 Meses', '6months': 'Últimos 6 Meses',
    year: 'Este Ano', quarter: 'Trimestre', all: 'Todo o Período'
  }[period] || period;
}

// ── BADGES & NOTIFICATIONS ──
function updateBadges() {
  if (!currentUser || !currentCompany) return;
  const unread = DB.getUnreadCount(currentUser.id);
  const pending = DB.getExpensesByCompany(currentCompany.id).filter(e => e.status === 'pending').length;
  const total = unread + pending;

  ['notif-count', 'nav-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (total > 0) { el.textContent = total; el.classList.remove('hidden'); }
    else            { el.classList.add('hidden'); }
  });
}

function pushNotification(userId, title, body, type = 'info') {
  DB.addNotification({ userId, title, body, type });
  updateBadges();
  // Web Notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(`SGODC – ${title}`, { body, icon: 'icons/icon-192.png' }); } catch {}
  }
}

// ── DASHBOARD PERIOD ──
let dashPeriod = 'month';
let dashTrendChart = null;

function setDashPeriod(p, btn) {
  dashPeriod = p;
  document.querySelectorAll('#page-dashboard .period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDashboard();
}

function showPageFiltered(status) {
  showPage('page-despesas');
  setTimeout(() => {
    const el = document.getElementById('filter-status');
    if (el) { el.value = status; renderExpenseList(); }
  }, 100);
}

// ── DASHBOARD ──
function renderDashboard() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('dash-greeting').textContent = `${greet}, ${currentUser.name.split(' ')[0]} 👋`;
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const currency = currentCompany?.currency || 'MZN';
  const now      = new Date();
  const isFunc   = currentUser.role === 'funcionario';

  // ── PESSOAIS (filtradas pelo período activo) ──
  const myAllExp = DB.getExpensesByUser(currentUser.id);
  const myExp    = filterByPeriod(myAllExp, dashPeriod);
  const myTotal    = myExp.filter(e => e.status !== 'rejected' && e.status !== 'draft').reduce((s,e) => s+(e.valor||0), 0);
  const myApproved = myExp.filter(e => e.status === 'approved').length;
  const myPending  = myExp.filter(e => e.status === 'pending').length;
  const myRejected = myExp.filter(e => e.status === 'rejected').length;

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('stat-total',    fmtCurrency(myTotal, currency));
  setEl('stat-approved', myApproved);
  setEl('stat-pending',  myPending);
  setEl('stat-rejected', myRejected);
  const tlEl = document.getElementById('stat-total-label');
  if (tlEl) tlEl.textContent = `Total – ${periodLabel(dashPeriod)}`;
  const trendLbl = document.getElementById('dash-trend-label');
  if (trendLbl) trendLbl.textContent = periodLabel(dashPeriod);

  // ── EMPRESA (apenas gestores/admin) ──
  if (!isFunc) {
    const allPeriod = filterByPeriod(DB.getExpensesByCompany(currentCompany.id), dashPeriod);
    const empTotal    = allPeriod.filter(e => e.status !== 'rejected' && e.status !== 'draft').reduce((s,e) => s+(e.valor||0), 0);
    const empApproved = allPeriod.filter(e => e.status === 'approved').length;
    const empPending  = allPeriod.filter(e => e.status === 'pending').length;
    const allUsers    = DB.getExpensesByCompany(currentCompany.id);
    const empUsers    = new Set(allUsers.map(e => e.userId)).size;
    setEl('stat-emp-total',    fmtCurrency(empTotal, currency));
    setEl('stat-emp-approved', empApproved);
    setEl('stat-emp-pending',  empPending);
    setEl('stat-emp-users',    empUsers);
  }

  // ── ÚLTIMAS 5 despesas ──
  const recent = [...myAllExp]
    .sort((a,b) => (b.submittedAt||b.data||'').localeCompare(a.submittedAt||a.data||''))
    .slice(0, 5);
  const container = document.getElementById('dash-recent-list');
  if (container) {
    container.innerHTML = recent.length === 0
      ? '<p class="empty-state">Nenhuma despesa registada ainda.</p>'
      : recent.map(e => expenseItemHTML(e, false)).join('');
  }

  // ── GRÁFICO DONUT — Por Categoria ──
  const cats = {};
  myAllExp.filter(e => e.status === 'approved').forEach(e => {
    const k = e.type === 'procurement' ? 'Procurement'
            : e.type === 'campo-pedido' ? 'Pedido Campo'
            : typeLabel(e.expenseType);
    cats[k] = (cats[k] || 0) + (e.valor || 0);
  });
  if (dashChart) { try { dashChart.destroy(); } catch {} }
  const ctx = document.getElementById('dash-chart')?.getContext('2d');
  if (ctx) {
    if (Object.keys(cats).length > 0) {
      dashChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(cats),
          datasets: [{ data: Object.values(cats),
            backgroundColor: ['#1E3A5F','#10B981','#F59E0B','#3B82F6','#EF4444','#06B6D4','#8B5CF6'],
            borderWidth: 2, borderColor: '#fff' }]
        },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
      });
    } else {
      dashChart = null;
    }
  }

  // ── GRÁFICO DE BARRAS — Tendência no período ──
  _renderDashTrendChart(myAllExp, currency);
}

function _renderDashTrendChart(allExp, currency) {
  if (dashTrendChart) { try { dashTrendChart.destroy(); } catch {} dashTrendChart = null; }
  const ctx = document.getElementById('dash-trend-chart')?.getContext('2d');
  if (!ctx) return;

  const now = new Date();
  let labels = [], data = [];

  if (dashPeriod === 'day') {
    // Por hora (0-23)
    labels = Array.from({length:24}, (_,i) => `${String(i).padStart(2,'0')}h`);
    data   = Array(24).fill(0);
    allExp.forEach(e => {
      const d = new Date(e.submittedAt || (e.data+'T12:00:00'));
      const today = new Date(); today.setHours(0,0,0,0);
      if (d >= today) data[d.getHours()] += (e.valor||0);
    });
  } else if (dashPeriod === 'week') {
    const days = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
    labels = days;
    data   = Array(7).fill(0);
    const dow = (now.getDay()+6)%7;
    const wStart = new Date(now); wStart.setDate(now.getDate()-dow); wStart.setHours(0,0,0,0);
    allExp.forEach(e => {
      const d = new Date(e.data ? e.data+'T00:00:00' : e.submittedAt);
      if (d >= wStart) { const idx = Math.floor((d-wStart)/(86400000)); if(idx>=0&&idx<7) data[idx]+=(e.valor||0); }
    });
  } else if (dashPeriod === 'month') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    labels = Array.from({length:daysInMonth}, (_,i) => String(i+1));
    data   = Array(daysInMonth).fill(0);
    allExp.forEach(e => {
      const d = new Date((e.data||'') + 'T00:00:00');
      if (d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()) data[d.getDate()-1]+=(e.valor||0);
    });
  } else if (dashPeriod === 'year') {
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    labels = months;
    data   = Array(12).fill(0);
    allExp.forEach(e => {
      const d = new Date((e.data||'')+'T00:00:00');
      if (d.getFullYear()===now.getFullYear()) data[d.getMonth()]+=(e.valor||0);
    });
  } else {
    return; // 'all' — skip trend
  }

  dashTrendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: `Despesas (${currency})`,
        data,
        backgroundColor: 'rgba(30,58,95,0.75)',
        borderColor: '#1E3A5F',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { font: { size: 11 } }, grid: { color: '#f0f0f0' } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      },
      onClick: (evt, items) => {
        if (!items.length) return;
        showPage('page-despesas');
      }
    }
  });
}

// ── EXPENSE ITEM HTML ──
function expenseItemHTML(exp, showUser = false) {
  const user = showUser ? DB.getUser(exp.userId) : null;
  const currency = currentCompany?.currency || 'MZN';
  const fraud = typeof FraudDetector !== 'undefined'
    ? FraudDetector.analyseExpense(exp, DB.getExpenses())
    : null;
  const fraudBadge = fraud && !fraud.passed
    ? `<span class="fraud-mini-badge" style="background:#${fraud.riskLevel.color}20;color:#${fraud.riskLevel.color}">⚠</span>`
    : '';
  return `<div class="expense-item ${exp.status}" onclick="openExpenseDetail('${exp.id}')">
    <div class="expense-icon">${expenseIcon(exp)}</div>
    <div class="expense-info">
      <div class="expense-name">${expenseName(exp)} ${fraudBadge}</div>
      <div class="expense-meta">
        ${exp.data ? fmtDate(exp.data) : '—'}
        ${exp.projeto ? ' · ' + exp.projeto : ''}
        ${showUser && user ? ' · ' + user.name : ''}
        ${exp.paymentMethod ? ' · ' + payMethodLabel(exp.paymentMethod) : ''}
      </div>
    </div>
    <div class="expense-right">
      <div class="expense-amount">${fmtCurrency(exp.valor||0, exp.moeda||currency)}</div>
      <div class="expense-status"><span class="status-badge ${exp.status}">${statusLabel(exp.status)}</span></div>
    </div>
  </div>`;
}

// ── EXPENSE LIST ──
function renderExpenseList() {
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const typeFilter   = document.getElementById('filter-type')?.value   || '';
  const search       = (document.getElementById('filter-search')?.value || '').toLowerCase();

  // "As minhas despesas" — sempre filtrado pelo utilizador actual, independente do role
  let list = DB.getExpensesByUser(currentUser.id);
  if (statusFilter) list = list.filter(e => e.status === statusFilter);
  if (typeFilter)   list = list.filter(e => e.type === typeFilter || e.type === typeFilter + '-pedido');
  if (search)       list = list.filter(e =>
    expenseName(e).toLowerCase().includes(search) ||
    (e.local||'').toLowerCase().includes(search) ||
    (e.projeto||'').toLowerCase().includes(search)
  );
  list.sort((a,b) => (b.submittedAt||b.data||'').localeCompare(a.submittedAt||a.data||''));

  const container = document.getElementById('expense-list-container');
  container.innerHTML = list.length === 0
    ? '<p class="empty-state">Nenhuma despesa encontrada.</p>'
    : `<div class="expense-list">${list.map(e => expenseItemHTML(e)).join('')}</div>`;
}

// ── EXPENSE DETAIL MODAL ──
function openExpenseDetail(id) {
  const exp = DB.getExpense(id);
  if (!exp) return;
  // Privacidade: funcionário só pode ver as suas próprias despesas
  if (currentUser.role === 'funcionario' && exp.userId !== currentUser.id) {
    showToast('Sem permissão para ver esta despesa', 'error');
    return;
  }
  const user = DB.getUser(exp.userId);
  const currency = exp.moeda || currentCompany?.currency || 'MZN';

  document.getElementById('modal-exp-title').textContent = expenseName(exp);

  let html = `<div class="detail-grid">
    <div class="detail-item"><div class="detail-label">Tipo</div><div class="detail-value">${exp.type === 'procurement' ? '🛒 Procurement' : '🌍 Campo'}</div></div>
    <div class="detail-item"><div class="detail-label">Estado</div><div class="detail-value"><span class="status-badge ${exp.status}">${statusLabel(exp.status)}</span></div></div>
    <div class="detail-item"><div class="detail-label">Valor</div><div class="detail-value">${fmtCurrency(exp.valor||0, currency)}</div></div>
    <div class="detail-item"><div class="detail-label">Data</div><div class="detail-value">${fmtDate(exp.data)}</div></div>
    <div class="detail-item"><div class="detail-label">Local</div><div class="detail-value">${exp.local||'—'}</div></div>
    <div class="detail-item"><div class="detail-label">Projeto</div><div class="detail-value">${exp.projeto||'—'}</div></div>
    <div class="detail-item"><div class="detail-label">Pagamento</div><div class="detail-value">${payMethodLabel(exp.paymentMethod)}</div></div>`;

  if (exp.phoneNumber) {
    html += `<div class="detail-item"><div class="detail-label">Nº Telefone</div><div class="detail-value">${exp.phoneNumber}</div></div>`;
  }
  if (exp.type === 'campo') {
    html += `<div class="detail-item"><div class="detail-label">Nº Pessoas</div><div class="detail-value">${exp.pessoas||1}</div></div>
    <div class="detail-item"><div class="detail-label">Valor/Pessoa</div><div class="detail-value">${fmtCurrency(exp.valorPessoa||0, currency)}</div></div>
    <div class="detail-item"><div class="detail-label">Tipo Despesa</div><div class="detail-value">${typeLabel(exp.expenseType)}</div></div>
    <div class="detail-item"><div class="detail-label">Tipo Trabalho</div><div class="detail-value">${exp.trabalho||'—'}</div></div>`;
    if (exp.km) html += `<div class="detail-item"><div class="detail-label">Distância GPS</div><div class="detail-value">${parseFloat(exp.km).toFixed(2)} km</div></div>`;
  }
  html += `<div class="detail-item"><div class="detail-label">Submetido por</div><div class="detail-value">${user?.name||'—'}</div></div>
    <div class="detail-item"><div class="detail-label">Submetido em</div><div class="detail-value">${exp.submittedAt ? fmtDate(exp.submittedAt) : '(rascunho)'}</div></div>`;

  if (exp.comentario) {
    html += `<div class="detail-item detail-full"><div class="detail-label">Comentário</div><div class="detail-value">${exp.comentario}</div></div>`;
  }

  // Multi-level approval timeline
  if (exp.approvals && exp.approvals.length > 0) {
    html += `<div class="detail-item detail-full"><div class="detail-label">Cadeia de Aprovação</div><div class="approval-timeline">`;
    exp.approvals.forEach(a => {
      const apUser = a.userId ? DB.getUser(a.userId) : null;
      const cls = { approved:'appr-approved', rejected:'appr-rejected', pending:'appr-pending', waiting:'appr-waiting' }[a.status] || '';
      const icon = { approved:'✅', rejected:'❌', pending:'⏳', waiting:'🔒' }[a.status] || '●';
      html += `<div class="appr-step ${cls}">
        <div class="appr-step-icon">${icon}</div>
        <div class="appr-step-info">
          <div class="appr-step-label">${a.label} (Nível ${a.level})</div>
          ${apUser ? `<div class="appr-step-user">${apUser.name}</div>` : ''}
          ${a.comment ? `<div class="appr-step-comment">"${a.comment}"</div>` : ''}
          ${a.date ? `<div class="appr-step-date">${fmtDate(a.date)}</div>` : ''}
        </div>
      </div>`;
    });
    html += `</div></div>`;
  }

  if (exp.receiptData) {
    html += `<div class="detail-item detail-full"><div class="detail-label">📸 Recibo</div><img class="receipt-img" src="${exp.receiptData}" alt="Recibo"/></div>`;
  }
  html += '</div>';

  // Fraud analysis
  if (typeof FraudDetector !== 'undefined' && exp.status !== 'draft') {
    const analysis = FraudDetector.analyseExpense(exp, DB.getExpenses());
    if (!analysis.passed) {
      html += `<div style="margin-top:12px">
        <button class="btn btn-outline btn-sm" onclick="showFraudAlerts('${exp.id}')">
          ⚠️ Ver Alertas de Fraude (${analysis.alerts.length})
        </button>
      </div>`;
    }
  }

  document.getElementById('modal-exp-body').innerHTML = html;

  // Actions
  const canApprove = canCurrentUserApproveExpense(exp);
  let actions = '';
  if (exp.status === 'pending' && canApprove) {
    actions = `<button class="btn btn-success" onclick="openDecision('${id}','approve')">✅ Aprovar</button>
               <button class="btn btn-danger"  onclick="openDecision('${id}','reject')">❌ Rejeitar</button>`;
  } else if (exp.status === 'draft' && exp.userId === currentUser.id) {
    actions = `<button class="btn btn-primary" onclick="sendDraftExpense('${id}')">📤 Enviar</button>
               <button class="btn btn-danger"  onclick="deleteExpense('${id}')">🗑️ Eliminar</button>`;
  } else {
    actions = `<button class="btn btn-outline btn-full" onclick="closeModal('modal-expense')">Fechar</button>`;
  }
  document.getElementById('modal-exp-actions').innerHTML = actions;

  openModal('modal-expense');
}

// ── MULTI-LEVEL APPROVAL ──
function canCurrentUserApproveExpense(exp) {
  if (!currentUser || !currentCompany) return false;
  if (currentUser.role === 'funcionario') return false;
  if (exp.status !== 'pending') return false;

  // Find the current pending level
  const pendingApproval = exp.approvals?.find(a => a.status === 'pending');
  if (!pendingApproval) {
    // Legacy expenses (no approvals array) — any manager can approve
    return true;
  }
  return canCurrentUserApproveLevel(exp, pendingApproval.level);
}

function canCurrentUserApproveLevel(exp, level) {
  if (!currentCompany) return false;
  const chain = currentCompany.approvalChain || [];
  const levelConfig = chain.find(c => c.level === level);
  if (!levelConfig) return currentUser.role !== 'funcionario';
  if (levelConfig.roleRequired) return currentUser.role === levelConfig.roleRequired || currentUser.role === 'admin';
  if (levelConfig.userIds) return levelConfig.userIds.includes(currentUser.id);
  return currentUser.role !== 'funcionario';
}

function openDecision(expId, action) {
  closeModal('modal-expense');
  pendingDecision = { expId, action };
  document.getElementById('decision-title').textContent = action === 'approve' ? '✅ Aprovar Despesa' : '❌ Rejeitar Despesa';
  document.getElementById('decision-comment').value = '';
  const btn = document.getElementById('decision-confirm-btn');
  btn.textContent = action === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição';
  btn.className   = 'btn ' + (action === 'approve' ? 'btn-success' : 'btn-danger');
  btn.onclick     = confirmDecision;
  openModal('modal-decision');
}

function confirmDecision() {
  const comment = document.getElementById('decision-comment').value.trim();
  if (!comment) { showToast('O comentário é obrigatório', 'error'); return; }
  if (!pendingDecision) return;

  const exp = DB.getExpense(pendingDecision.expId);
  if (!exp) return;

  const today = new Date().toISOString().slice(0, 10);

  // Legacy (no approvals array)
  if (!exp.approvals || exp.approvals.length === 0) {
    exp.status = pendingDecision.action === 'approve' ? 'approved' : 'rejected';
    exp.decidedBy = currentUser.id;
    exp.decisionComment = comment;
    exp.decisionAt = today;
    DB.saveExpense(exp);
    notifyExpenseOwner(exp, exp.status);
    _finishDecision(exp.status);
    return;
  }

  if (pendingDecision.action === 'reject') {
    // Reject current level → overall rejected
    const pendingLevel = exp.approvals.find(a => a.status === 'pending');
    if (pendingLevel) {
      pendingLevel.status  = 'rejected';
      pendingLevel.userId  = currentUser.id;
      pendingLevel.comment = comment;
      pendingLevel.date    = today;
    }
    exp.status = 'rejected';
    DB.saveExpense(exp);
    notifyExpenseOwner(exp, 'rejected');
    _finishDecision('rejected');
    return;
  }

  // Approve current level
  const pendingLevel = exp.approvals.find(a => a.status === 'pending');
  if (!pendingLevel) { showToast('Nada para aprovar', 'error'); return; }
  pendingLevel.status  = 'approved';
  pendingLevel.userId  = currentUser.id;
  pendingLevel.comment = comment;
  pendingLevel.date    = today;

  // Find next waiting level
  const nextLevel = exp.approvals.find(a => a.status === 'waiting');
  if (nextLevel) {
    nextLevel.status = 'pending';
    exp.status = 'pending';
    notifyNextApprover(exp, nextLevel.level);
  } else {
    // All levels done
    exp.status = 'approved';
    notifyExpenseOwner(exp, 'approved');
  }
  DB.saveExpense(exp);
  _finishDecision(exp.status);
}

function _finishDecision(status) {
  closeModal('modal-decision');
  pendingDecision = null;
  showToast(status === 'approved' ? 'Aprovado! ✅' : status === 'pending' ? 'Aprovado — aguarda próximo nível ⏳' : 'Rejeitado ❌',
    status === 'approved' ? 'success' : status === 'pending' ? 'info' : 'error');
  updateBadges();
  renderAprovacoes();
}

function notifyExpenseOwner(exp, finalStatus) {
  const msg = finalStatus === 'approved'
    ? `A sua despesa "${expenseName(exp)}" foi aprovada! ✅`
    : `A sua despesa "${expenseName(exp)}" foi rejeitada. ❌ Verifique os comentários.`;
  pushNotification(exp.userId, finalStatus === 'approved' ? 'Despesa Aprovada' : 'Despesa Rejeitada', msg, finalStatus === 'approved' ? 'success' : 'error');
}

function notifyNextApprover(exp, level) {
  const approvers = DB.getApproversForLevel(currentCompany.id, level);
  approvers.forEach(u => {
    pushNotification(u.id, 'Nova Despesa para Aprovar', `A despesa "${expenseName(exp)}" aguarda a sua aprovação (nível ${level}).`, 'pending');
  });
}

// ── DRAFT ACTIONS ──
function deleteExpense(id) {
  closeModal('modal-expense');
  DB.deleteExpense(id);
  showToast('Despesa eliminada', 'info');
  renderExpenseList();
  updateBadges();
}
function sendDraftExpense(id) {
  const exp = DB.getExpense(id);
  if (!exp) return;
  const chain = currentCompany?.approvalChain || [];
  exp.approvals = chain.map((c, i) => ({
    level: c.level, label: c.label,
    status: i === 0 ? 'pending' : 'waiting',
    userId: null, comment: '', date: null
  }));
  exp.status = 'pending';
  exp.submittedAt = new Date().toISOString().slice(0, 10);
  DB.saveExpense(exp);

  // Notify level-1 approvers
  if (chain.length > 0) notifyNextApprover(exp, chain[0].level);

  closeModal('modal-expense');
  showToast('Despesa enviada para aprovação! 📤', 'success');
  updateBadges();
  renderExpenseList();
}

// ── SUBMIT EXPENSE ──
function submitExpense(type) {
  if (type === 'procurement') submitProcurement('pending');
  else if (type === 'campo-pedido') submitPedidoCampo('pending');
  else submitCampo('pending');
}
// ── CAMPO: selector de opção ──
function selectCampoOpcao(opcao) {
  document.getElementById('campo-opt-pedido')?.classList.toggle('active', opcao === 'pedido');
  document.getElementById('campo-opt-relatorio')?.classList.toggle('active', opcao === 'relatorio');
  document.getElementById('form-campo-pedido')?.classList.toggle('hidden', opcao !== 'pedido');
  document.getElementById('form-campo-relatorio')?.classList.toggle('hidden', opcao !== 'relatorio');
}

// ── CAMPO: tipo de despesa – mostra campo "Outro" ──
function onPedidoTipoDespesaChange() {
  const val  = document.getElementById('pedido-tipo-despesa')?.value;
  const wrap = document.getElementById('pedido-tipo-outro-wrap');
  if (wrap) wrap.style.display = val === 'outro' ? '' : 'none';
}

// ── CAMPO: alternar entre Factura Única / Conjunta ──
function onTipoFacturaChange() {
  const isConjunta = document.getElementById('pedido-factura-conjunta')?.checked;
  document.getElementById('pedido-unica-wrap')?.classList.toggle('hidden', isConjunta);
  document.getElementById('pedido-conjunta-wrap')?.classList.toggle('hidden', !isConjunta);

  // Inicializar com pelo menos 2 linhas na conjunta
  if (isConjunta) {
    const linhas = document.getElementById('conjunta-linhas');
    if (linhas && linhas.children.length === 0) {
      addLinhaConjunta();
      addLinhaConjunta();
    }
    calcPedidoConjuntaTotal();
  } else {
    calcPedidoTotal();
  }
}

// ── CAMPO: cálculo do total – Factura Única ──
function calcPedidoTotal() {
  const pessoas   = parseInt(document.getElementById('pedido-pessoas')?.value) || 1;
  const orcamento = parseFloat(document.getElementById('pedido-orcamento')?.value) || 0;
  const moeda     = document.getElementById('pedido-moeda')?.value || 'MZN';
  const total     = pessoas * orcamento;
  const disp      = document.getElementById('pedido-total-display');
  const form      = document.getElementById('pedido-formula');
  if (disp) disp.textContent = fmtCurrency(total, moeda);
  if (form) form.textContent = `${pessoas} pessoa(s) × ${fmtCurrency(orcamento, moeda)} por pessoa/dia`;
}

function updatePedidoMoeda() {
  const m   = document.getElementById('pedido-moeda')?.value || 'MZN';
  const lbl = document.getElementById('pedido-moeda-label');
  if (lbl) lbl.textContent = m;
  calcPedidoTotal();
}

// ── CAMPO: Factura Conjunta – adicionar linha ──
let _linhaIdx = 0;
function addLinhaConjunta() {
  const container = document.getElementById('conjunta-linhas');
  if (!container) return;
  const idx = _linhaIdx++;
  const div = document.createElement('div');
  div.className = 'conjunta-linha';
  div.id = `conjunta-linha-${idx}`;
  div.innerHTML = `
    <select class="conjunta-tipo" onchange="calcPedidoConjuntaTotal()">
      <option value="">Tipo…</option>
      <option value="alojamento">🏨 Alojamento</option>
      <option value="alimentacao">🍽️ Alimentação</option>
      <option value="transporte">🚗 Transporte</option>
      <option value="perdiem">💰 Per Diem</option>
      <option value="comunicacao">📞 Comunicação</option>
      <option value="outro">⚙️ Outro</option>
    </select>
    <input type="text" class="conjunta-desc" placeholder="Descrição…" />
    <div class="input-prefix-wrap conjunta-valor-wrap">
      <span class="input-prefix conjunta-moeda-lbl">MZN</span>
      <input type="number" class="conjunta-valor" min="0" step="0.01" placeholder="0.00" oninput="calcPedidoConjuntaTotal()"/>
    </div>
    <button type="button" class="conjunta-rem" onclick="removeLinhaConjunta('conjunta-linha-${idx}')" title="Remover">✕</button>
  `;
  container.appendChild(div);
  _updateConjuntaMoedaLabels();
}

function removeLinhaConjunta(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  calcPedidoConjuntaTotal();
}

// ── CAMPO: Factura Conjunta – actualizar labels de moeda ──
function _updateConjuntaMoedaLabels() {
  const moeda = document.getElementById('pedido-moeda-conjunta')?.value || 'MZN';
  document.querySelectorAll('.conjunta-moeda-lbl').forEach(el => { el.textContent = moeda; });
}

// ── CAMPO: cálculo do total – Factura Conjunta ──
function calcPedidoConjuntaTotal() {
  _updateConjuntaMoedaLabels();
  const moeda   = document.getElementById('pedido-moeda-conjunta')?.value || 'MZN';
  const valores = document.querySelectorAll('.conjunta-valor');
  let   total   = 0;
  valores.forEach(el => { total += parseFloat(el.value) || 0; });
  const count   = valores.length;
  const disp    = document.getElementById('pedido-total-display');
  const form    = document.getElementById('pedido-formula');
  if (disp) disp.textContent = fmtCurrency(total, moeda);
  if (form) form.textContent = `${count} item(s) → Total: ${fmtCurrency(total, moeda)}`;
}

// ── CAMPO: obter modo de factura activo ──
function _getPedidoFacturaTipo() {
  return document.getElementById('pedido-factura-conjunta')?.checked ? 'conjunta' : 'unica';
}

// ── CAMPO: obter total e moeda conforme modo activo ──
function _getPedidoTotalInfo() {
  const tipo = _getPedidoFacturaTipo();
  if (tipo === 'conjunta') {
    const moeda = document.getElementById('pedido-moeda-conjunta')?.value || 'MZN';
    let total = 0;
    document.querySelectorAll('.conjunta-valor').forEach(el => { total += parseFloat(el.value) || 0; });
    const linhas = [];
    document.querySelectorAll('#conjunta-linhas .conjunta-linha').forEach(row => {
      linhas.push({
        tipo:  row.querySelector('.conjunta-tipo')?.value || '',
        desc:  row.querySelector('.conjunta-desc')?.value.trim() || '',
        valor: parseFloat(row.querySelector('.conjunta-valor')?.value) || 0,
      });
    });
    return { tipo, total, moeda, linhas };
  } else {
    const moeda     = document.getElementById('pedido-moeda')?.value || 'MZN';
    const pessoas   = parseInt(document.getElementById('pedido-pessoas')?.value) || 1;
    const orcamento = parseFloat(document.getElementById('pedido-orcamento')?.value) || 0;
    return { tipo, total: pessoas * orcamento, moeda, pessoas, orcamento };
  }
}

// ── SUBMETER PEDIDO DE CAMPO ──
function submitPedidoCampo(status) {
  const titulo    = document.getElementById('pedido-titulo')?.value.trim();
  const local     = document.getElementById('pedido-local')?.value.trim();
  const inicio    = document.getElementById('pedido-data-inicio')?.value;
  const fim       = document.getElementById('pedido-data-fim')?.value;
  const atividade = document.getElementById('pedido-atividade')?.value;
  const dept      = document.getElementById('pedido-dept')?.value;
  const justif    = document.getElementById('pedido-justificacao')?.value.trim();

  // Tipo de despesa (campo novo)
  const tipoDespesaSel  = document.getElementById('pedido-tipo-despesa')?.value;
  const tipoDespesaOutro = document.getElementById('pedido-tipo-outro')?.value.trim();
  const tipoDespesa     = tipoDespesaSel === 'outro' ? (tipoDespesaOutro || 'Outro') : tipoDespesaSel;

  // Factura info
  const facturaInfo = _getPedidoTotalInfo();
  const { tipo: facturaT, total, moeda } = facturaInfo;

  if (status === 'pending') {
    if (!titulo)      { showToast('Preencha o título da missão', 'error');      return; }
    if (!local)       { showToast('Indique o local de destino', 'error');       return; }
    if (!inicio)      { showToast('Indique a data de início', 'error');         return; }
    if (!fim)         { showToast('Indique a data de fim', 'error');            return; }
    if (!atividade)   { showToast('Seleccione o tipo de actividade', 'error');  return; }
    if (!dept)        { showToast('Seleccione o departamento', 'error');        return; }
    if (!tipoDespesaSel){ showToast('Seleccione o tipo de despesa', 'error');   return; }
    if (tipoDespesaSel === 'outro' && !tipoDespesaOutro) {
      showToast('Especifique o tipo de despesa', 'error'); return;
    }
    if (!justif)      { showToast('Escreva a justificação', 'error');           return; }
    if (facturaT === 'unica') {
      const orc = parseFloat(document.getElementById('pedido-orcamento')?.value);
      if (isNaN(orc) || orc <= 0) { showToast('Indique o orçamento estimado', 'error'); return; }
    } else {
      if (total <= 0) { showToast('Adicione pelo menos um item com valor', 'error'); return; }
    }
  }

  const payMethod  = document.getElementById('pedido-pay-method')?.value || 'cash';
  const phoneNum   = document.getElementById('pedido-phone')?.value.trim() || '';
  const adiant     = document.getElementById('pedido-adiantamento')?.value || 'nao';
  const comentario = document.getElementById('pedido-comentario')?.value.trim();
  const approvals  = _buildApprovalChain(status);
  const pessoas    = parseInt(document.getElementById('pedido-pessoas')?.value) || 1;

  // Fornecedor do pedido
  const fornPedido = _saveFornecedorPedidoInline?.() || null;

  const exp = {
    id: DB.uid(), companyId: currentCompany.id, userId: currentUser.id,
    type: 'campo-pedido', status,
    name: titulo || `Pedido de Missão – ${local || ''}`,
    expenseType: tipoDespesa || atividade,
    tipoDespesa,
    fornecedor: fornPedido ? { id: fornPedido.id, nome: fornPedido.nome, nuit: fornPedido.nuit, tipo: fornPedido.tipo, modalidade: fornPedido.modalidade } : null,
    facturaType: facturaT,
    facturaLinhas: facturaT === 'conjunta' ? facturaInfo.linhas : [],
    valor: total, moeda,
    data: inicio, local, dept,
    projeto: document.getElementById('pedido-projeto')?.value.trim(),
    pessoas,
    valorPessoa: facturaT === 'unica' ? (facturaInfo.orcamento || 0) : (total / pessoas),
    trabalho: atividade,
    dataInicio: inicio, dataFim: fim,
    justificacao: justif,
    adiantamento: adiant,
    comentario,
    paymentMethod: payMethod,
    phoneNumber: ['mpesa','emola','mpesk'].includes(payMethod) ? phoneNum : '',
    approvals,
    submittedAt: status === 'pending' ? new Date().toISOString() : null,
  };
  DB.saveExpense(exp);

  if (status === 'pending' && (currentCompany?.approvalChain||[]).length > 0) {
    notifyNextApprover(exp, currentCompany.approvalChain[0].level);
  }

  // Limpar formulário
  ['pedido-titulo','pedido-local','pedido-projeto','pedido-orcamento',
   'pedido-justificacao','pedido-comentario','pedido-tipo-outro'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('pedido-pessoas').value = 1;
  const tipoDespesaEl = document.getElementById('pedido-tipo-despesa');
  if (tipoDespesaEl) tipoDespesaEl.value = '';
  document.getElementById('pedido-tipo-outro-wrap').style.display = 'none';
  // Reset factura para única
  const radUnica = document.getElementById('pedido-factura-unica');
  if (radUnica) { radUnica.checked = true; onTipoFacturaChange(); }
  // Limpar linhas conjuntas
  const linhasEl = document.getElementById('conjunta-linhas');
  if (linhasEl) linhasEl.innerHTML = '';
  _linhaIdx = 0;
  calcPedidoTotal();

  showToast(status === 'pending' ? 'Pedido enviado! 📤' : 'Rascunho guardado 💾', 'success');
  if (status === 'pending') updateBadges();
  showPage('page-despesas');
}

function saveDraft(type) {
  if (type === 'procurement') submitProcurement('draft');
  else if (type === 'campo-pedido') submitPedidoCampo('draft');
  else submitCampo('draft');
}

function _buildApprovalChain(status) {
  if (status === 'draft') return [];
  const chain = currentCompany?.approvalChain || [];
  return chain.map((c, i) => ({
    level: c.level, label: c.label,
    status: i === 0 ? 'pending' : 'waiting',
    userId: null, comment: '', date: null
  }));
}

function submitProcurement(status) {
  const name   = document.getElementById('proc-name').value.trim();
  const tipo   = document.getElementById('proc-type').value;
  const valor  = parseFloat(document.getElementById('proc-valor').value);
  const moeda  = document.getElementById('proc-moeda').value;
  const data   = document.getElementById('proc-data').value;
  const local  = document.getElementById('proc-local').value.trim();

  if (status === 'pending' && (!name || !tipo || isNaN(valor) || !data || !local)) {
    showToast('Preencha os campos obrigatórios (*)', 'error'); return;
  }

  const payMethod = document.getElementById('proc-pay-method')?.value || 'cash';
  const phoneNum  = document.getElementById('proc-phone')?.value.trim() || '';
  const recInput  = document.getElementById('proc-recibo');
  const receiptData = recInput?._base64 || null;
  const approvals = _buildApprovalChain(status);

  const exp = {
    id: DB.uid(), companyId: currentCompany.id, userId: currentUser.id,
    type: 'procurement', status,
    name, expenseType: tipo,
    valor: isNaN(valor) ? 0 : valor, moeda, data,
    local,
    dept: document.getElementById('proc-dept').value,
    projeto: document.getElementById('proc-projeto').value.trim(),
    comentario: document.getElementById('proc-comentario').value.trim(),
    paymentMethod: payMethod,
    phoneNumber: ['mpesa','emola','mpesk'].includes(payMethod) ? phoneNum : '',
    receiptData,
    approvals,
    submittedAt: status === 'pending' ? data : null,
  };
  DB.saveExpense(exp);

  if (status === 'pending' && (currentCompany?.approvalChain||[]).length > 0) {
    notifyNextApprover(exp, currentCompany.approvalChain[0].level);
  }

  clearProcForm();
  showToast(status === 'pending' ? 'Despesa enviada! 📤' : 'Rascunho guardado 💾', 'success');
  if (status === 'pending') updateBadges();
  showPage('page-despesas');
}

function submitCampo(status) {
  const tipo      = document.getElementById('campo-tipo').value;
  const dept      = document.getElementById('campo-dept').value;
  const trabalho  = document.getElementById('campo-trabalho').value.trim();
  const pessoas   = parseInt(document.getElementById('campo-pessoas').value) || 1;
  const valPessoa = parseFloat(document.getElementById('campo-valor-pessoa').value);
  const moeda     = document.getElementById('campo-moeda').value;
  const local     = document.getElementById('campo-local').value.trim();
  const inicio    = document.getElementById('campo-data-inicio').value;

  if (status === 'pending' && (!tipo || !trabalho || isNaN(valPessoa) || !local || !inicio)) {
    showToast('Preencha os campos obrigatórios (*)', 'error'); return;
  }

  const subtotal  = pessoas * (isNaN(valPessoa) ? 0 : valPessoa);
  const ivaInfo   = _getIVAInfo?.() || { comIVA: false, taxa: 16, regime: 'normal' };
  const ivaValor  = ivaInfo.comIVA ? subtotal * (ivaInfo.taxa / 100) : 0;
  const total     = subtotal + ivaValor;
  const payMethod = document.getElementById('campo-pay-method')?.value || 'cash';
  const phoneNum  = document.getElementById('campo-phone')?.value.trim() || '';
  const recInput  = document.getElementById('campo-recibo');
  const receiptData = recInput?._base64 || null;
  const gpsEl     = document.getElementById('campo-gps');
  const gpsCoords = gpsEl?.value.trim() || null;
  const approvals = _buildApprovalChain(status);

  // Fornecedor
  const forn = _saveFornecedorInline?.() || null;

  // Documento fiscal
  const docTipo = document.getElementById('campo-doc-tipo')?.value || 'fatura';
  const docNum  = document.getElementById('campo-doc-num')?.value.trim() || _gerarNumDoc(docTipo);

  const exp = {
    id: DB.uid(), companyId: currentCompany.id, userId: currentUser.id,
    type: 'campo', status,
    name: `${typeLabel(tipo)} – ${local}`,
    expenseType: tipo, valor: total, moeda,
    data: inicio, local, dept,
    projeto: document.getElementById('campo-projeto').value.trim(),
    pessoas, valorPessoa: isNaN(valPessoa) ? 0 : valPessoa,
    trabalho,
    dataInicio: inicio,
    dataFim: document.getElementById('campo-data-fim').value,
    comentario: document.getElementById('campo-comentario').value.trim(),
    paymentMethod: payMethod,
    phoneNumber: ['mpesa','emola','mpesk'].includes(payMethod) ? phoneNum : '',
    gpsCoords,
    receiptData,
    approvals,
    submittedAt: status === 'pending' ? inicio : null,
    // Fornecedor
    fornecedor: forn ? { id: forn.id, nome: forn.nome, nuit: forn.nuit, tipo: forn.tipo, modalidade: forn.modalidade } : null,
    // Faturação / IVA
    docTipo, docNum,
    ivaAplicado: ivaInfo.comIVA,
    ivaTaxa:     ivaInfo.taxa,
    ivaRegime:   ivaInfo.regime,
    subtotal,
    ivaValor,
  };
  DB.saveExpense(exp);

  if (status === 'pending' && (currentCompany?.approvalChain||[]).length > 0) {
    notifyNextApprover(exp, currentCompany.approvalChain[0].level);
  }

  clearCampoForm();
  showToast(status === 'pending' ? 'Despesa enviada! 📤' : 'Rascunho guardado 💾', 'success');
  if (status === 'pending') updateBadges();
  showPage('page-despesas');
}

function clearProcForm() {
  ['proc-name','proc-valor','proc-local','proc-projeto','proc-comentario'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('proc-type').selectedIndex = 0;
  document.getElementById('proc-data').value = new Date().toISOString().slice(0,10);
  const pm = document.getElementById('proc-pay-method');
  if (pm) pm.selectedIndex = 0;
  document.getElementById('proc-phone-wrap')?.classList.add('hidden');
  resetUpload('proc-recibo','proc-preview','proc-upload-area');
}
function clearCampoForm() {
  ['campo-trabalho','campo-local','campo-projeto','campo-comentario','campo-km'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('campo-pessoas').value = 1;
  document.getElementById('campo-valor-pessoa').value = '';
  document.getElementById('campo-data-inicio').value = new Date().toISOString().slice(0,10);
  document.getElementById('campo-data-fim').value = '';
  document.getElementById('campo-total-display').textContent = '0.00 MZN';
  document.getElementById('campo-formula').textContent = '1 pessoa × 0.00 MZN';
  const pm = document.getElementById('campo-pay-method');
  if (pm) pm.selectedIndex = 0;
  document.getElementById('campo-phone-wrap')?.classList.add('hidden');
  resetUpload('campo-recibo','campo-preview','campo-upload-area');
}

// ── CAMPO CALC ──
function calcCampoTotal() {
  const n        = parseInt(document.getElementById('campo-pessoas').value) || 1;
  const v        = parseFloat(document.getElementById('campo-valor-pessoa').value) || 0;
  const cur      = document.getElementById('campo-moeda')?.value || 'MZN';
  const subtotal = n * v;
  document.getElementById('campo-total-display').textContent = fmtCurrency(subtotal, cur);
  document.getElementById('campo-formula').textContent = `${n} pessoa${n>1?'s':''} × ${fmtCurrency(v, cur)}`;
  // Actualizar banner IVA
  const { comIVA } = _getIVAInfo?.() || { comIVA: false };
  if (comIVA) _updateIVABanner?.(subtotal, cur);
}
function updateCampoMoeda() {
  const cur = document.getElementById('campo-moeda').value;
  document.getElementById('campo-moeda-label').textContent = cur;
  calcCampoTotal();
}
function selectTipo(btn) {
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('campo-tipo').value = btn.dataset.type;
}

// ── PAYMENT METHOD ──
function onPayMethodChange(selectId, phoneWrapId) {
  const val = document.getElementById(selectId)?.value;
  const wrap = document.getElementById(phoneWrapId);
  if (!wrap) return;
  wrap.classList.toggle('hidden', !['mpesa','emola','mpesk'].includes(val));
}

// ── OCR ──
async function runOCR(inputId, formType) {
  const input = document.getElementById(inputId);
  if (!input?.files[0]) { showToast('Selecione uma imagem primeiro', 'error'); return; }
  if (typeof OCR === 'undefined') { showToast('OCR não disponível', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    const result = await OCR.processImage(e.target.result);
    if (result) fillFormFromOCR(result, formType);
    else showToast('Não foi possível extrair dados. Preencha manualmente.', 'info');
  };
  reader.readAsDataURL(input.files[0]);
}

function fillFormFromOCR(data, formType) {
  if (formType === 'procurement') {
    if (data.valor) document.getElementById('proc-valor').value = data.valor;
    if (data.data)  document.getElementById('proc-data').value  = data.data;
    if (data.fornecedor) document.getElementById('proc-name').value = data.fornecedor;
    if (data.moeda) document.getElementById('proc-moeda').value  = data.moeda;
  } else {
    if (data.valor) document.getElementById('campo-valor-pessoa').value = data.valor;
    if (data.data)  document.getElementById('campo-data-inicio').value  = data.data;
    if (data.moeda) document.getElementById('campo-moeda').value        = data.moeda;
    calcCampoTotal();
  }
  showToast('✅ Dados extraídos do recibo!', 'success');
}

// ── UPLOAD ──
function triggerUpload(inputId) { document.getElementById(inputId)?.click(); }
function handleUpload(input, previewId, areaId) {
  const file = input.files[0];
  if (!file) return;
  const area    = document.getElementById(areaId);
  const preview = document.getElementById(previewId);
  area?.classList.add('has-file');
  const reader = new FileReader();
  reader.onload = e => {
    input._base64 = e.target.result;
    if (file.type.startsWith('image/')) {
      if (preview) preview.innerHTML = `<img src="${e.target.result}" alt="Recibo"/><span style="font-size:12px;color:#10785E">✓ ${file.name}</span>`;
    } else {
      if (preview) preview.innerHTML = `<span class="upload-icon">📄</span><span style="color:#10785E;font-weight:600">${file.name}</span>`;
    }
  };
  reader.readAsDataURL(file);
}
function resetUpload(inputId, previewId, areaId) {
  const input = document.getElementById(inputId);
  if (input) { input.value = ''; input._base64 = null; }
  document.getElementById(areaId)?.classList.remove('has-file');
  const preview = document.getElementById(previewId);
  if (preview) preview.innerHTML = `<span class="upload-icon">📷</span><span>Tirar foto ou carregar ficheiro</span><span class="upload-sub">JPG, PNG, PDF até 10MB</span>`;
}

// ── APROVAÇÕES ──
function filterAprov(status, btn) {
  aprovFilter = status;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAprovacoes();
}
function renderAprovacoes() {
  if (!currentCompany) return;
  let list = DB.getExpensesByCompany(currentCompany.id);
  if (aprovFilter !== 'all') list = list.filter(e => e.status === aprovFilter);
  list.sort((a,b) => (b.submittedAt||b.data||'').localeCompare(a.submittedAt||a.data||''));

  const container = document.getElementById('aprov-list');
  container.innerHTML = list.length === 0
    ? '<p class="empty-state">Nenhuma despesa encontrada.</p>'
    : `<div class="expense-list">${list.map(e => expenseItemHTML(e, true)).join('')}</div>`;
}

// ── PLANEAMENTO ──
function renderPlaneamento() {
  if (!currentCompany) return;
  const plans = DB.getPlansByCompany(currentCompany.id)
    .sort((a,b) => (a.inicio||'').localeCompare(b.inicio||''));
  const container = document.getElementById('plan-list');
  if (plans.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma atividade planeada.</p>'; return;
  }
  const planIcons = { campo:'🌍', viagem:'✈️', alojamento:'🏨', formacao:'📚', reuniao:'🤝' };
  container.innerHTML = plans.map(p => {
    const icon = planIcons[p.tipo] || '📅';
    const statusCls = { upcoming:'upcoming', active:'active', done:'done' }[p.status] || 'upcoming';
    const statusTxt = { upcoming:'Agendado', active:'Em curso', done:'Concluído' }[p.status] || 'Agendado';
    return `<div class="plan-item">
      <div class="plan-item-header">
        <div class="plan-item-title">${icon} ${p.desc}</div>
        <span class="plan-status ${statusCls}">${statusTxt}</span>
      </div>
      <div class="plan-item-meta">
        📅 ${fmtDate(p.inicio)} → ${fmtDate(p.fim)} &nbsp;·&nbsp; 📍 ${p.local||'—'}
        &nbsp;·&nbsp; 👥 ${p.pessoas} pessoa${p.pessoas>1?'s':''}
        &nbsp;·&nbsp; 💰 ${fmtCurrency(p.total||0, p.moeda||'MZN')} estimado
        ${p.projeto ? ' &nbsp;·&nbsp; 📌 ' + p.projeto : ''}
      </div>
    </div>`;
  }).join('');
}
function openPlanModal() {
  ['plan-desc','plan-local','plan-projeto','plan-notas'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('plan-pessoas').value = 1;
  document.getElementById('plan-custo').value   = '';
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('plan-inicio').value = today;
  document.getElementById('plan-fim').value    = today;
  document.getElementById('plan-total-display').textContent = '0.00 MZN';
  openModal('modal-plan');
}
function calcPlanTotal() {
  const n = parseInt(document.getElementById('plan-pessoas').value) || 1;
  const c = parseFloat(document.getElementById('plan-custo').value) || 0;
  const cur = document.getElementById('plan-moeda').value;
  document.getElementById('plan-total-display').textContent = fmtCurrency(n*c, cur);
}
function savePlan() {
  const desc  = document.getElementById('plan-desc').value.trim();
  const local = document.getElementById('plan-local').value.trim();
  const inicio = document.getElementById('plan-inicio').value;
  if (!desc || !local || !inicio) { showToast('Preencha os campos obrigatórios', 'error'); return; }
  const n = parseInt(document.getElementById('plan-pessoas').value) || 1;
  const c = parseFloat(document.getElementById('plan-custo').value) || 0;
  const cur = document.getElementById('plan-moeda').value;
  const forn = _saveFornecedorPlanInline?.() || null;
  DB.savePlan({
    id: DB.uid(), companyId: currentCompany.id, createdBy: currentUser.id,
    tipo: document.getElementById('plan-tipo').value,
    desc, local, inicio,
    fim: document.getElementById('plan-fim').value,
    pessoas: n, custo: c, total: n*c, moeda: cur,
    projeto: document.getElementById('plan-projeto').value.trim(),
    notas: document.getElementById('plan-notas').value.trim(),
    fornecedor: forn ? { id: forn.id, nome: forn.nome, nuit: forn.nuit, tipo: forn.tipo } : null,
    status: 'upcoming',
    createdAt: new Date().toISOString().slice(0,10),
  });
  closeModal('modal-plan');
  showToast('Atividade planeada! 📅', 'success');
  renderPlaneamento();
}

// ── RELATÓRIOS ──
let repChartBar = null;

// Navegar para relatórios com período pré-definido
function setRelPeriod(period) {
  reportPeriod = period;
  showPage('page-relatorios');
  // Actualizar botões depois de navegar
  setTimeout(() => {
    document.querySelectorAll('#page-relatorios .period-btn').forEach(b => b.classList.remove('active'));
    const periodos = { day:0, week:1, month:2, year:3, all:4 };
    const btns = document.querySelectorAll('#page-relatorios .period-btn');
    if (btns[periodos[period]]) btns[periodos[period]].classList.add('active');
    const lbl = document.getElementById('rel-period-label');
    if (lbl) lbl.textContent = periodLabel(period);
  }, 50);
}

function setReportPeriod(period, btn) {
  reportPeriod = period;
  document.querySelectorAll('#page-relatorios .period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const lbl = document.getElementById('rel-period-label');
  if (lbl) lbl.textContent = periodLabel(period);
  renderRelatorios();
}

function renderRelatorios() {
  if (!currentCompany) return;
  const currency = currentCompany.currency || 'MZN';
  const isFunc   = currentUser.role === 'funcionario';

  // Funcionário vê só as suas; gestores vêem todas
  let all = isFunc
    ? DB.getExpensesByUser(currentUser.id)
    : DB.getExpensesByCompany(currentCompany.id);
  all = all.filter(e => e.status !== 'draft');
  let list = filterByPeriod(all, reportPeriod);

  const total = list.reduce((s,e) => s+(e.valor||0), 0);
  const count = list.length;
  const max   = count > 0 ? Math.max(...list.map(e => e.valor||0)) : 0;
  const avg   = count > 0 ? total/count : 0;

  const setEl = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  setEl('rep-total', fmtCurrency(total, currency));
  setEl('rep-count', count);
  setEl('rep-max',   fmtCurrency(max, currency));
  setEl('rep-avg',   fmtCurrency(avg, currency));

  // ── Gráfico de barras — evolução no período ──
  if (repChartBar) { try { repChartBar.destroy(); } catch {} repChartBar = null; }
  const ctxBar = document.getElementById('rep-chart-bar')?.getContext('2d');
  if (ctxBar) {
    const { labels, data, barTitle, barSub } = _buildBarData(all, reportPeriod, currency);
    setEl('rep-bar-title', barTitle);
    setEl('rep-bar-sub',   barSub);
    repChartBar = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: `Despesas (${currency})`,
          data,
          backgroundColor: labels.map((_,i) => i%2===0 ? 'rgba(30,58,95,0.8)' : 'rgba(30,58,95,0.5)'),
          borderColor: '#1E3A5F', borderWidth: 1, borderRadius: 5,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero:true, ticks:{font:{size:11}}, grid:{color:'#f0f0f0'} },
          x: { ticks:{font:{size:10}}, grid:{display:false} },
        },
        onClick: (_evt, items) => {
          if (!items.length) return;
          showPage('page-despesas');
        }
      }
    });
  }

  // ── Gráfico pizza — por categoria ──
  const cats = {};
  list.forEach(e => {
    const k = e.type === 'procurement' ? '🛒 Procurement' : `${expenseIcon(e)} ${typeLabel(e.expenseType)}`;
    cats[k] = (cats[k]||0) + (e.valor||0);
  });
  if (repChartCat) { try { repChartCat.destroy(); } catch {} }
  const ctxCat = document.getElementById('rep-chart-cat')?.getContext('2d');
  if (ctxCat) {
    repChartCat = new Chart(ctxCat, {
      type: 'pie',
      data: {
        labels: Object.keys(cats).length > 0 ? Object.keys(cats) : ['Sem dados'],
        datasets: [{ data: Object.values(cats).length > 0 ? Object.values(cats) : [1],
          backgroundColor: ['#1E3A5F','#10B981','#F59E0B','#3B82F6','#EF4444','#06B6D4','#8B5CF6','#F97316'],
          borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{font:{size:11}}}} }
    });
  }

  // ── Gráfico donut — por estado ──
  const statusCounts = {
    'Aprovado': list.filter(e=>e.status==='approved').length,
    'Pendente': list.filter(e=>e.status==='pending').length,
    'Rejeitado': list.filter(e=>e.status==='rejected').length,
  };
  if (repChartStatus) { try { repChartStatus.destroy(); } catch {} }
  const ctxSt = document.getElementById('rep-chart-status')?.getContext('2d');
  if (ctxSt) {
    repChartStatus = new Chart(ctxSt, {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{ data: Object.values(statusCounts),
          backgroundColor: ['#10B981','#F59E0B','#EF4444'],
          borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{font:{size:11}}}} }
    });
  }

  // ── Tabela clicável ──
  const tbody = document.getElementById('rep-table-body');
  if (!tbody) return;
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Sem dados para ${periodLabel(reportPeriod)}.</td></tr>`;
    return;
  }
  const sorted = [...list].sort((a,b) => (b.data||'').localeCompare(a.data||''));
  tbody.innerHTML = sorted.map(e => {
    const user = DB.getUser(e.userId);
    return `<tr class="table-row-clickable" onclick="openExpenseDetail('${e.id}')">
      <td>${fmtDate(e.data)}</td>
      <td>${e.type==='procurement'?'🛒 Proc.':(e.type==='campo-pedido'?'📋 Pedido':'🌍 Campo')}</td>
      <td>${expenseName(e)}${!isFunc && user ? `<br/><small style="color:var(--text-secondary)">${user.name}</small>` : ''}</td>
      <td>${typeLabel(e.expenseType||e.type)}</td>
      <td><strong>${fmtCurrency(e.valor||0, e.moeda||currency)}</strong></td>
      <td><span class="status-badge ${e.status}">${statusLabel(e.status)}</span></td>
    </tr>`;
  }).join('');
}

function _buildBarData(expenses, period, currency) {
  const now = new Date();
  let labels = [], data = [], barTitle = '', barSub = '';
  const approved = expenses.filter(e => e.status !== 'draft');

  if (period === 'day') {
    labels = Array.from({length:24},(_,i)=>`${String(i).padStart(2,'0')}h`);
    data   = Array(24).fill(0);
    const today = new Date(); today.setHours(0,0,0,0);
    approved.forEach(e => {
      const d = new Date(e.submittedAt||(e.data+'T12:00:00'));
      if (d>=today) data[d.getHours()]+=(e.valor||0);
    });
    barTitle = 'Despesas de Hoje por Hora';
    barSub   = now.toLocaleDateString('pt-PT');
  } else if (period === 'week') {
    const days = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
    labels = days; data = Array(7).fill(0);
    const dow=(now.getDay()+6)%7;
    const wStart=new Date(now); wStart.setDate(now.getDate()-dow); wStart.setHours(0,0,0,0);
    approved.forEach(e => {
      const d=new Date((e.data||'')+'T00:00:00');
      if(d>=wStart){const idx=Math.floor((d-wStart)/86400000);if(idx>=0&&idx<7)data[idx]+=(e.valor||0);}
    });
    barTitle = 'Despesas Esta Semana'; barSub = '';
  } else if (period === 'month') {
    const dim = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    labels = Array.from({length:dim},(_,i)=>String(i+1));
    data   = Array(dim).fill(0);
    approved.forEach(e => {
      const d=new Date((e.data||'')+'T00:00:00');
      if(d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear())data[d.getDate()-1]+=(e.valor||0);
    });
    barTitle = `Despesas em ${now.toLocaleDateString('pt-PT',{month:'long',year:'numeric'})}`;
    barSub   = 'por dia';
  } else if (period === 'year') {
    const mns = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    labels = mns; data = Array(12).fill(0);
    approved.forEach(e => {
      const d=new Date((e.data||'')+'T00:00:00');
      if(d.getFullYear()===now.getFullYear()) data[d.getMonth()]+=(e.valor||0);
    });
    barTitle = `Despesas em ${now.getFullYear()}`; barSub = 'por mês';
  } else {
    // All — por ano/mês
    const months = {};
    approved.forEach(e => {
      if (!e.data) return;
      const d = new Date(e.data+'T00:00:00');
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months[k] = (months[k]||0) + (e.valor||0);
    });
    const sorted = Object.keys(months).sort();
    labels = sorted.map(k => { const [y,m]=k.split('-'); return new Date(+y,+m-1,1).toLocaleDateString('pt-PT',{month:'short',year:'2-digit'}); });
    data   = sorted.map(k => months[k]);
    barTitle = 'Evolução de Todos os Períodos'; barSub = 'por mês';
  }
  return { labels, data, barTitle, barSub };
}

// ── TENDÊNCIAS DE GASTOS ──
let tendChart = null;
let tendGroup = 'dept';

function setTendGroup(g, btn) {
  tendGroup = g;
  document.querySelectorAll('#page-tendencias .period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTendencias();
}

function renderTendencias() {
  if (!currentCompany) return;
  const currency = currentCompany.currency || 'MZN';
  const isFunc   = currentUser.role === 'funcionario';
  let expenses   = isFunc
    ? DB.getExpensesByUser(currentUser.id)
    : DB.getExpensesByCompany(currentCompany.id);
  expenses = expenses.filter(e => e.status !== 'draft');

  // Agrupar
  const groups = {};
  expenses.forEach(e => {
    let key = '—';
    if (tendGroup === 'dept')       key = e.dept || 'Sem Dept.';
    else if (tendGroup === 'user')  { const u = DB.getUser(e.userId); key = u ? u.name : 'Desconhecido'; }
    else if (tendGroup === 'supervisor') {
      const u = DB.getUser(e.userId);
      key = u?.supervisorId ? (DB.getUser(u.supervisorId)?.name || 'Sem Supervisor') : 'Sem Supervisor';
    }
    if (!groups[key]) groups[key] = { total:0, count:0, approved:0, pending:0, items:[] };
    groups[key].total    += (e.valor||0);
    groups[key].count    += 1;
    groups[key].approved += e.status==='approved' ? 1 : 0;
    groups[key].pending  += e.status==='pending'  ? 1 : 0;
    groups[key].items.push(e);
  });

  const sortedKeys = Object.keys(groups).sort((a,b) => groups[b].total - groups[a].total);

  // KPIs
  const kpisEl = document.getElementById('tend-kpis');
  if (kpisEl) {
    const totalAll = expenses.reduce((s,e) => s+(e.valor||0), 0);
    const topKey   = sortedKeys[0] || '—';
    kpisEl.innerHTML = `
      <div class="stat-card blue"><div class="stat-icon">💰</div>
        <div class="stat-info"><div class="stat-label">Total Global</div>
        <div class="stat-value">${fmtCurrency(totalAll, currency)}</div></div></div>
      <div class="stat-card green"><div class="stat-icon">🏆</div>
        <div class="stat-info"><div class="stat-label">Maior Grupo</div>
        <div class="stat-value" style="font-size:1rem">${topKey}</div></div></div>
      <div class="stat-card amber"><div class="stat-icon">📋</div>
        <div class="stat-info"><div class="stat-label">Total Despesas</div>
        <div class="stat-value">${expenses.length}</div></div></div>
      <div class="stat-card purple"><div class="stat-icon">🗂️</div>
        <div class="stat-info"><div class="stat-label">Grupos</div>
        <div class="stat-value">${sortedKeys.length}</div></div></div>
    `;
  }

  // Gráfico de barras horizontais
  if (tendChart) { try { tendChart.destroy(); } catch {} tendChart = null; }
  const ctx = document.getElementById('tend-chart')?.getContext('2d');
  const groupTitles = { dept:'Departamento', user:'Funcionário', supervisor:'Supervisor' };
  const setEl = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  setEl('tend-chart-title', `Gastos por ${groupTitles[tendGroup]||'Grupo'}`);
  setEl('tend-table-title', `Detalhe por ${groupTitles[tendGroup]||'Grupo'}`);

  if (ctx && sortedKeys.length > 0) {
    tendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedKeys,
        datasets: [{
          label: `Total (${currency})`,
          data: sortedKeys.map(k => groups[k].total),
          backgroundColor: ['#1E3A5F','#10B981','#F59E0B','#3B82F6','#EF4444','#8B5CF6','#06B6D4','#F97316'].slice(0, sortedKeys.length),
          borderRadius: 5,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display:false } },
        scales: {
          x: { beginAtZero:true, ticks:{font:{size:10}}, grid:{color:'#f0f0f0'} },
          y: { ticks:{font:{size:11}}, grid:{display:false} },
        }
      }
    });
  }

  // Tabela expansível
  const tableEl = document.getElementById('tend-table-body');
  if (!tableEl) return;
  if (sortedKeys.length === 0) {
    tableEl.innerHTML = '<p class="empty-state">Sem dados disponíveis.</p>';
    return;
  }
  tableEl.innerHTML = sortedKeys.map((key, gi) => {
    const g = groups[key];
    const pct = expenses.length > 0 ? ((g.count / expenses.length)*100).toFixed(1) : 0;
    return `
      <div class="tend-group-row" onclick="toggleTendGroup('tend-grp-${gi}')">
        <div class="tend-group-info">
          <span class="tend-group-name">${key}</span>
          <span class="tend-group-meta">${g.count} despesa(s) · ${pct}% do total</span>
        </div>
        <div class="tend-group-stats">
          <span class="tend-group-total">${fmtCurrency(g.total, currency)}</span>
          <span class="tend-caret">▼</span>
        </div>
      </div>
      <div class="tend-group-detail hidden" id="tend-grp-${gi}">
        ${g.items.sort((a,b)=>(b.data||'').localeCompare(a.data||'')).map(e => `
          <div class="expense-item ${e.status}" onclick="openExpenseDetail('${e.id}');event.stopPropagation()">
            <div class="expense-icon">${expenseIcon(e)}</div>
            <div class="expense-info">
              <div class="expense-name">${expenseName(e)}</div>
              <div class="expense-meta">${fmtDate(e.data)} · ${typeLabel(e.expenseType)}</div>
            </div>
            <div class="expense-right">
              <div class="expense-amount">${fmtCurrency(e.valor||0, e.moeda||currency)}</div>
              <div class="expense-status"><span class="status-badge ${e.status}">${statusLabel(e.status)}</span></div>
            </div>
          </div>`).join('')}
      </div>`;
  }).join('');
}

function toggleTendGroup(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden');
  // Flip caret
  const caret = el.previousElementSibling?.querySelector('.tend-caret');
  if (caret) caret.textContent = el.classList.contains('hidden') ? '▼' : '▲';
}

function exportTendencias() {
  if (!currentCompany) return;
  const expenses = DB.getExpensesByCompany(currentCompany.id).filter(e => e.status!=='draft');
  const rows = [['Grupo','Tipo Grupo','Total','Nº Despesas','Aprovadas','Pendentes']];
  const groups = {};
  expenses.forEach(e => {
    let key = tendGroup==='dept' ? (e.dept||'—') : (DB.getUser(e.userId)?.name||'—');
    if(!groups[key]) groups[key]={total:0,count:0,approved:0,pending:0};
    groups[key].total+=(e.valor||0); groups[key].count++;
    if(e.status==='approved') groups[key].approved++;
    if(e.status==='pending')  groups[key].pending++;
  });
  Object.entries(groups).forEach(([k,g]) => rows.push([k, tendGroup, g.total.toFixed(2), g.count, g.approved, g.pending]));
  const csv = rows.map(r => r.map(c=>`"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download = `SGODC_Tendencias_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado! ⬇️','success');
}

// ── DESPESAS DIVIDIDAS ──
let divGroup = 'dept';

function setDivGroup(g, btn) {
  divGroup = g;
  document.querySelectorAll('#page-divididas .period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDespesasDivididas();
}

function renderDespesasDivididas() {
  if (!currentCompany) return;
  const currency = currentCompany.currency || 'MZN';
  const isFunc   = currentUser.role === 'funcionario';
  let expenses   = isFunc
    ? DB.getExpensesByUser(currentUser.id)
    : DB.getExpensesByCompany(currentCompany.id);
  expenses = expenses.filter(e => e.status !== 'draft');

  const groups = {};
  expenses.forEach(e => {
    let key = '—';
    if      (divGroup === 'dept')     key = e.dept || 'Sem Departamento';
    else if (divGroup === 'user')     { const u = DB.getUser(e.userId); key = u ? u.name : 'Desconhecido'; }
    else if (divGroup === 'supervisor') {
      const u = DB.getUser(e.userId);
      key = u?.supervisorId ? (DB.getUser(u.supervisorId)?.name||'Sem Supervisor') : 'Sem Supervisor';
    }
    else if (divGroup === 'category') key = typeLabel(e.expenseType||e.type) || '—';
    if (!groups[key]) groups[key] = { total:0, approved:0, pending:0, rejected:0, items:[] };
    groups[key].total    += (e.valor||0);
    groups[key].approved += e.status==='approved'?1:0;
    groups[key].pending  += e.status==='pending' ?1:0;
    groups[key].rejected += e.status==='rejected'?1:0;
    groups[key].items.push(e);
  });

  const totalAll = expenses.reduce((s,e)=>s+(e.valor||0),0);
  const sortedKeys = Object.keys(groups).sort((a,b)=>groups[b].total-groups[a].total);

  const grid = document.getElementById('divididas-grid');
  if (!grid) return;
  if (sortedKeys.length === 0) {
    grid.innerHTML = '<p class="empty-state">Sem despesas para mostrar.</p>';
    return;
  }

  const colors = ['#1E3A5F','#10B981','#F59E0B','#3B82F6','#EF4444','#8B5CF6','#06B6D4','#F97316'];
  grid.innerHTML = sortedKeys.map((key, i) => {
    const g = groups[key];
    const pct = totalAll > 0 ? ((g.total/totalAll)*100).toFixed(1) : 0;
    const color = colors[i % colors.length];
    return `
      <div class="div-card" onclick="renderDividaDetalhe('${key.replace(/'/g,"\\'")}')">
        <div class="div-card-accent" style="background:${color}"></div>
        <div class="div-card-body">
          <div class="div-card-title">${key}</div>
          <div class="div-card-total">${fmtCurrency(g.total, currency)}</div>
          <div class="div-card-pct">${pct}% do total</div>
          <div class="div-card-bar">
            <div class="div-card-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="div-card-badges">
            <span class="status-badge approved">✅ ${g.approved}</span>
            <span class="status-badge pending">⏳ ${g.pending}</span>
            <span class="status-badge rejected">❌ ${g.rejected}</span>
          </div>
          <div class="div-card-count">${g.items.length} despesa(s) · Clique para ver detalhe</div>
        </div>
      </div>`;
  }).join('');
}

function renderDividaDetalhe(key) {
  // Navegar para relatórios filtrando pelo grupo
  showPage('page-despesas');
  setTimeout(() => {
    const s = document.getElementById('filter-search');
    if (s) { s.value = key; renderExpenseList(); }
  }, 100);
}

function exportReport() {
  let list = DB.getExpensesByCompany(currentCompany.id).filter(e => e.status !== 'draft');
  list = filterByPeriod(list, reportPeriod);
  const currency = currentCompany.currency || 'MZN';
  const rows = [['Data','Tipo','Categoria','Descrição','Valor','Moeda','Local','Projeto','Estado','Pagamento']];
  list.sort((a,b) => (b.data||'').localeCompare(a.data||'')).forEach(e => {
    rows.push([
      e.data||'', e.type||'', e.type==='procurement'?'Procurement':typeLabel(e.expenseType),
      expenseName(e), e.valor||0, e.moeda||currency, e.local||'', e.projeto||'',
      e.status||'', payMethodLabel(e.paymentMethod)
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SGODC_Relatorio_${reportPeriod}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado! ⬇️', 'success');
}

function downloadPDFReport() {
  if (typeof ReportPDF === 'undefined') { showToast('Módulo PDF não disponível', 'error'); return; }
  let list = DB.getExpensesByCompany(currentCompany.id).filter(e => e.status !== 'draft');
  list = filterByPeriod(list, reportPeriod);
  const periodLabels = { month:'Mensal', quarter:'Trimestral', year:'Anual', all:'Total' };
  const doc = ReportPDF.generate(list, {
    company: currentCompany,
    period: periodLabels[reportPeriod] || reportPeriod,
    currency: currentCompany.currency || 'MZN',
  });
  ReportPDF.download(doc, `SGODC_Relatorio_${reportPeriod}_${new Date().toISOString().slice(0,10)}.pdf`);
  showToast('PDF gerado! ⬇️', 'success');
}

function sendReportEmail(type) {
  if (typeof EmailSender === 'undefined') { showToast('Módulo email não disponível', 'error'); return; }
  let list = DB.getExpensesByCompany(currentCompany.id).filter(e => e.status !== 'draft');
  list = filterByPeriod(list, reportPeriod);
  const cfg = Scheduler.getConfig(currentCompany.id);
  const recipients = cfg?.recipients || [];
  if (recipients.length === 0) { showToast('Configure os destinatários em Configurações', 'error'); return; }
  EmailSender.sendViaMailto(recipients, `Relatório SGODC – ${currentCompany.name}`,
    EmailSender.buildEmailBody(type || reportPeriod, list, currentCompany));
  showToast('A abrir cliente de email...', 'info');
}

// ── SCHEDULED REPORTS ──
function checkScheduledReports(companyId) {
  if (!companyId || typeof Scheduler === 'undefined') return;
  const due = Scheduler.check(companyId);
  if (due.length === 0) return;
  const banner = document.getElementById('sched-report-banner');
  const text   = document.getElementById('sched-report-text');
  if (!banner || !text) return;
  text.textContent = `📊 Relatório automático pronto: ${due.map(d => d.label).join(', ')}`;
  banner.classList.remove('hidden');
  banner._duePeriods = due;
}
function sendScheduledReport() {
  const banner = document.getElementById('sched-report-banner');
  const due = banner?._duePeriods || [];
  due.forEach(d => {
    let list = DB.getExpensesByCompany(currentCompany.id).filter(e => e.status !== 'draft');
    list = filterByPeriod(list, d.type === 'weekly' || d.type === 'monthly' ? 'month' : d.type === 'quarterly' ? 'quarter' : 'year');
    if (typeof ReportPDF !== 'undefined') {
      const doc = ReportPDF.generate(list, { company: currentCompany, period: d.label, currency: currentCompany.currency || 'MZN' });
      ReportPDF.download(doc, `SGDC_Auto_${d.type}_${new Date().toISOString().slice(0,10)}.pdf`);
    }
    if (typeof Scheduler !== 'undefined') Scheduler.markSent(currentCompany.id, d.type);
  });
  banner?.classList.add('hidden');
  showToast('Relatório enviado! ✅', 'success');
}

// ══════════════════════════════════════════════
// ── FORNECEDORES ──
// ══════════════════════════════════════════════
const FORN_TIPO_LABEL = {
  hotel:'🏨 Hotel/Alojamento', restaurante:'🍽️ Restaurante',
  transporte:'🚗 Transportadora', comunicacao:'📞 Comunicações', outro:'⚙️ Outro'
};
const FORN_PAG_LABEL = { pronto:'💵 Pronto Pagamento', credito:'🏦 A Prazo (Crédito)' };

function renderFornecedores() {
  if (!currentCompany) return;
  const q     = (document.getElementById('forn-search-page')?.value || '').toLowerCase();
  const tipo  = document.getElementById('forn-filter-tipo')?.value || '';
  const pag   = document.getElementById('forn-filter-pag')?.value  || '';
  let list    = DB.getFornecedoresByCompany(currentCompany.id);

  if (q)    list = list.filter(f => (f.nome+f.nuit+f.contacto).toLowerCase().includes(q));
  if (tipo) list = list.filter(f => f.tipo === tipo);
  if (pag)  list = list.filter(f => f.modalidade === pag);

  // Stats
  const statsEl = document.getElementById('forn-stats');
  if (statsEl) {
    const all = DB.getFornecedoresByCompany(currentCompany.id);
    const credito = all.filter(f=>f.modalidade==='credito').length;
    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-value">${all.length}</div><div class="stat-label">Total Fornecedores</div></div>
      <div class="stat-card"><div class="stat-value">${all.filter(f=>f.tipo==='hotel').length}</div><div class="stat-label">Hotéis/Alojamento</div></div>
      <div class="stat-card"><div class="stat-value">${all.filter(f=>f.tipo==='restaurante').length}</div><div class="stat-label">Restaurantes</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${credito}</div><div class="stat-label">A Prazo/Crédito</div></div>`;
  }

  const container = document.getElementById('forn-list-container');
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhum fornecedor encontrado.</p>'; return;
  }
  container.innerHTML = `<div class="forn-grid">${list.map(f => `
    <div class="forn-page-card">
      <div class="forn-page-card-head">
        <div class="forn-page-icon">${FORN_TIPO_LABEL[f.tipo]?.charAt(0) || '🏢'}</div>
        <div class="forn-page-info">
          <div class="forn-page-nome">${f.nome}</div>
          <div class="forn-page-meta">${FORN_TIPO_LABEL[f.tipo]||f.tipo}</div>
        </div>
        <span class="forn-pag-badge ${f.modalidade}">${FORN_PAG_LABEL[f.modalidade]||f.modalidade}</span>
      </div>
      <div class="forn-page-details">
        ${f.nuit ? `<span>🔢 NUIT: <strong>${f.nuit}</strong></span>` : ''}
        ${f.contacto ? `<span>📞 ${f.contacto}</span>` : ''}
        ${f.endereco ? `<span>📍 ${f.endereco}</span>` : ''}
      </div>
      ${f.obs ? `<div class="forn-page-obs">${f.obs}</div>` : ''}
      <div class="forn-page-actions">
        <button class="btn btn-sm btn-outline" onclick="openFornecedorModal('${f.id}')">✏️ Editar</button>
        <button class="btn btn-sm btn-outline" style="color:var(--danger)" onclick="deleteFornecedorPage('${f.id}')">🗑️ Remover</button>
      </div>
    </div>`).join('')}</div>`;
}

function openFornecedorModal(id) {
  const f = id ? DB.getFornecedor(id) : null;
  document.getElementById('modal-forn-title').textContent = f ? 'Editar Fornecedor' : 'Novo Fornecedor';
  document.getElementById('modal-forn-id').value       = f?.id || '';
  document.getElementById('modal-forn-nome').value     = f?.nome || '';
  document.getElementById('modal-forn-nuit').value     = f?.nuit || '';
  document.getElementById('modal-forn-endereco').value = f?.endereco || '';
  document.getElementById('modal-forn-contacto').value = f?.contacto || '';
  document.getElementById('modal-forn-tipo').value     = f?.tipo || 'hotel';
  document.getElementById('modal-forn-pag').value      = f?.modalidade || 'pronto';
  document.getElementById('modal-forn-rodape').value   = f?.rodape || '';
  document.getElementById('modal-forn-obs').value      = f?.obs || '';
  openModal('modal-fornecedor');
}

function saveFornecedorModal() {
  const nome = document.getElementById('modal-forn-nome').value.trim();
  if (!nome) { showToast('Nome do fornecedor obrigatório', 'error'); return; }
  const id = document.getElementById('modal-forn-id').value || DB.uid();
  DB.saveFornecedor({
    id, companyId: currentCompany.id,
    nome,
    nuit:      document.getElementById('modal-forn-nuit').value.trim(),
    endereco:  document.getElementById('modal-forn-endereco').value.trim(),
    contacto:  document.getElementById('modal-forn-contacto').value.trim(),
    tipo:      document.getElementById('modal-forn-tipo').value,
    modalidade:document.getElementById('modal-forn-pag').value,
    rodape:    document.getElementById('modal-forn-rodape').value.trim(),
    obs:       document.getElementById('modal-forn-obs').value.trim(),
    criadoEm:  new Date().toISOString(),
  });
  closeModal('modal-fornecedor');
  renderFornecedores();
  showToast('Fornecedor guardado ✅', 'success');
}

function deleteFornecedorPage(id) {
  if (!confirm('Remover este fornecedor?')) return;
  DB.deleteFornecedor(id);
  renderFornecedores();
  showToast('Fornecedor removido', 'info');
}

// ── Fornecedor inline no formulário de campo ──
let _fornSelecionado = null;

function searchFornecedor(q) {
  const dd = document.getElementById('campo-forn-dropdown');
  if (!dd || !currentCompany) return;
  if (!q || q.length < 2) { dd.classList.add('hidden'); return; }
  const list = DB.getFornecedoresByCompany(currentCompany.id)
    .filter(f => (f.nome+f.nuit+f.contacto).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6);
  if (list.length === 0) {
    dd.innerHTML = '<div class="forn-dd-item forn-dd-empty">Nenhum resultado — adicione abaixo</div>';
  } else {
    dd.innerHTML = list.map(f => `
      <div class="forn-dd-item" onclick="selectFornecedor('${f.id}')">
        <span class="forn-dd-nome">${f.nome}</span>
        <span class="forn-dd-meta">${FORN_TIPO_LABEL[f.tipo]||''} · ${FORN_PAG_LABEL[f.modalidade]||''}</span>
      </div>`).join('');
  }
  dd.classList.remove('hidden');
}

function selectFornecedor(id) {
  const f = DB.getFornecedor(id);
  if (!f) return;
  _fornSelecionado = f;
  document.getElementById('campo-forn-search').value = '';
  document.getElementById('campo-forn-dropdown').classList.add('hidden');
  document.getElementById('campo-forn-nome-disp').textContent = f.nome;
  document.getElementById('campo-forn-nuit-disp').textContent = f.nuit ? `NUIT: ${f.nuit}` : '';
  document.getElementById('campo-forn-tipo-disp').textContent = FORN_TIPO_LABEL[f.tipo] || '';
  document.getElementById('campo-forn-pag-disp').textContent  = FORN_PAG_LABEL[f.modalidade] || '';
  document.getElementById('campo-forn-selected').classList.remove('hidden');
  // Ocultar form de novo fornecedor se estiver aberto
  document.getElementById('campo-forn-novo-wrap')?.classList.add('hidden');
  document.getElementById('btn-toggle-forn').textContent = '+ Adicionar Novo Fornecedor';
}

function clearFornecedor() {
  _fornSelecionado = null;
  document.getElementById('campo-forn-search').value = '';
  document.getElementById('campo-forn-selected').classList.add('hidden');
}

function toggleNovoFornecedor() {
  const wrap = document.getElementById('campo-forn-novo-wrap');
  const btn  = document.getElementById('btn-toggle-forn');
  if (!wrap) return;
  const showing = !wrap.classList.contains('hidden');
  wrap.classList.toggle('hidden', showing);
  btn.textContent = showing ? '+ Adicionar Novo Fornecedor' : '− Cancelar';
}

// ══════════════════════════════════════════════
// ── IVA / FATURAÇÃO (Moçambique – 16%) ──
// ══════════════════════════════════════════════
function onIVAChange() {
  const comIVA = document.querySelector('input[name="campo-iva"]:checked')?.value === 'sim';
  document.getElementById('campo-iva-taxa-wrap')?.classList.toggle('hidden', !comIVA);
  document.getElementById('campo-iva-regime-wrap')?.classList.toggle('hidden', !comIVA);
  document.getElementById('campo-iva-banner')?.classList.toggle('hidden', !comIVA);
  calcCampoTotal();
}

function _getIVAInfo() {
  const comIVA = document.querySelector('input[name="campo-iva"]:checked')?.value === 'sim';
  const taxa   = parseFloat(document.getElementById('campo-iva-taxa')?.value || '16') || 16;
  const regime = document.getElementById('campo-iva-regime')?.value || 'normal';
  return { comIVA, taxa, regime };
}

function _updateIVABanner(subtotal, moeda) {
  const { comIVA, taxa } = _getIVAInfo();
  if (!comIVA) return;
  const ivaVal = subtotal * (taxa / 100);
  const total  = subtotal + ivaVal;
  document.getElementById('campo-iva-pct-label').textContent  = taxa;
  document.getElementById('campo-subtotal-disp').textContent  = fmtCurrency(subtotal, moeda);
  document.getElementById('campo-iva-valor-disp').textContent = fmtCurrency(ivaVal, moeda);
  document.getElementById('campo-total-iva-disp').textContent = fmtCurrency(total, moeda);
}

// ── Guardar fornecedor inline ao submeter ──
function _saveFornecedorInline() {
  if (_fornSelecionado) return _fornSelecionado;
  const nome = document.getElementById('campo-forn-nome')?.value.trim();
  if (!nome) return null;
  const guardar = document.getElementById('campo-forn-guardar')?.checked;
  const f = {
    id: DB.uid(), companyId: currentCompany.id,
    nome,
    nuit:      document.getElementById('campo-forn-nuit')?.value.trim() || '',
    contacto:  document.getElementById('campo-forn-contacto')?.value.trim() || '',
    tipo:      document.getElementById('campo-forn-tipo')?.value || 'outro',
    modalidade:document.querySelector('input[name="campo-forn-pag"]:checked')?.value || 'pronto',
    criadoEm:  new Date().toISOString(),
  };
  if (guardar) DB.saveFornecedor(f);
  return f;
}

// ── Fornecedor no Pedido de Aprovação ──
let _fornSelecionadoPedido = null;

function searchFornecedorPedido(q) {
  const dd = document.getElementById('pedido-forn-dropdown');
  if (!dd || !currentCompany) return;
  if (!q || q.length < 2) { dd.classList.add('hidden'); return; }
  const list = DB.getFornecedoresByCompany(currentCompany.id)
    .filter(f => (f.nome+f.nuit+f.contacto).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6);
  if (list.length === 0) {
    dd.innerHTML = '<div class="forn-dd-item forn-dd-empty">Nenhum resultado — adicione abaixo</div>';
  } else {
    dd.innerHTML = list.map(f => `
      <div class="forn-dd-item" onclick="selectFornecedorPedido('${f.id}')">
        <span class="forn-dd-nome">${f.nome}</span>
        <span class="forn-dd-meta">${FORN_TIPO_LABEL[f.tipo]||''} · ${FORN_PAG_LABEL[f.modalidade]||''}</span>
      </div>`).join('');
  }
  dd.classList.remove('hidden');
}

function selectFornecedorPedido(id) {
  const f = DB.getFornecedor(id);
  if (!f) return;
  _fornSelecionadoPedido = f;
  document.getElementById('pedido-forn-search').value = '';
  document.getElementById('pedido-forn-dropdown').classList.add('hidden');
  document.getElementById('pedido-forn-nome-disp').textContent = f.nome;
  document.getElementById('pedido-forn-nuit-disp').textContent = f.nuit ? `NUIT: ${f.nuit}` : '';
  document.getElementById('pedido-forn-tipo-disp').textContent = FORN_TIPO_LABEL[f.tipo] || '';
  document.getElementById('pedido-forn-pag-disp').textContent  = FORN_PAG_LABEL[f.modalidade] || '';
  document.getElementById('pedido-forn-selected').classList.remove('hidden');
  document.getElementById('pedido-forn-novo-wrap')?.classList.add('hidden');
  document.getElementById('btn-toggle-pedido-forn').textContent = '+ Adicionar Novo Fornecedor';
}

function clearFornecedorPedido() {
  _fornSelecionadoPedido = null;
  document.getElementById('pedido-forn-search').value = '';
  document.getElementById('pedido-forn-selected').classList.add('hidden');
}

function toggleNovoFornecedorPedido() {
  const wrap = document.getElementById('pedido-forn-novo-wrap');
  const btn  = document.getElementById('btn-toggle-pedido-forn');
  if (!wrap) return;
  const showing = !wrap.classList.contains('hidden');
  wrap.classList.toggle('hidden', showing);
  btn.textContent = showing ? '+ Adicionar Novo Fornecedor' : '− Cancelar';
}

function _saveFornecedorPedidoInline() {
  if (_fornSelecionadoPedido) return _fornSelecionadoPedido;
  const nome = document.getElementById('pedido-forn-nome')?.value.trim();
  if (!nome) return null;
  const guardar = document.getElementById('pedido-forn-guardar')?.checked;
  const f = {
    id: DB.uid(), companyId: currentCompany.id,
    nome,
    nuit:      document.getElementById('pedido-forn-nuit')?.value.trim() || '',
    contacto:  document.getElementById('pedido-forn-contacto')?.value.trim() || '',
    tipo:      document.getElementById('pedido-forn-tipo')?.value || 'outro',
    modalidade:document.querySelector('input[name="pedido-forn-pag"]:checked')?.value || 'pronto',
    criadoEm:  new Date().toISOString(),
  };
  if (guardar) DB.saveFornecedor(f);
  return f;
}

// ── Fornecedor no Planeamento ──
let _fornSelecionadoPlan = null;

function searchFornecedorPlan(q) {
  const dd = document.getElementById('plan-forn-dropdown');
  if (!dd || !currentCompany) return;
  if (!q || q.length < 2) { dd.classList.add('hidden'); return; }
  const list = DB.getFornecedoresByCompany(currentCompany.id)
    .filter(f => (f.nome+f.nuit+f.contacto).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6);
  if (list.length === 0) {
    dd.innerHTML = '<div class="forn-dd-item forn-dd-empty">Nenhum resultado — adicione abaixo</div>';
  } else {
    dd.innerHTML = list.map(f => `
      <div class="forn-dd-item" onclick="selectFornecedorPlan('${f.id}')">
        <span class="forn-dd-nome">${f.nome}</span>
        <span class="forn-dd-meta">${FORN_TIPO_LABEL[f.tipo]||''} · ${FORN_PAG_LABEL[f.modalidade]||''}</span>
      </div>`).join('');
  }
  dd.classList.remove('hidden');
}
function selectFornecedorPlan(id) {
  const f = DB.getFornecedor(id);
  if (!f) return;
  _fornSelecionadoPlan = f;
  document.getElementById('plan-forn-search').value = '';
  document.getElementById('plan-forn-dropdown').classList.add('hidden');
  document.getElementById('plan-forn-nome-disp').textContent = f.nome;
  document.getElementById('plan-forn-meta-disp').textContent = `${FORN_TIPO_LABEL[f.tipo]||''} · ${FORN_PAG_LABEL[f.modalidade]||''}`;
  document.getElementById('plan-forn-selected').classList.remove('hidden');
  document.getElementById('plan-forn-novo-wrap')?.classList.add('hidden');
  document.getElementById('btn-toggle-plan-forn').textContent = '+ Adicionar Novo Fornecedor';
}
function clearFornecedorPlan() {
  _fornSelecionadoPlan = null;
  document.getElementById('plan-forn-search').value = '';
  document.getElementById('plan-forn-selected').classList.add('hidden');
}
function toggleFornecedorPlan() {
  const wrap = document.getElementById('plan-forn-novo-wrap');
  const btn  = document.getElementById('btn-toggle-plan-forn');
  if (!wrap) return;
  const showing = !wrap.classList.contains('hidden');
  wrap.classList.toggle('hidden', showing);
  btn.textContent = showing ? '+ Adicionar Novo Fornecedor' : '− Cancelar';
}
function _saveFornecedorPlanInline() {
  if (_fornSelecionadoPlan) return _fornSelecionadoPlan;
  const nome = document.getElementById('plan-forn-nome')?.value.trim();
  if (!nome) return null;
  const guardar = document.getElementById('plan-forn-guardar')?.checked;
  const f = {
    id: DB.uid(), companyId: currentCompany.id, nome,
    nuit:      document.getElementById('plan-forn-nuit')?.value.trim() || '',
    contacto:  document.getElementById('plan-forn-contacto')?.value.trim() || '',
    tipo:      document.getElementById('plan-forn-tipo')?.value || 'outro',
    modalidade:'pronto', criadoEm: new Date().toISOString(),
  };
  if (guardar) DB.saveFornecedor(f);
  return f;
}

// ── GPS — capturar apenas coordenadas ──
function captureGPSCoords(fieldId) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  if (!navigator.geolocation) {
    showToast('GPS não disponível neste dispositivo', 'error'); return;
  }
  showToast('A capturar localização...', 'info');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lon = pos.coords.longitude.toFixed(6);
      input.value = `${lat}, ${lon}`;
      input.removeAttribute('readonly');
      showToast(`📍 Localização capturada: ${lat}, ${lon}`, 'success');
    },
    err => {
      showToast('Não foi possível capturar localização. Insira manualmente.', 'error');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ── Número de documento automático ──
function _gerarNumDoc(tipo) {
  const prefix = tipo === 'fatura' ? 'FAT' : tipo === 'recibo' ? 'REC' : 'FR';
  const year   = new Date().getFullYear();
  const seq    = String(Math.floor(Math.random()*9000)+1000);
  return `${prefix}-${year}-${seq}`;
}

// ── Auto-gerar nº documento ao mudar tipo ──
document.addEventListener('DOMContentLoaded', () => {
  const docTipo = document.getElementById('campo-doc-tipo');
  if (docTipo) {
    docTipo.addEventListener('change', () => {
      const numEl = document.getElementById('campo-doc-num');
      if (numEl && !numEl.value) numEl.value = _gerarNumDoc(docTipo.value);
    });
    // gerar na carga inicial
    setTimeout(() => {
      const numEl = document.getElementById('campo-doc-num');
      if (numEl && !numEl.value) numEl.value = _gerarNumDoc(docTipo.value);
    }, 500);
  }
});

// ══════════════════════════════════════════════
// ── ADIANTAMENTOS (removido) ──
function renderAdiantamentos() { /* funcionalidade removida */ }
function openNewAdvanceModal()  { /* removido */ }
function saveAdvance()          { /* removido */ }
function openAdvanceDetail()    { /* removido */ }
function approveAdvance()       { /* removido */ }
function rejectAdvance()        { /* removido */ }
function disburseAdvance()      { /* removido */ }
// ── FRAUD PAGE ──
function renderFraudePage() {
  if (!currentCompany) return;
  const container = document.getElementById('fraud-page-content');
  if (!container) return;
  if (typeof FraudDetector === 'undefined') {
    container.innerHTML = '<p class="empty-state">Módulo de detecção de fraude não disponível.</p>'; return;
  }

  const allExp = DB.getExpenses();
  const analysis = FraudDetector.analyseCompany(currentCompany.id, allExp);

  // Summary stats
  const summary = analysis.summary;
  const currency = currentCompany.currency || 'MZN';
  document.getElementById('fraud-stat-total')?.setAttribute('data-val', analysis.total);
  document.getElementById('fraud-stat-flagged')?.setAttribute('data-val', analysis.flagged);
  document.getElementById('fraud-stat-high')?.setAttribute('data-val', analysis.highRisk);

  const statsEl = document.getElementById('fraud-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-value">${analysis.total}</div><div class="stat-label">Total Analisadas</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#F59E0B">${analysis.flagged}</div><div class="stat-label">Com Alertas</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#DC2626">${analysis.highRisk}</div><div class="stat-label">Risco Alto</div></div>
      <div class="stat-card"><div class="stat-value">${fmtCurrency(summary.atRiskAmount, currency)}</div><div class="stat-label">Em Risco</div></div>`;
  }

  if (analysis.results.length === 0) {
    container.innerHTML = '<p class="empty-state">✅ Nenhuma anomalia detectada.</p>'; return;
  }

  container.innerHTML = analysis.results.map(r => {
    const exp = DB.getExpense(r.expenseId);
    if (!exp) return '';
    const riskCls = r.riskLevel.level >= 2 ? 'high' : r.riskLevel.level === 1 ? 'medium' : 'low';
    return `<div class="fraud-item fraud-${riskCls}" onclick="openExpenseDetail('${exp.id}')">
      <div class="fraud-item-header">
        <div>
          <div class="fraud-item-title">${expenseName(exp)}</div>
          <div class="fraud-item-meta">${fmtDate(exp.data)} · ${fmtCurrency(exp.valor||0, exp.moeda||currency)}</div>
        </div>
        <span class="fraud-risk-badge fraud-${riskCls}">${r.riskLevel.icon} ${r.riskLevel.label}</span>
      </div>
      <div class="fraud-alerts">
        ${r.alerts.map(a => `<div class="fraud-alert-chip">${a.risk.icon} ${ruleLabel(a.rule)}: <span>${a.message}</span></div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

// ── NOTIFICATIONS PAGE ──
function renderNotificacoes() {
  if (!currentUser) return;
  DB.markAllNotifsRead(currentUser.id);
  updateBadges();

  const notifs = DB.getNotifsByUser(currentUser.id);
  const container = document.getElementById('notif-list');
  if (!container) return;
  if (notifs.length === 0) {
    container.innerHTML = '<p class="empty-state">Sem notificações.</p>'; return;
  }
  const typeIcon = { success:'✅', error:'❌', pending:'⏳', info:'ℹ️' };
  container.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? 'read' : 'unread'}">
      <div class="notif-icon">${typeIcon[n.type]||'🔔'}</div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.body}</div>
        <div class="notif-time">${n.createdAt ? fmtDate(n.createdAt.slice(0,10)) : '—'}</div>
      </div>
    </div>`).join('');
}

// ── CONFIG PAGE ──
function renderConfig() {
  if (!currentCompany || !currentUser) return;
  if (currentUser.role !== 'admin' && currentUser.role !== 'gestor') {
    const _cc = document.getElementById('config-content');
    if (_cc) _cc.innerHTML = '<p class="empty-state">Acesso restrito a administradores.</p>';
    return;
  }

  const cfg = (typeof Scheduler !== 'undefined') ? Scheduler.getConfig(currentCompany.id) : null;

  // Schedule config
  const schedWeekday = document.getElementById('sched-weekday');
  const schedEnabled = document.getElementById('sched-enabled');
  if (cfg && schedWeekday) schedWeekday.value = cfg.weeklyDay ?? 1;
  if (cfg && schedEnabled) schedEnabled.checked = cfg.enabled !== false;

  // Recipients
  _renderRecipients(cfg?.recipients || []);

  // Approval chain
  _renderApprovalChain();
}

function _renderRecipients(list) {
  const container = document.getElementById('recipients-list');
  if (!container) return;
  container.innerHTML = list.map((r, i) => `
    <div class="recipient-item">
      <span>📧 ${r}</span>
      <button class="btn-icon" onclick="removeRecipient(${i})">✕</button>
    </div>`).join('');
}

function addRecipient() {
  const input = document.getElementById('new-recipient-email');
  const email = input?.value.trim();
  if (!email || !email.includes('@')) { showToast('Email inválido', 'error'); return; }
  if (typeof Scheduler === 'undefined') return;
  const cfg = Scheduler.getConfig(currentCompany.id) || {};
  const recipients = cfg.recipients || [];
  if (recipients.includes(email)) { showToast('Email já adicionado', 'error'); return; }
  recipients.push(email);
  Scheduler.saveConfig(currentCompany.id, { ...cfg, recipients });
  if (input) input.value = '';
  _renderRecipients(recipients);
  showToast('Destinatário adicionado ✓', 'success');
}

function removeRecipient(idx) {
  if (typeof Scheduler === 'undefined') return;
  const cfg = Scheduler.getConfig(currentCompany.id) || {};
  const recipients = (cfg.recipients || []).filter((_, i) => i !== idx);
  Scheduler.saveConfig(currentCompany.id, { ...cfg, recipients });
  _renderRecipients(recipients);
}

function saveScheduleConfig() {
  if (typeof Scheduler === 'undefined') { showToast('Módulo de agendamento indisponível', 'error'); return; }
  const weeklyDay = parseInt(document.getElementById('sched-weekday')?.value) || 1;
  const enabled   = document.getElementById('sched-enabled')?.checked !== false;
  const cfg = Scheduler.getConfig(currentCompany.id) || {};
  Scheduler.saveConfig(currentCompany.id, { ...cfg, weeklyDay, enabled });
  showToast('Configurações salvas ✓', 'success');
}

function _renderApprovalChain() {
  const container = document.getElementById('chain-list');
  if (!container) return;
  const chain = currentCompany.approvalChain || [];
  container.innerHTML = chain.map((c, i) => `
    <div class="chain-level">
      <span class="chain-level-num">Nível ${c.level}</span>
      <input class="input" value="${c.label}" oninput="updateChainLevel(${i},'label',this.value)" placeholder="Rótulo"/>
      <select class="input" onchange="updateChainLevel(${i},'roleRequired',this.value)">
        <option value="gestor" ${c.roleRequired==='gestor'?'selected':''}>Gestor</option>
        <option value="director" ${c.roleRequired==='director'?'selected':''}>Director</option>
        <option value="financeiro" ${c.roleRequired==='financeiro'?'selected':''}>Financeiro</option>
        <option value="admin" ${c.roleRequired==='admin'?'selected':''}>Admin</option>
      </select>
      <button class="btn-icon btn-danger-icon" onclick="removeChainLevel(${i})">🗑</button>
    </div>`).join('');
}

function updateChainLevel(idx, field, value) {
  const chain = currentCompany.approvalChain || [];
  if (chain[idx]) chain[idx][field] = value;
  currentCompany.approvalChain = chain;
  DB.saveCompany(currentCompany);
}
function addChainLevel() {
  const chain = currentCompany.approvalChain || [];
  const nextLevel = (chain[chain.length - 1]?.level || 0) + 1;
  chain.push({ level: nextLevel, label: `Nível ${nextLevel}`, roleRequired: 'gestor' });
  currentCompany.approvalChain = chain;
  DB.saveCompany(currentCompany);
  _renderApprovalChain();
}
function removeChainLevel(idx) {
  const chain = (currentCompany.approvalChain || []).filter((_, i) => i !== idx);
  // Re-number
  chain.forEach((c, i) => c.level = i + 1);
  currentCompany.approvalChain = chain;
  DB.saveCompany(currentCompany);
  _renderApprovalChain();
}

// ── UTILIZADORES ──
function renderUtilizadores() {
  if (!currentCompany) return;
  const users = DB.getUsersByCompany(currentCompany.id);
  const container = document.getElementById('user-list-container');
  if (!container) return;
  if (users.length === 0) { container.innerHTML = '<p class="empty-state">Nenhum utilizador.</p>'; return; }
  container.innerHTML = users.map(u => `
    <div class="user-item">
      <div class="user-item-avatar">${u.name.charAt(0).toUpperCase()}</div>
      <div class="user-item-info">
        <div class="user-item-name">${u.name}</div>
        <div class="user-item-meta">${u.email}</div>
      </div>
      <span class="role-badge ${u.role}">${roleLabel(u.role)}</span>
    </div>`).join('');
}
function openUserModal() { openModal('modal-user'); }
function createUser() {
  const name  = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const pass  = document.getElementById('new-user-pass').value;
  const role  = document.getElementById('new-user-role').value;
  if (!name || !email || !pass) { showToast('Preencha todos os campos', 'error'); return; }
  if (pass.length < 6) { showToast('Palavra-passe: mínimo 6 caracteres', 'error'); return; }
  if (DB.findUserByEmail(email)) { showToast('Email já registado', 'error'); return; }
  DB.saveUser({ id: DB.uid(), companyId: currentCompany.id, name, email, password: pass, role });
  closeModal('modal-user');
  showToast(`Utilizador ${name} criado! 👤`, 'success');
  renderUtilizadores();
  ['new-user-name','new-user-email','new-user-pass'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

// ── PERFIL ──
function renderPerfil() {
  if (!currentUser) return;
  document.getElementById('perfil-avatar').textContent  = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('perfil-nome').value    = currentUser.name;
  document.getElementById('perfil-email').value   = currentUser.email;
  document.getElementById('perfil-role').value    = roleLabel(currentUser.role);
  document.getElementById('perfil-empresa').value = currentCompany?.name || '—';
  document.getElementById('perfil-pass').value    = '';
}
function savePerfil() {
  const nome = document.getElementById('perfil-nome').value.trim();
  const pass = document.getElementById('perfil-pass').value;
  if (!nome) { showToast('O nome não pode ser vazio', 'error'); return; }
  if (pass && pass.length < 6) { showToast('Palavra-passe: mínimo 6 caracteres', 'error'); return; }
  currentUser.name = nome;
  if (pass) currentUser.password = pass;
  DB.saveUser(currentUser);
  document.getElementById('user-avatar').textContent = nome.charAt(0).toUpperCase();
  showToast('Perfil atualizado! ✓', 'success');
}

// ── GPS UI HOOK ──
function openGPSForField(targetField) {
  if (typeof startGPSTracking !== 'undefined') startGPSTracking(targetField);
  else showToast('GPS não disponível', 'error');
}

// ── TOPBAR SEARCH ──
function handleTopbarSearch(q) {
  q = q.trim().toLowerCase();
  if (!q) return;
  // Navigate to expenses page and filter by query
  showPage('page-despesas');
  setTimeout(() => {
    const filterEl = document.getElementById('filter-search');
    if (filterEl) { filterEl.value = q; renderExpenseList(); }
  }, 100);
}

// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
