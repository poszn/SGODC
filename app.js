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
    case 'page-despesas':      despesasTab = 'mine'; document.getElementById('tab-desp-mine')?.classList.add('active'); document.getElementById('tab-desp-empresa')?.classList.remove('active'); renderExpenseList(); break;
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
// Mostra APENAS o formulário escolhido, esconde o selector de tabs
function showCampoForm(tipo) {
  // Navegar para page-campo sem fechar modais (showPage já fecha)
  closeAllModals();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item, .bnav-btn').forEach(n => n.classList.remove('active'));
  document.getElementById('page-campo')?.classList.add('active');
  if (window.innerWidth < 768) closeSidebar();
  document.getElementById('user-menu')?.classList.add('hidden');

  // Ocultar selector de tabs — mostrar só o form escolhido
  const opts = document.querySelector('.campo-opts');
  if (opts) opts.style.display = 'none';

  const pedido = document.getElementById('form-campo-pedido');
  const relat  = document.getElementById('form-campo-relatorio');
  const header = document.querySelector('#page-campo .page-sub');

  if (tipo === 'pedido') {
    if (pedido) pedido.classList.remove('hidden');
    if (relat)  relat.classList.add('hidden');
    if (header) header.textContent = 'Pedido de Aprovação — preencha e envie para autorização';
  } else {
    if (pedido) pedido.classList.add('hidden');
    if (relat)  relat.classList.remove('hidden');
    if (header) header.textContent = 'Envio de Despesas — registe despesas após a missão';
  }
}

