/* ═══════════════════════════════════════════════
   SGDC – data.js v2.0
   Modelo de dados estendido com adiantamentos,
   aprovação multi-nível, notificações e config
═══════════════════════════════════════════════ */

const DB = {
  KEYS: {
    COMPANIES:    'sgdc_companies',
    USERS:        'sgdc_users',
    EXPENSES:     'sgdc_expenses',
    PLANS:        'sgdc_plans',
    ADVANCES:     'sgdc_advances',
    NOTIFICATIONS:'sgdc_notifications',
    SESSION:      'sgdc_session',
  },

  _get(key)       { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
  _set(key, val)  { localStorage.setItem(key, JSON.stringify(val)); },
  _getObj(key)    { try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; } },
  _setObj(key, v) { localStorage.setItem(key, JSON.stringify(v)); },
  uid()           { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

  // ── COMPANIES ──
  getCompanies()    { return this._get(this.KEYS.COMPANIES); },
  getCompany(id)    { return this.getCompanies().find(c => c.id === id) || null; },
  saveCompany(co) {
    const list = this.getCompanies();
    const idx = list.findIndex(c => c.id === co.id);
    if (idx >= 0) list[idx] = co; else list.push(co);
    this._set(this.KEYS.COMPANIES, list);
    return co;
  },

  // ── USERS ──
  getUsers()              { return this._get(this.KEYS.USERS); },
  getUser(id)             { return this.getUsers().find(u => u.id === id) || null; },
  getUsersByCompany(cid)  { return this.getUsers().filter(u => u.companyId === cid); },
  findUserByEmail(email)  { return this.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null; },
  saveUser(u) {
    const list = this.getUsers();
    const idx = list.findIndex(x => x.id === u.id);
    if (idx >= 0) list[idx] = u; else list.push(u);
    this._set(this.KEYS.USERS, list);
    return u;
  },

  // ── SESSION ──
  getSession()       { return this._getObj(this.KEYS.SESSION); },
  setSession(sess)   { this._setObj(this.KEYS.SESSION, sess); },
  clearSession()     { localStorage.removeItem(this.KEYS.SESSION); },

  // ── EXPENSES ──
  getExpenses()             { return this._get(this.KEYS.EXPENSES); },
  getExpense(id)            { return this.getExpenses().find(e => e.id === id) || null; },
  getExpensesByCompany(cid) { return this.getExpenses().filter(e => e.companyId === cid); },
  getExpensesByUser(uid)    { return this.getExpenses().filter(e => e.userId === uid); },
  saveExpense(exp) {
    const list = this.getExpenses();
    const idx  = list.findIndex(e => e.id === exp.id);
    if (idx >= 0) list[idx] = exp; else list.push(exp);
    this._set(this.KEYS.EXPENSES, list);
    return exp;
  },
  deleteExpense(id) { this._set(this.KEYS.EXPENSES, this.getExpenses().filter(e => e.id !== id)); },

  // ── PLANS ──
  getPlans()             { return this._get(this.KEYS.PLANS); },
  getPlansByCompany(cid) { return this.getPlans().filter(p => p.companyId === cid); },
  savePlan(p) {
    const list = this.getPlans();
    const idx  = list.findIndex(x => x.id === p.id);
    if (idx >= 0) list[idx] = p; else list.push(p);
    this._set(this.KEYS.PLANS, list);
    return p;
  },

  // ── ADVANCES ──
  getAdvances()             { return this._get(this.KEYS.ADVANCES); },
  getAdvance(id)            { return this.getAdvances().find(a => a.id === id) || null; },
  getAdvancesByCompany(cid) { return this.getAdvances().filter(a => a.companyId === cid); },
  getAdvancesByUser(uid)    { return this.getAdvances().filter(a => a.requestedBy === uid); },
  saveAdvance(adv) {
    const list = this.getAdvances();
    const idx  = list.findIndex(a => a.id === adv.id);
    if (idx >= 0) list[idx] = adv; else list.push(adv);
    this._set(this.KEYS.ADVANCES, list);
    return adv;
  },

  // ── NOTIFICATIONS ──
  getNotifications()         { return this._get(this.KEYS.NOTIFICATIONS); },
  getNotifsByUser(uid)       { return this.getNotifications().filter(n => n.userId === uid); },
  getUnreadCount(uid)        { return this.getNotifsByUser(uid).filter(n => !n.read).length; },
  addNotification(notif) {
    const list = this.getNotifications();
    list.unshift({ id: this.uid(), createdAt: new Date().toISOString(), read: false, ...notif });
    // Keep max 100 notifications
    this._set(this.KEYS.NOTIFICATIONS, list.slice(0, 100));
  },
  markNotifRead(id) {
    const list = this.getNotifications();
    const n = list.find(x => x.id === id);
    if (n) { n.read = true; this._set(this.KEYS.NOTIFICATIONS, list); }
  },
  markAllNotifsRead(userId) {
    const list = this.getNotifications().map(n => n.userId === userId ? { ...n, read: true } : n);
    this._set(this.KEYS.NOTIFICATIONS, list);
  },

  // ── APPROVAL CHAIN HELPERS ──
  /**
   * Returns the current pending approver level for an expense
   * Returns null if fully approved or rejected
   */
  getCurrentApprovalLevel(expense) {
    if (!expense.approvals || !expense.approvals.length) return null;
    const pending = expense.approvals.find(a => a.status === 'pending');
    return pending || null;
  },

  /**
   * Get users who can approve at a given level in a company
   */
  getApproversForLevel(companyId, level) {
    const company = this.getCompany(companyId);
    const chain = company?.approvalChain || [];
    const levelConfig = chain.find(c => c.level === level);
    if (!levelConfig) return [];

    const users = this.getUsersByCompany(companyId);
    return users.filter(u => {
      if (levelConfig.roleRequired) return u.role === levelConfig.roleRequired;
      if (levelConfig.userIds) return levelConfig.userIds.includes(u.id);
      return u.role !== 'funcionario';
    });
  },

  // ── SEED DEMO DATA ──
  seed() {
    if (this.getCompanies().length > 0) return;

    const companyId = 'demo-company';
    const adminId   = 'demo-admin';
    const gestorId  = 'demo-gestor';
    const dirId     = 'demo-director';
    const finId     = 'demo-financeiro';
    const funcId    = 'demo-func';

    // Company with 3-level approval chain
    this.saveCompany({
      id: companyId,
      name: 'ONG Mozambique Demo',
      currency: 'MZN',
      activityTypes: ['procurement', 'campo'],
      approvalChain: [
        { level: 1, label: 'Supervisor',  roleRequired: 'gestor' },
        { level: 2, label: 'Director',    roleRequired: 'director' },
        { level: 3, label: 'Financeiro',  roleRequired: 'financeiro' },
      ],
      perDiemRates: {
        nacional: { alojamento: 2500, alimentacao: 1500, transporte: 800 },
        internacional: { alojamento: 80, alimentacao: 60, transporte: 40 },
      },
      expenseLimits: {
        alimentacao: 5000,
        alojamento: 15000,
        transporte: 8000,
        perdiem: 3500,
      },
      createdAt: new Date().toISOString(),
    });

    // Users
    this.saveUser({ id: adminId,  companyId, name: 'Admin SGDC',    email: 'admin@sgdc.demo',      password: 'demo123', role: 'admin' });
    this.saveUser({ id: gestorId, companyId, name: 'Maria Gestora',  email: 'gestor@sgdc.demo',     password: 'demo123', role: 'gestor' });
    this.saveUser({ id: dirId,    companyId, name: 'Carlos Director', email: 'director@sgdc.demo',  password: 'demo123', role: 'director' });
    this.saveUser({ id: finId,    companyId, name: 'Ana Financeira',  email: 'financeiro@sgdc.demo',password: 'demo123', role: 'financeiro' });
    this.saveUser({ id: funcId,   companyId, name: 'João Func',       email: 'func@sgdc.demo',      password: 'demo123', role: 'funcionario' });

    const today = new Date();
    const fmt   = d => d.toISOString().slice(0, 10);
    const d = n => { const x = new Date(today); x.setDate(x.getDate() - n); return fmt(x); };

    // Expenses with multi-level approval chain
    const demoExpenses = [
      {
        id: DB.uid(), companyId, userId: funcId, type: 'procurement', status: 'approved',
        name: 'Material de escritório', expenseType: 'compra-direta',
        valor: 12500, moeda: 'MZN', data: d(2), local: 'Maputo', projeto: 'CO5',
        dept: 'admin', comentario: 'Compra urgente de papel e canetas.',
        paymentMethod: 'cash',
        approvals: [
          { level: 1, label: 'Supervisor',  status: 'approved', userId: gestorId, comment: 'Aprovado. Dentro do orçamento.', date: d(1) },
        ],
        submittedAt: d(2), receiptData: null,
      },
      {
        id: DB.uid(), companyId, userId: funcId, type: 'campo', status: 'pending',
        name: 'Alojamento – Missão Inhambane', expenseType: 'alojamento',
        valor: 45000, moeda: 'MZN', data: d(1), local: 'Inhambane', projeto: 'Zimuala',
        dept: 'operacoes', pessoas: 3, valorPessoa: 15000, trabalho: 'Levantamento de dados',
        dataInicio: d(3), dataFim: d(1), comentario: '',
        paymentMethod: 'mpesa', phoneNumber: '+258 84 000 0000',
        approvals: [
          { level: 1, label: 'Supervisor',  status: 'pending', userId: null, comment: '', date: null },
          { level: 2, label: 'Director',    status: 'waiting', userId: null, comment: '', date: null },
        ],
        submittedAt: d(1), receiptData: null,
      },
      {
        id: DB.uid(), companyId, userId: funcId, type: 'campo', status: 'rejected',
        name: 'Transporte – Tete', expenseType: 'transporte',
        valor: 8000, moeda: 'MZN', data: d(5), local: 'Tete', projeto: 'CO5',
        dept: 'campo', pessoas: 2, valorPessoa: 4000, trabalho: 'Supervisão',
        dataInicio: d(6), dataFim: d(5), comentario: 'Viagem de regresso.',
        paymentMethod: 'emola',
        approvals: [
          { level: 1, label: 'Supervisor', status: 'rejected', userId: gestorId, comment: 'Recibo ilegível. Resubmeta com recibo claro.', date: d(4) },
        ],
        submittedAt: d(5), receiptData: null,
      },
      {
        id: DB.uid(), companyId, userId: funcId, type: 'procurement', status: 'approved',
        name: 'Software de análise', expenseType: 'contrato',
        valor: 55000, moeda: 'MZN', data: d(10), local: 'Maputo', projeto: 'TI',
        dept: 'admin', comentario: 'Licença anual.',
        paymentMethod: 'bank',
        approvals: [
          { level: 1, label: 'Supervisor',  status: 'approved', userId: gestorId, comment: 'OK.', date: d(9) },
          { level: 2, label: 'Director',    status: 'approved', userId: dirId,    comment: 'Aprovado pela direção.', date: d(8) },
        ],
        submittedAt: d(10), receiptData: null,
      },
      {
        id: DB.uid(), companyId, userId: funcId, type: 'campo', status: 'approved',
        name: 'Alimentação – Equipa Gaza', expenseType: 'alimentacao',
        valor: 18000, moeda: 'MZN', data: d(7), local: 'Gaza', projeto: 'Zimuala',
        dept: 'campo', pessoas: 6, valorPessoa: 3000, trabalho: 'Formação comunitária',
        dataInicio: d(9), dataFim: d(7), comentario: '',
        paymentMethod: 'mpesa',
        approvals: [
          { level: 1, label: 'Supervisor', status: 'approved', userId: gestorId, comment: 'OK.', date: d(6) },
        ],
        submittedAt: d(7), receiptData: null,
      },
      {
        id: DB.uid(), companyId, userId: funcId, type: 'procurement', status: 'draft',
        name: 'Equipamento fotográfico', expenseType: 'compra-direta',
        valor: 95000, moeda: 'MZN', data: fmt(today), local: 'Maputo', projeto: 'CO5',
        dept: 'operacoes', comentario: 'Rascunho – aguardar aprovação orçamental.',
        paymentMethod: 'bank', approvals: [],
        submittedAt: null, receiptData: null,
      },
    ];
    demoExpenses.forEach(e => this.saveExpense(e));

    // Plans
    const demoPlans = [
      { id: DB.uid(), companyId, createdBy: funcId, tipo:'campo', desc:'Levantamento – Nampula', inicio: d(-5), fim: d(-3), local:'Nampula', pessoas:4, custo:12000, moeda:'MZN', total:48000, projeto:'CO5', notas:'Incluir motorista.', status:'upcoming', createdAt: fmt(today) },
      { id: DB.uid(), companyId, createdBy: funcId, tipo:'viagem', desc:'Voo Maputo → Beira', inicio: d(-10), fim: d(-9), local:'Beira', pessoas:2, custo:18000, moeda:'MZN', total:36000, projeto:'Zimuala', notas:'', status:'upcoming', createdAt: d(3) },
    ];
    demoPlans.forEach(p => this.savePlan(p));

    // Advances
    const demoAdvances = [
      {
        id: DB.uid(), companyId, requestedBy: funcId,
        amount: 50000, currency: 'MZN', purpose: 'Missão campo – Inhambane 3 dias',
        projeto: 'Zimuala', paymentMethod: 'mpesa', phoneNumber: '+258 84 000 0000',
        status: 'approved', approvedBy: gestorId,
        requestedAt: d(5), approvedAt: d(4), disbursedAt: d(3),
        totalUsed: 45000, remaining: 5000,
        linkedExpenses: [], notes: 'Fundo para missão de campo.',
      },
      {
        id: DB.uid(), companyId, requestedBy: funcId,
        amount: 25000, currency: 'MZN', purpose: 'Procurement material escritório Q2',
        projeto: 'CO5', paymentMethod: 'bank', phoneNumber: '',
        status: 'pending', approvedBy: null,
        requestedAt: d(1), approvedAt: null, disbursedAt: null,
        totalUsed: 0, remaining: 25000,
        linkedExpenses: [], notes: '',
      },
    ];
    demoAdvances.forEach(a => this.saveAdvance(a));
  },
};

DB.seed();