// Quando se vai directamente para page-campo (via Início), restaura o selector
function showCampoPage() {
  showPage('page-campo');
  const opts = document.querySelector('.campo-opts');
  if (opts) opts.style.display = '';
  document.getElementById('form-campo-pedido')?.classList.remove('hidden');
  document.getElementById('form-campo-relatorio')?.classList.add('hidden');
  const header = document.querySelector('#page-campo .page-sub');
  if (header) header.textContent = 'Escolha o tipo de formulário';
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
let _sidebarCollapsed = false;
function collapseSidebar() {
  const sb   = document.getElementById('sidebar');
  const main = document.querySelector('.main-content');
  const btn  = document.getElementById('sidebar-collapse-btn');
  _sidebarCollapsed = !_sidebarCollapsed;
  if (_sidebarCollapsed) {
    sb?.classList.add('sidebar-collapsed');
    if (main) main.style.marginLeft = '0';
    if (btn) btn.textContent = '▶';
  } else {
    sb?.classList.remove('sidebar-collapsed');
    if (main) main.style.marginLeft = '';
    if (btn) btn.textContent = '◀';
  }
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
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}
function closeAllModals() {
  // Fecha TODOS os modais de qualquer sistema (modal-overlay, modal)
  document.querySelectorAll('.modal-overlay, .modal').forEach(m => {
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
function getTeamExpenses(supervisorId) {
  // Retorna despesas do supervisor + todos os seus membros de equipa
  const teamIds = DB.getUsersByCompany(currentCompany.id)
    .filter(u => u.supervisorId === supervisorId)
    .map(u => u.id);
  teamIds.push(supervisorId);
  return DB.getExpensesByCompany(currentCompany.id).filter(e => teamIds.includes(e.userId));
}

function isSupervisorRole(role) {
  return role === 'supervisor' || role === 'coordenador';
}

function getMyExpenses() {
  if (!currentUser || !currentCompany) return [];
  if (currentUser.role === 'funcionario') return DB.getExpensesByUser(currentUser.id);
  if (isSupervisorRole(currentUser.role)) return getTeamExpenses(currentUser.id);
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

// ── DASHBOARD VIEW (pessoal / empresa) ──
let dashView = 'mine'; // 'mine' | 'empresa'

function switchDashView(view) {
  dashView = view;
  // Actualizar botões
  document.getElementById('dash-tab-mine')?.classList.toggle('active', view === 'mine');
  document.getElementById('dash-tab-empresa')?.classList.toggle('active', view === 'empresa');
  // Mostrar/esconder secções
  const sectionMine    = document.getElementById('dash-section-mine');
  const sectionEmpresa = document.getElementById('dash-section-empresa');
  if (sectionMine)    sectionMine.classList.toggle('hidden', view !== 'mine');
  if (sectionEmpresa) sectionEmpresa.classList.toggle('hidden', view !== 'empresa');
}

// Navegação a partir dos cards do dashboard
function goToDespesasMine() {
  despesasTab = 'mine';
  showPage('page-despesas');
}
function goToDespesasMineFiltered(status) {
  despesasTab = 'mine';
  showPage('page-despesas');
  setTimeout(() => {
    const el = document.getElementById('filter-status');
    if (el) { el.value = status; renderExpenseList(); }
  }, 100);
}
function goToDespesasEmpresa() {
  despesasTab = 'empresa';
  showPage('page-despesas');
  setTimeout(() => { switchDespesasTab('empresa'); }, 50);
}
function goToDespesasEmpresaFiltered(status) {
  despesasTab = 'empresa';
  showPage('page-despesas');
  setTimeout(() => {
    switchDespesasTab('empresa');
    const el = document.getElementById('filter-status');
    if (el) { el.value = status; renderExpenseList(); }
  }, 100);
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

  // ── EMPRESA (apenas gestores/admin/supervisores) ──
  if (!isFunc) {
    const isSup = isSupervisorRole(currentUser.role);
    const baseExp = isSup ? getTeamExpenses(currentUser.id) : DB.getExpensesByCompany(currentCompany.id);
    const allPeriod = filterByPeriod(baseExp, dashPeriod);
    const empTotal    = allPeriod.filter(e => e.status !== 'rejected' && e.status !== 'draft').reduce((s,e) => s+(e.valor||0), 0);
    const empApproved = allPeriod.filter(e => e.status === 'approved').length;
    const empPending  = allPeriod.filter(e => e.status === 'pending').length;
    const allUsers    = baseExp;
    const empUsers    = new Set(allUsers.map(e => e.userId)).size;
    setEl('stat-emp-total',    fmtCurrency(empTotal, currency));
    setEl('stat-emp-approved', empApproved);
    setEl('stat-emp-pending',  empPending);
    setEl('stat-emp-users',    empUsers);
    // Adaptar rótulos conforme o papel
    if (isSup) {
      const empTotalLbl = document.querySelector('#stats-empresa .stat-card.purple .stat-label');
      if (empTotalLbl) empTotalLbl.textContent = 'Total da Minha Equipa';
      const empBtn = document.querySelector('#dash-section-empresa .btn-ghost');
      if (empBtn) empBtn.textContent = 'Ver despesas da minha equipa →';
      const empTab = document.getElementById('dash-tab-empresa');
      const dvtLbl = empTab?.querySelector('.dvt-label');
      if (dvtLbl) dvtLbl.textContent = 'Visão da Equipa';
    } else {
      const empTotalLbl = document.querySelector('#stats-empresa .stat-card.purple .stat-label');
      if (empTotalLbl) empTotalLbl.textContent = 'Total Empresa';
      const empBtn = document.querySelector('#dash-section-empresa .btn-ghost');
      if (empBtn) empBtn.textContent = 'Ver todas as despesas da empresa →';
      const empTab = document.getElementById('dash-tab-empresa');
      const dvtLbl = empTab?.querySelector('.dvt-label');
      if (dvtLbl) dvtLbl.textContent = 'Visão da Empresa';
    }
    // Mostrar tabs e aplicar vista activa
    document.getElementById('dash-view-tabs')?.classList.remove('hidden');
    switchDashView(dashView);
  } else {
    // Funcionários: só secção pessoal, sem tabs
    document.getElementById('dash-section-mine')?.classList.remove('hidden');
    document.getElementById('dash-section-empresa')?.classList.add('hidden');
    document.getElementById('dash-view-tabs')?.classList.add('hidden');
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

// ── TABS DE DESPESAS (admin/gestor) ──
let despesasTab = 'mine'; // 'mine' | 'empresa'

function switchDespesasTab(tab) {
  despesasTab = tab;
  ['mine','empresa'].forEach(t => {
    document.getElementById(`tab-desp-${t}`)?.classList.toggle('active', t === tab);
  });
  // resetar filtro de utilizador ao mudar de tab
  const userSel = document.getElementById('filter-user');
  if (userSel) userSel.value = '';
  renderExpenseList();
}

// ── EXPENSE LIST ──
function renderExpenseList() {
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const typeFilter   = document.getElementById('filter-type')?.value   || '';
  const userFilter   = document.getElementById('filter-user')?.value   || '';
  const search       = (document.getElementById('filter-search')?.value || '').toLowerCase();
  const isFunc       = currentUser.role === 'funcionario';

  // Para gestores/admin, respeitar a tab activa
  const showingMine = isFunc || despesasTab === 'mine';
  const showingEmpresa = !isFunc && despesasTab === 'empresa';

  // Título dinâmico
  const titleEl = document.getElementById('despesas-page-title');
  if (titleEl) {
    if (showingMine) titleEl.textContent = '📁 As minhas despesas';
    else if (isSupervisorRole(currentUser.role)) titleEl.textContent = '📁 Despesas da Minha Equipa';
    else             titleEl.textContent = '📁 Todas as Despesas da Empresa';
  }

  // Dropdown de utilizadores (só na tab empresa)
  const userSel = document.getElementById('filter-user');
  const userSelWrap = userSel?.parentElement || userSel;
  if (userSel) {
    if (showingEmpresa) {
      userSel.classList.remove('hidden');
      const currentVal = userSel.value;
      // Supervisores vêem apenas a sua equipa no dropdown
      const allUsers = DB.getUsersByCompany(currentCompany.id).sort((a,b) => a.name.localeCompare(b.name));
      const visibleUsers = isSupervisorRole(currentUser.role)
        ? allUsers.filter(u => u.supervisorId === currentUser.id || u.id === currentUser.id)
        : allUsers;
      const teamLabel = isSupervisorRole(currentUser.role) ? 'Toda a Minha Equipa' : 'Todos os Funcionários';
      userSel.innerHTML = `<option value="">${teamLabel}</option>` +
        visibleUsers.map(u => `<option value="${u.id}" ${u.id===currentVal?'selected':''}>${u.name}</option>`).join('');
    } else {
      userSel.classList.add('hidden');
      userSel.value = '';
    }
  }

  // Escolher conjunto de despesas
  let list = showingMine
    ? DB.getExpensesByUser(currentUser.id)
    : isSupervisorRole(currentUser.role)
      ? getTeamExpenses(currentUser.id)
      : DB.getExpensesByCompany(currentCompany.id);

  if (statusFilter) list = list.filter(e => e.status === statusFilter);
  if (typeFilter)   list = list.filter(e => e.type === typeFilter || e.type === typeFilter + '-pedido');
  if (showingEmpresa && userFilter) list = list.filter(e => e.userId === userFilter);
  if (search)       list = list.filter(e =>
    expenseName(e).toLowerCase().includes(search) ||
    (e.local||'').toLowerCase().includes(search) ||
    (e.projeto||'').toLowerCase().includes(search) ||
    (DB.getUser(e.userId)?.name || '').toLowerCase().includes(search)
  );
  list.sort((a,b) => (b.submittedAt||b.data||'').localeCompare(a.submittedAt||a.data||''));

  const container = document.getElementById('expense-list-container');
  container.innerHTML = list.length === 0
    ? '<p class="empty-state">Nenhuma despesa encontrada.</p>'
    : `<div class="expense-list">${list.map(e => expenseItemHTML(e, showingEmpresa)).join('')}</div>`;
}

// ── EXPENSE DETAIL MODAL ──
function openExpenseDetail(id) {
  _currentExpId = id; // track for PDF/history buttons
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
    if (exp.km)  html += `<div class="detail-item"><div class="detail-label">GPS</div><div class="detail-value">📍 ${exp.km}</div></div>`;
    if (exp.gps && !exp.km) html += `<div class="detail-item"><div class="detail-label">GPS</div><div class="detail-value">📍 ${exp.gps}</div></div>`;
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
    _addHistory(exp, exp.status, comment);
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
    _addHistory(exp, 'rejected', comment);
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
    _addHistory(exp, 'approved', `Nível ${pendingLevel.level} (${pendingLevel.label}): ${comment}`);
    notifyNextApprover(exp, nextLevel.level);
  } else {
    // All levels done
    exp.status = 'approved';
    _addHistory(exp, 'approved', comment);
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
  _addHistory(exp, 'sent_draft', 'Rascunho enviado para aprovação');
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
  _addHistory(exp, status === 'pending' ? 'submitted' : 'draft_saved',
    status === 'pending' ? 'Despesa enviada para aprovação' : 'Rascunho guardado');
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
  const isFunc = currentUser.role === 'funcionario';
  // Funcionário vê só os seus planos; gestores vêem todos
  const allPlans = DB.getPlansByCompany(currentCompany.id);
  let plans = isFunc
    ? allPlans.filter(p => p.createdBy === currentUser.id)
    : allPlans;

  // Aplicar filtros (managers)
  if (!isFunc) {
    const fStatus = document.getElementById('plan-filter-status')?.value || '';
    const fTipo   = document.getElementById('plan-filter-tipo')?.value   || '';
    const fSearch = (document.getElementById('plan-filter-search')?.value || '').toLowerCase();
    if (fStatus) plans = plans.filter(p => p.status === fStatus);
    if (fTipo)   plans = plans.filter(p => p.tipo   === fTipo);
    if (fSearch) plans = plans.filter(p =>
      (p.desc||'').toLowerCase().includes(fSearch) ||
      (p.local||'').toLowerCase().includes(fSearch) ||
      (p.projeto||'').toLowerCase().includes(fSearch) ||
      (DB.getUser(p.createdBy)?.name||'').toLowerCase().includes(fSearch)
    );
  }
  plans = plans.sort((a,b) => (a.inicio||'').localeCompare(b.inicio||''));

  const planIcons = { campo:'🌍', viagem:'✈️', alojamento:'🏨', formacao:'📚', reuniao:'🤝' };
  const statusCls = { upcoming:'upcoming', active:'active', done:'done' };
  const statusTxt = { upcoming:'Agendado', active:'Em curso', done:'Concluído' };

  // ── Tabela desktop ──
  const tbody = document.getElementById('plan-table-body');
  if (tbody) {
    if (plans.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="empty-state">Nenhuma atividade planeada.</td></tr>`;
    } else {
      tbody.innerHTML = plans.map(p => {
        const icon    = planIcons[p.tipo] || '📅';
        const sCls    = statusCls[p.status] || 'upcoming';
        const sTxt    = statusTxt[p.status] || 'Agendado';
        const creator = DB.getUser(p.createdBy);
        const creatorName = creator ? creator.name : '—';
        const forn    = p.fornecedor ? p.fornecedor.nome : '—';
        const dept    = p.dept || '—';
        const deptLabel = { admin:'Administração', financas:'Finanças', operacoes:'Operações', rh:'Recursos Humanos', logistica:'Logística', campo:'Campo' }[dept] || dept;
        return `<tr>
          <td>${fmtDate(p.inicio)}</td>
          <td>${fmtDate(p.fim)}</td>
          <td>${icon} ${p.tipo||'—'}</td>
          <td><strong>${p.desc||'—'}</strong>${p.projeto ? `<br/><small>📌 ${p.projeto}</small>` : ''}</td>
          <td>📍 ${p.local||'—'}</td>
          <td>${isFunc ? '—' : deptLabel}</td>
          <td>${isFunc ? '—' : creatorName}</td>
          <td>👥 ${p.pessoas||1}</td>
          <td><strong>${fmtCurrency(p.total||0, p.moeda||'MZN')}</strong></td>
          <td>${forn}</td>
          <td><span class="plan-status ${sCls}">${sTxt}</span></td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="changePlanStatus('${p.id}','done')" title="Marcar concluído">✅</button>
            <button class="btn btn-sm btn-danger-outline" onclick="deletePlan('${p.id}')" title="Eliminar">🗑️</button>
          </td>
        </tr>`;
      }).join('');
    }
  }

  // ── Cards mobile (fallback) ──
  const container = document.getElementById('plan-list');
  if (container) {
    if (plans.length === 0) {
      container.innerHTML = '<p class="empty-state">Nenhuma atividade planeada.</p>';
    } else {
      container.innerHTML = plans.map(p => {
        const icon  = planIcons[p.tipo] || '📅';
        const sCls  = statusCls[p.status] || 'upcoming';
        const sTxt  = statusTxt[p.status] || 'Agendado';
        return `<div class="plan-item">
          <div class="plan-item-header">
            <div class="plan-item-title">${icon} ${p.desc}</div>
            <span class="plan-status ${sCls}">${sTxt}</span>
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
  }
}

function changePlanStatus(id, newStatus) {
  const plans = DB.getPlans();
  const p = plans.find(x => x.id === id);
  if (!p) return;
  p.status = newStatus;
  DB.savePlan(p);
  renderPlaneamento();
  showToast(newStatus === 'done' ? 'Atividade marcada como concluída ✅' : 'Estado atualizado', 'success');
}

function deletePlan(id) {
  if (!confirm('Eliminar esta atividade planeada?')) return;
  const plans = DB.getPlans().filter(p => p.id !== id);
  DB._set(DB.KEYS.PLANS, plans);
  renderPlaneamento();
  showToast('Atividade eliminada', 'info');
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
    const periodos = { day:0, week:1, month:2, '3months':3, '6months':4, year:5, all:6 };
    const btns = document.querySelectorAll('#page-relatorios .period-btn');
    if (btns[periodos[period]] !== undefined) btns[periodos[period]].classList.add('active');
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

function clearRepFilters() {
  ['rep-filter-dept','rep-filter-user','rep-filter-tipo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderRelatorios();
}

function renderRelatorios() {
  if (!currentCompany) return;
  const currency = currentCompany.currency || 'MZN';
  const isFunc   = currentUser.role === 'funcionario';

  // Mostrar barra de filtros para gestores/admins
  const filtersBar = document.getElementById('rep-filters-bar');
  if (filtersBar) {
    if (!isFunc) {
      filtersBar.classList.remove('hidden');
      filtersBar.style.display = 'flex';
      // Popular dropdown de utilizadores da empresa
      const userSel = document.getElementById('rep-filter-user');
      if (userSel) {
        const currentVal = userSel.value;
        const users = DB.getUsersByCompany(currentCompany.id)
          .filter(u => u.id !== currentUser.id || !isFunc)
          .sort((a,b) => a.name.localeCompare(b.name));
        userSel.innerHTML = '<option value="">Todos os Funcionários</option>' +
          users.map(u => `<option value="${u.id}" ${u.id===currentVal?'selected':''}>${u.name}</option>`).join('');
      }
    } else {
      filtersBar.classList.add('hidden');
      filtersBar.style.display = 'none';
    }
  }

  // Funcionário vê só as suas; gestores vêem todas
  let all = isFunc
    ? DB.getExpensesByUser(currentUser.id)
    : DB.getExpensesByCompany(currentCompany.id);
  all = all.filter(e => e.status !== 'draft');
  let list = filterByPeriod(all, reportPeriod);

  // Aplicar filtros adicionais (managers)
  if (!isFunc) {
    const fDept = document.getElementById('rep-filter-dept')?.value || '';
    const fUser = document.getElementById('rep-filter-user')?.value || '';
    const fTipo = document.getElementById('rep-filter-tipo')?.value || '';
    if (fDept) list = list.filter(e => e.dept === fDept);
    if (fUser) list = list.filter(e => e.userId === fUser);
    if (fTipo) list = list.filter(e => e.expenseType === fTipo);
  }

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
  const countEl = document.getElementById('rep-table-count');
  if (!tbody) return;
  if (countEl) countEl.textContent = list.length;
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Sem dados para ${periodLabel(reportPeriod)}.</td></tr>`;
    return;
  }
  const sorted = [...list].sort((a,b) => (b.data||'').localeCompare(a.data||''));
  tbody.innerHTML = sorted.map(e => {
    const user = DB.getUser(e.userId);
    const userName = user ? user.name : '—';
    const dept = e.dept || '—';
    const deptLabel = { admin:'Administração', financas:'Finanças', operacoes:'Operações', rh:'Recursos Humanos', logistica:'Logística', campo:'Campo' }[dept] || dept;
    return `<tr class="table-row-clickable" onclick="openExpenseDetail('${e.id}')">
      <td>${fmtDate(e.data)}</td>
      <td>${isFunc ? '—' : userName}</td>
      <td>${isFunc ? '—' : deptLabel}</td>
      <td>${expenseName(e)}</td>
      <td>${typeLabel(e.expenseType||e.type)}</td>
      <td><strong>${fmtCurrency(e.valor||0, e.moeda||currency)}</strong></td>
      <td><span class="status-badge ${e.status}">${statusLabel(e.status)}</span></td>
      <td><button class="btn btn-sm btn-outline" onclick="event.stopPropagation();printExpense('${e.id}')">🖨️</button></td>
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

function printExpense(id) {
  const e = DB.getExpense(id);
  if (!e) return;
  const user = DB.getUser(e.userId);
  const currency = currentCompany?.currency || 'MZN';
  const win = window.open('', '_blank', 'width=700,height=900');
  win.document.write(`
    <!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>Despesa – ${expenseName(e)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; font-size: 14px; color: #222; }
      h2 { color: #1E3A5F; margin-bottom: 4px; }
      .sub { color: #888; font-size: 12px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #1E3A5F; color: #fff; padding: 8px 12px; text-align: left; font-size: 12px; }
      td { padding: 8px 12px; border-bottom: 1px solid #eee; }
      tr:nth-child(even) td { background: #f9f9f9; }
      .status { font-weight: bold; }
      .footer { margin-top: 30px; font-size: 11px; color: #aaa; text-align: center; }
    </style></head><body>
    <h2>${expenseName(e)}</h2>
    <div class="sub">Despesa ID: ${e.id} &nbsp;·&nbsp; ${currentCompany?.name || ''}</div>
    <table>
      <tr><th>Campo</th><th>Valor</th></tr>
      <tr><td>Data</td><td>${fmtDate(e.data)}</td></tr>
      <tr><td>Funcionário</td><td>${user ? user.name : '—'}</td></tr>
      <tr><td>Departamento</td><td>${e.dept || '—'}</td></tr>
      <tr><td>Tipo</td><td>${e.type === 'procurement' ? 'Procurement' : 'Campo'}</td></tr>
      <tr><td>Categoria</td><td>${typeLabel(e.expenseType || e.type)}</td></tr>
      <tr><td>Valor</td><td><strong>${fmtCurrency(e.valor || 0, e.moeda || currency)}</strong></td></tr>
      <tr><td>Local</td><td>${e.local || '—'}</td></tr>
      <tr><td>Projeto</td><td>${e.projeto || '—'}</td></tr>
      <tr><td>Pagamento</td><td>${payMethodLabel(e.paymentMethod)}</td></tr>
      <tr><td>Estado</td><td class="status">${statusLabel(e.status)}</td></tr>
      ${e.comentario ? `<tr><td>Comentário</td><td>${e.comentario}</td></tr>` : ''}
    </table>
    <div class="footer">Impresso em ${new Date().toLocaleString('pt-PT')} &nbsp;·&nbsp; SGDC Sistema de Gestão de Despesas de Campo</div>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>
  `);
  win.document.close();
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

  // Teams per supervisor
  _renderConfigTeams();
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

// ── EQUIPAS POR SUPERVISOR (Configurações) ──
function _renderConfigTeams() {
  const container = document.getElementById('config-teams-list');
  if (!container) return;
  const users = DB.getUsersByCompany(currentCompany.id);
  const supervisorRoles = ['supervisor','coordenador','gestor','director','financeiro','admin'];
  const supervisors = users.filter(u => supervisorRoles.includes(u.role)).sort((a,b) => a.name.localeCompare(b.name));

  if (supervisors.length === 0) {
    container.innerHTML = '<p class="empty-state">Não há supervisores registados.</p>';
    return;
  }

  container.innerHTML = supervisors.map(sup => {
    const equipa = users.filter(u => u.supervisorId === sup.id).sort((a,b) => a.name.localeCompare(b.name));
    const disponiveis = users.filter(u => u.id !== sup.id && u.supervisorId !== sup.id && !supervisorRoles.includes(u.role)).sort((a,b) => a.name.localeCompare(b.name));

    return `
    <div style="border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px;background:var(--bg-card)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar" style="width:36px;height:36px;font-size:14px">${sup.name.charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-weight:600;font-size:14px">${sup.name}</div>
            <div style="font-size:12px;color:var(--text-secondary)">${roleLabel(sup.role)}</div>
          </div>
        </div>
        <span style="font-size:12px;color:var(--text-secondary);background:var(--bg-secondary);padding:3px 10px;border-radius:20px">${equipa.length} membro${equipa.length!==1?'s':''}</span>
      </div>
      <div id="team-members-${sup.id}" style="margin-bottom:12px">
        ${equipa.length === 0
          ? '<p style="font-size:13px;color:var(--text-secondary);font-style:italic;padding:8px 0">Sem membros atribuídos a este supervisor</p>'
          : equipa.map(m => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-secondary);border-radius:6px;margin-bottom:6px">
              <div style="display:flex;align-items:center;gap:8px">
                <div class="avatar" style="width:28px;height:28px;font-size:11px">${m.name.charAt(0).toUpperCase()}</div>
                <div>
                  <span style="font-weight:500;font-size:13px">${m.name}</span>
                  <span style="font-size:11px;color:var(--text-secondary);margin-left:6px">${roleLabel(m.role)}</span>
                </div>
              </div>
              <button class="btn-icon btn-danger-icon" onclick="removeFromTeam('${m.id}','${sup.id}')" title="Remover da equipa" style="font-size:12px">✕</button>
            </div>`).join('')
        }
      </div>
      ${disponiveis.length > 0 ? `
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
        <select id="add-member-${sup.id}" class="input" style="flex:1;font-size:13px">
          <option value="">— Seleccionar membro para adicionar —</option>
          ${disponiveis.map(u => `<option value="${u.id}">${u.name} (${roleLabel(u.role)})</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" onclick="addToTeam('${sup.id}')">+ Adicionar</button>
      </div>` : `<p style="font-size:12px;color:var(--text-secondary);font-style:italic">Todos os membros disponíveis já foram atribuídos</p>`}
    </div>`;
  }).join('');
}

function addToTeam(supId) {
  const sel = document.getElementById(`add-member-${supId}`);
  const userId = sel?.value;
  if (!userId) { showToast('Seleccione um membro para adicionar', 'error'); return; }
  const user = DB.getUser(userId);
  if (!user) return;
  user.supervisorId = supId;
  DB.saveUser(user);
  showToast(`${user.name} adicionado à equipa ✓`, 'success');
  _renderConfigTeams();
}

function removeFromTeam(userId, supId) {
  const user = DB.getUser(userId);
  if (!user) return;
  user.supervisorId = null;
  DB.saveUser(user);
  showToast(`${user.name} removido da equipa`, 'success');
  _renderConfigTeams();
}

// ── UTILIZADORES ──
let userTab = 'lista'; // 'lista' | 'equipas'

function switchUserTab(tab) {
  userTab = tab;
  ['lista','equipas'].forEach(t => {
    document.getElementById(`tab-user-${t}`)?.classList.toggle('active', t === tab);
  });
  renderUtilizadores();
}

function renderUtilizadores() {
  if (!currentCompany) return;
  const users = DB.getUsersByCompany(currentCompany.id).sort((a,b) => a.name.localeCompare(b.name));
  const container = document.getElementById('user-list-container');
  if (!container) return;
  if (users.length === 0) { container.innerHTML = '<p class="empty-state">Nenhum utilizador.</p>'; return; }

  const userActions = (u) => u.id !== currentUser.id ? `
    <div style="display:flex;gap:6px;margin-left:8px">
      <button class="btn btn-sm btn-outline" onclick="editUser('${u.id}')" title="Editar">✏️</button>
      <button class="btn btn-sm btn-danger-outline" onclick="deleteUser('${u.id}')" title="Remover">🗑️</button>
    </div>` : '<span style="font-size:11px;color:var(--text-secondary);margin-left:8px">(você)</span>';

  if (userTab === 'equipas') {
    // ── Vista de equipas agrupadas por supervisor ──
    const supervisorRoles = ['supervisor','coordenador','gestor','director','financeiro','admin'];
    const supervisors = users.filter(u => supervisorRoles.includes(u.role));
    const membros = users.filter(u => !supervisorRoles.includes(u.role));

    let html = `<div style="margin-bottom:16px;color:var(--text-secondary);font-size:13px">${users.length} utilizador${users.length!==1?'es':''} · ${supervisors.length} supervisor${supervisors.length!==1?'es':''}</div>`;

    supervisors.forEach(sup => {
      const equipa = users.filter(u => u.supervisorId === sup.id);
      html += `
      <div class="team-group">
        <div class="team-supervisor-row">
          <div class="user-item-avatar sup-avatar">${sup.name.charAt(0).toUpperCase()}</div>
          <div class="user-item-info">
            <div class="user-item-name">${sup.name}</div>
            <div class="user-item-meta">${sup.email}</div>
          </div>
          <span class="role-badge ${sup.role}">${roleLabel(sup.role)}</span>
          ${userActions(sup)}
        </div>
        ${equipa.length > 0 ? `
        <div class="team-members">
          ${equipa.map(m => `
          <div class="user-item team-member-item">
            <div style="width:18px;color:var(--text-secondary);font-size:14px">↳</div>
            <div class="user-item-avatar" style="width:32px;height:32px;font-size:13px">${m.name.charAt(0).toUpperCase()}</div>
            <div class="user-item-info">
              <div class="user-item-name">${m.name}</div>
              <div class="user-item-meta">${m.email}</div>
            </div>
            <span class="role-badge ${m.role}">${roleLabel(m.role)}</span>
            ${userActions(m)}
          </div>`).join('')}
        </div>` : '<div class="team-empty">Sem membros atribuídos a este supervisor</div>'}
      </div>`;
    });

    // Mostrar membros sem supervisor
    const semSup = membros.filter(u => !u.supervisorId || !users.find(s => s.id === u.supervisorId));
    if (semSup.length > 0) {
      html += `
      <div class="team-group" style="margin-top:16px">
        <div style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Sem Supervisor</div>
        ${semSup.map(u => `
        <div class="user-item">
          <div class="user-item-avatar">${u.name.charAt(0).toUpperCase()}</div>
          <div class="user-item-info">
            <div class="user-item-name">${u.name}</div>
            <div class="user-item-meta">${u.email}</div>
          </div>
          <span class="role-badge ${u.role}">${roleLabel(u.role)}</span>
          ${userActions(u)}
        </div>`).join('')}
      </div>`;
    }
    container.innerHTML = html;

  } else {
    // ── Vista de lista normal ──
    container.innerHTML = `
      <div style="margin-bottom:12px;color:var(--text-secondary);font-size:13px">${users.length} utilizador${users.length!==1?'es':''} nesta empresa</div>
      ${users.map(u => {
        const supUser = u.supervisorId ? users.find(s => s.id === u.supervisorId) : null;
        return `
        <div class="user-item">
          <div class="user-item-avatar">${u.name.charAt(0).toUpperCase()}</div>
          <div class="user-item-info">
            <div class="user-item-name">${u.name}</div>
            <div class="user-item-meta">${u.email}${supUser ? ` · Supervisor: ${supUser.name}` : ''}</div>
          </div>
          <span class="role-badge ${u.role}">${roleLabel(u.role)}</span>
          ${userActions(u)}
        </div>`;
      }).join('')}`;
  }
}

function _populateSupervisorDropdown(selectedId) {
  const sel = document.getElementById('new-user-supervisor');
  if (!sel || !currentCompany) return;
  const supervisorRoles = ['supervisor','coordenador','gestor','director','financeiro','admin'];
  const supervisors = DB.getUsersByCompany(currentCompany.id)
    .filter(u => supervisorRoles.includes(u.role))
    .sort((a,b) => a.name.localeCompare(b.name));
  sel.innerHTML = '<option value="">— Sem supervisor atribuído —</option>' +
    supervisors.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.name} (${roleLabel(s.role)})</option>`).join('');
}

function onUserRoleChange() {
  const role = document.getElementById('new-user-role')?.value;
  // Para admin/director/gestor/financeiro o campo supervisor é opcional mas visível
  // Apenas escondemos quando não faz sentido (ex: o próprio admin não precisa de supervisor visível)
  const supGroup = document.getElementById('user-supervisor-group');
  if (supGroup) supGroup.classList.toggle('hidden', role === 'admin');
  _populateSupervisorDropdown('');
}

function gerarPasswordUtilizador() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  let pass = '';
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  const el = document.getElementById('new-user-pass');
  if (el) el.value = pass;
  const hint = document.getElementById('new-user-pass-copy');
  if (hint) hint.classList.remove('hidden');
  showToast(`Palavra-passe gerada: ${pass}`, 'info');
}

function openUserModal() {
  ['new-user-name','new-user-email'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('new-user-pass').value = '';
  document.getElementById('new-user-role').value = 'funcionario';
  document.getElementById('new-user-pass-copy')?.classList.add('hidden');
  document.getElementById('modal-user-title') && (document.getElementById('modal-user-title').textContent = '👤 Novo Utilizador');
  // Reset supervisor
  document.getElementById('user-supervisor-group')?.classList.remove('hidden');
  _populateSupervisorDropdown('');
  document.getElementById('modal-user')._editId = null;
  openModal('modal-user');
}

function editUser(id) {
  const u = DB.getUser(id);
  if (!u) return;
  document.getElementById('new-user-name').value  = u.name;
  document.getElementById('new-user-email').value = u.email;
  document.getElementById('new-user-pass').value  = '';
  document.getElementById('new-user-role').value  = u.role;
  document.getElementById('new-user-pass-copy')?.classList.add('hidden');
  // Supervisor
  const supGroup = document.getElementById('user-supervisor-group');
  if (supGroup) supGroup.classList.toggle('hidden', u.role === 'admin');
  _populateSupervisorDropdown(u.supervisorId || '');
  // store editing ID on modal
  document.getElementById('modal-user')._editId = id;
  openModal('modal-user');
}

function deleteUser(id) {
  const u = DB.getUser(id);
  if (!u || !confirm(`Remover o utilizador "${u.name}"? Esta ação não pode ser desfeita.`)) return;
  const users = DB.getUsers().filter(x => x.id !== id);
  DB._set(DB.KEYS.USERS, users);
  renderUtilizadores();
  showToast('Utilizador removido', 'info');
}

function createUser() {
  const name       = document.getElementById('new-user-name').value.trim();
  const email      = document.getElementById('new-user-email').value.trim();
  const pass       = document.getElementById('new-user-pass').value;
  const role       = document.getElementById('new-user-role').value;
  const supervisorId = document.getElementById('new-user-supervisor')?.value || '';
  const modal      = document.getElementById('modal-user');
  const editId     = modal?._editId || null;

  if (!name || !email) { showToast('Preencha nome e email', 'error'); return; }

  if (editId) {
    // Editing existing user
    const u = DB.getUser(editId);
    if (!u) return;
    u.name = name; u.email = email; u.role = role;
    u.supervisorId = supervisorId || null;
    if (pass && pass.length >= 6) u.password = pass;
    else if (pass && pass.length < 6) { showToast('Palavra-passe: mínimo 6 caracteres', 'error'); return; }
    DB.saveUser(u);
    if (modal) modal._editId = null;
    closeModal('modal-user');
    showToast(`Utilizador ${name} atualizado! ✓`, 'success');
  } else {
    // New user
    if (!pass) { showToast('Preencha a palavra-passe', 'error'); return; }
    if (pass.length < 6) { showToast('Palavra-passe: mínimo 6 caracteres', 'error'); return; }
    const existing = DB.findUserByEmail(email);
    if (existing) { showToast('Email já registado', 'error'); return; }
    DB.saveUser({ id: DB.uid(), companyId: currentCompany.id, name, email, password: pass, role, supervisorId: supervisorId || null });
    closeModal('modal-user');
    showToast(`Utilizador ${name} criado! 👤`, 'success');
  }
  renderUtilizadores();
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

// ══════════════════════════════════════════════
// ── PESQUISA GLOBAL (dropdown ao vivo) ──
// ══════════════════════════════════════════════
let _searchTimer = null;
let _currentExpId = null; // track currently open expense

function handleTopbarSearch(q) {
  clearTimeout(_searchTimer);
  const dd = document.getElementById('search-dropdown');
  if (!q || q.trim().length < 2) { dd?.classList.add('hidden'); return; }
  _searchTimer = setTimeout(() => _runGlobalSearch(q.trim()), 200);
}

function handleSearchKey(e) {
  if (e.key === 'Escape') {
    document.getElementById('search-dropdown')?.classList.add('hidden');
    document.getElementById('topbar-search-input').blur();
  }
  if (e.key === 'Enter') {
    const q = e.target.value.trim();
    if (q) _goToSearchPage(q);
  }
}

function _runGlobalSearch(q) {
  if (!currentCompany) return;
  const dd = document.getElementById('search-dropdown');
  if (!dd) return;
  const ql = q.toLowerCase();
  const currency = currentCompany.currency || 'MZN';
  const isFunc = currentUser.role === 'funcionario';
  const results = [];

  // Despesas
  const allExp = isFunc
    ? DB.getExpensesByUser(currentUser.id)
    : DB.getExpensesByCompany(currentCompany.id);
  allExp.filter(e =>
    expenseName(e).toLowerCase().includes(ql) ||
    (e.local||'').toLowerCase().includes(ql) ||
    (e.projeto||'').toLowerCase().includes(ql) ||
    (e.id||'').toLowerCase().startsWith(ql) ||
    (e.comentario||'').toLowerCase().includes(ql)
  ).slice(0, 5).forEach(e => {
    const u = DB.getUser(e.userId);
    results.push({
      icon: expenseIcon(e),
      title: expenseName(e),
      sub: `${fmtDate(e.data)} · ${fmtCurrency(e.valor||0, e.moeda||currency)}${u && !isFunc ? ' · '+u.name : ''}`,
      badge: `<span class="status-badge ${e.status}" style="font-size:10px">${statusLabel(e.status)}</span>`,
      action: `openExpenseDetail('${e.id}'); closeSearchDropdown();`,
      type: 'despesa'
    });
  });

  // Fornecedores
  DB.getFornecedoresByCompany(currentCompany.id).filter(f =>
    (f.nome||'').toLowerCase().includes(ql) ||
    (f.nuit||'').toLowerCase().includes(ql) ||
    (f.contacto||'').toLowerCase().includes(ql)
  ).slice(0, 3).forEach(f => {
    results.push({
      icon: '🏢',
      title: f.nome,
      sub: `${FORN_TIPO_LABEL[f.tipo]||f.tipo}${f.nuit ? ' · NUIT: '+f.nuit : ''}`,
      badge: '',
      action: `showPage('page-fornecedores'); closeSearchDropdown(); setTimeout(()=>{const s=document.getElementById('forn-search-page');if(s){s.value='${f.nome.replace(/'/g,"\\'")}';renderFornecedores();}},200);`,
      type: 'fornecedor'
    });
  });

  // Planos
  DB.getPlansByCompany(currentCompany.id).filter(p =>
    isFunc ? p.createdBy === currentUser.id : true
  ).filter(p =>
    (p.desc||'').toLowerCase().includes(ql) ||
    (p.local||'').toLowerCase().includes(ql) ||
    (p.projeto||'').toLowerCase().includes(ql)
  ).slice(0, 3).forEach(p => {
    const planIcons = { campo:'🌍', viagem:'✈️', alojamento:'🏨', formacao:'📚', reuniao:'🤝' };
    results.push({
      icon: planIcons[p.tipo] || '📅',
      title: p.desc,
      sub: `${fmtDate(p.inicio)} → ${fmtDate(p.fim)} · 📍 ${p.local||'—'}`,
      badge: '',
      action: `showPage('page-planeamento'); closeSearchDropdown();`,
      type: 'plano'
    });
  });

  if (results.length === 0) {
    dd.innerHTML = `<div class="search-dd-empty">Sem resultados para "<strong>${q}</strong>"</div>`;
  } else {
    const typeLabel = { despesa:'💳 Despesas', fornecedor:'🏢 Fornecedores', plano:'📅 Planos' };
    let lastType = null;
    dd.innerHTML = results.map(r => {
      const sep = r.type !== lastType ? `<div class="search-dd-sep">${typeLabel[r.type]}</div>` : '';
      lastType = r.type;
      return `${sep}<div class="search-dd-item" onclick="${r.action}">
        <span class="search-dd-icon">${r.icon}</span>
        <div class="search-dd-info">
          <div class="search-dd-title">${r.title}</div>
          <div class="search-dd-sub">${r.sub}</div>
        </div>
        ${r.badge}
      </div>`;
    }).join('') + `<div class="search-dd-footer" onclick="_goToSearchPage('${q}');closeSearchDropdown()">
      Ver todos os resultados para "<strong>${q}</strong>" →
    </div>`;
  }
  dd.classList.remove('hidden');
}

function _goToSearchPage(q) {
  document.getElementById('search-dropdown')?.classList.add('hidden');
  showPage('page-despesas');
  setTimeout(() => {
    const filterEl = document.getElementById('filter-search');
    if (filterEl) { filterEl.value = q; renderExpenseList(); }
  }, 100);
}

function closeSearchDropdown() {
  document.getElementById('search-dropdown')?.classList.add('hidden');
  document.getElementById('topbar-search-input').value = '';
}

// Fechar dropdown ao clicar fora
document.addEventListener('click', e => {
  const wrap = document.querySelector('.topbar-search');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('search-dropdown')?.classList.add('hidden');
  }
});

// ══════════════════════════════════════════════
// ── HISTÓRICO DE ALTERAÇÕES ──
// ══════════════════════════════════════════════

function _addHistory(exp, action, detail = '', userId = null) {
  if (!exp.history) exp.history = [];
  exp.history.push({
    ts: new Date().toISOString(),
    action,
    detail,
    userId: userId || currentUser?.id || null,
  });
}

function openExpenseHistory(id) {
  const exp = DB.getExpense(id);
  if (!exp) return;
  const body = document.getElementById('modal-history-body');
  if (!body) return;

  const history = exp.history || [];
  if (history.length === 0) {
    body.innerHTML = `<p class="empty-state">Sem histórico registado para esta despesa.</p>
      <p style="font-size:12px;color:var(--text-secondary);text-align:center">
        O histórico começa a ser registado a partir de agora em todas as despesas novas e actualizadas.
      </p>`;
  } else {
    const actionLabel = {
      submitted:  { icon:'📤', label:'Submetida' },
      resubmitted:{ icon:'🔄', label:'Re-submetida' },
      approved:   { icon:'✅', label:'Aprovada' },
      rejected:   { icon:'❌', label:'Rejeitada' },
      draft_saved:{ icon:'💾', label:'Rascunho guardado' },
      sent_draft: { icon:'📨', label:'Rascunho enviado' },
      viewed:     { icon:'👁',  label:'Visualizada' },
      edited:     { icon:'✏️', label:'Editada' },
    };
    body.innerHTML = `<div class="history-timeline">` +
      [...history].reverse().map(h => {
        const al = actionLabel[h.action] || { icon:'•', label: h.action };
        const u = DB.getUser(h.userId);
        const dt = h.ts ? new Date(h.ts).toLocaleString('pt-PT', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
        return `<div class="hist-item">
          <div class="hist-icon">${al.icon}</div>
          <div class="hist-info">
            <div class="hist-action">${al.label}</div>
            ${h.detail ? `<div class="hist-detail">"${h.detail}"</div>` : ''}
            <div class="hist-meta">${u ? u.name : '—'} · ${dt}</div>
          </div>
        </div>`;
      }).join('') + `</div>`;
  }
  openModal('modal-history');
}

// ══════════════════════════════════════════════
// ── PDF POR DESPESA ──
// ══════════════════════════════════════════════
function downloadExpensePDF(id) {
  const exp = id ? DB.getExpense(id) : null;
  if (!exp) return;
  if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
    printExpense(id); return; // fallback to print
  }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const W = 210; const m = 15;
    let y = 15;

    // Header
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, W, 26, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('SGDC', m, 11);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Sistema de Gestão de Despesas de Campo', m, 17);
    doc.text(currentCompany?.name || '', W-m, 11, { align:'right' });
    doc.text(new Date().toLocaleDateString('pt-PT'), W-m, 17, { align:'right' });
    y = 34;

    // Title
    doc.setTextColor(30,58,95);
    doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text(expenseName(exp), m, y); y += 8;

    // Status badge
    const statusColors = { approved:[16,120,94], pending:[161,98,7], rejected:[185,28,28], draft:[107,114,128] };
    const sc = statusColors[exp.status] || [107,114,128];
    doc.setFillColor(...sc);
    doc.roundedRect(m, y, 40, 7, 2, 2, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(8);
    doc.text(statusLabel(exp.status).replace(/[^\w\sÀ-ÿ]/gu,'').trim(), m+2, y+4.8);
    y += 12;

    // Details table
    const user = DB.getUser(exp.userId);
    const currency = exp.moeda || currentCompany?.currency || 'MZN';
    const rows = [
      ['Data', fmtDate(exp.data)],
      ['Funcionário', user?.name || '—'],
      ['Tipo', exp.type === 'procurement' ? 'Procurement' : 'Campo'],
      ['Categoria', typeLabel(exp.expenseType || exp.type)],
      ['Valor', fmtCurrency(exp.valor||0, currency)],
      ['Local', exp.local || '—'],
      ['Projecto', exp.projeto || '—'],
      ['Pagamento', payMethodLabel(exp.paymentMethod)],
      ['Departamento', exp.dept || '—'],
    ];
    if (exp.comentario) rows.push(['Comentário', exp.comentario]);

    doc.setFontSize(9);
    rows.forEach((row, i) => {
      const bg = i%2===0 ? [248,250,252] : [255,255,255];
      doc.setFillColor(...bg); doc.rect(m, y, W-2*m, 7, 'F');
      doc.setTextColor(107,114,128); doc.setFont('helvetica','bold');
      doc.text(row[0], m+2, y+4.8);
      doc.setTextColor(31,41,55); doc.setFont('helvetica','normal');
      doc.text(String(row[1]).substring(0,70), m+45, y+4.8);
      y += 7;
    });

    // Approval chain
    if (exp.approvals?.length > 0) {
      y += 5;
      doc.setTextColor(30,58,95); doc.setFontSize(10); doc.setFont('helvetica','bold');
      doc.text('Cadeia de Aprovação', m, y); y += 6;
      exp.approvals.forEach(a => {
        const aUser = a.userId ? DB.getUser(a.userId) : null;
        const st = { approved:'✓ Aprovado', rejected:'✗ Rejeitado', pending:'... Pendente', waiting:'⌛ Aguarda' }[a.status] || a.status;
        doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(31,41,55);
        doc.text(`Nível ${a.level} – ${a.label}: ${st}${aUser ? ' por '+aUser.name : ''}${a.comment ? ' ("'+a.comment+'")'  : ''}`, m+3, y);
        y += 6;
      });
    }

    // Footer
    doc.setFillColor(243,244,246); doc.rect(0,288,W,9,'F');
    doc.setTextColor(107,114,128); doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text(`SGDC · ${currentCompany?.name||''} · Gerado em ${new Date().toLocaleString('pt-PT')}`, m, 293);
    doc.text(`ID: ${exp.id}`, W-m, 293, { align:'right' });

    doc.save(`Despesa_${expenseName(exp).replace(/\s+/g,'_')}_${exp.data||'sem-data'}.pdf`);
    showToast('PDF gerado! 📄', 'success');
  } catch(err) {
    console.error(err);
    printExpense(id); // fallback
  }
}

// ══════════════════════════════════════════════
// ── EMAIL — PREVIEW MODAL ──
// ══════════════════════════════════════════════
let _emailPreviewContent = { to:'', subject:'', body:'' };

function sendReportEmail() {
  if (!currentCompany) return;
  let list = DB.getExpensesByCompany(currentCompany.id).filter(e => e.status !== 'draft');

  // Apply current filters
  const fDept = document.getElementById('rep-filter-dept')?.value || '';
  const fUser = document.getElementById('rep-filter-user')?.value || '';
  const fTipo = document.getElementById('rep-filter-tipo')?.value || '';
  list = filterByPeriod(list, reportPeriod);
  if (fDept) list = list.filter(e => e.dept === fDept);
  if (fUser) list = list.filter(e => e.userId === fUser);
  if (fTipo) list = list.filter(e => e.expenseType === fTipo);

  const currency = currentCompany.currency || 'MZN';
  const approved = list.filter(e => e.status === 'approved');
  const pending  = list.filter(e => e.status === 'pending');
  const total    = approved.reduce((s,e) => s+(e.valor||0), 0);
  const fmt = v => new Intl.NumberFormat('pt-MZ',{minimumFractionDigits:2}).format(v)+' '+currency;

  const cfg = typeof Scheduler !== 'undefined' ? Scheduler.getConfig(currentCompany.id) : {};
  const recipientsDefault = (cfg?.recipients || []).join(', ');

  const subject = `[SGDC] Relatório de Despesas – ${currentCompany.name} – ${periodLabel(reportPeriod)} – ${new Date().toLocaleDateString('pt-PT')}`;

  const top5 = [...approved].sort((a,b)=>(b.valor||0)-(a.valor||0)).slice(0,5);
  const body = `SGDC – Relatório de Despesas
Empresa: ${currentCompany.name}
Período: ${periodLabel(reportPeriod)}
Data de geração: ${new Date().toLocaleDateString('pt-PT')}

══════════════════════════════════════
RESUMO
══════════════════════════════════════
Total Aprovado:    ${fmt(total)}
Nº de Despesas:    ${list.length}
Aprovadas:         ${approved.length}
Pendentes:         ${pending.length}
Rejeitadas:        ${list.filter(e=>e.status==='rejected').length}
Média por Despesa: ${fmt(list.length > 0 ? total/approved.length : 0)}

══════════════════════════════════════
TOP 5 DESPESAS APROVADAS
══════════════════════════════════════
${top5.map((e,i) => {
  const u = DB.getUser(e.userId);
  return `${i+1}. ${expenseName(e)} — ${fmt(e.valor||0)}\n   Data: ${e.data||'—'} · Funcionário: ${u?.name||'—'} · Local: ${e.local||'—'}`;
}).join('\n\n')}

══════════════════════════════════════
DESPESAS PENDENTES DE APROVAÇÃO
══════════════════════════════════════
${pending.length === 0 ? 'Nenhuma despesa pendente.' :
  pending.slice(0,10).map(e => {
    const u = DB.getUser(e.userId);
    return `• ${expenseName(e)} — ${fmt(e.valor||0)} · ${u?.name||'—'} · ${e.data||'—'}`;
  }).join('\n')}

──────────────────────────────────────
Este relatório foi gerado automaticamente pelo SGDC.
Para ver o relatório completo com gráficos, abra a aplicação SGDC.`;

  _emailPreviewContent = { to: recipientsDefault, subject, body };

  document.getElementById('email-prev-to').value      = recipientsDefault;
  document.getElementById('email-prev-subject').value = subject;
  document.getElementById('email-prev-body').value    = body;

  openModal('modal-email-preview');
}

function copyEmailContent() {
  const body = document.getElementById('email-prev-body')?.value || '';
  navigator.clipboard.writeText(body).then(() => {
    showToast('Conteúdo copiado para a área de transferência! 📋', 'success');
  }).catch(() => {
    document.getElementById('email-prev-body').select();
    document.execCommand('copy');
    showToast('Copiado! 📋', 'success');
  });
}

function openEmailClient() {
  const to      = document.getElementById('email-prev-to')?.value || '';
  const subject = document.getElementById('email-prev-subject')?.value || '';
  const body    = document.getElementById('email-prev-body')?.value || '';
  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  closeModal('modal-email-preview');
  showToast('A abrir cliente de email… 📧', 'info');
}

// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
