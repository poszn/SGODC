/* ═══════════════════════════════════════════
   SGDC – reports.js
   PDF + Email + Scheduler de Relatórios Automáticos
═══════════════════════════════════════════ */

/* ── SCHEDULER ── */
const Scheduler = (() => {
  // Per-company config key
  function _key(companyId) { return 'sgdc_sched_' + (companyId || 'default'); }

  function getConfig(companyId) {
    try { return JSON.parse(localStorage.getItem(_key(companyId))) || defaultConfig(); }
    catch { return defaultConfig(); }
  }

  function saveConfig(companyId, cfg) {
    localStorage.setItem(_key(companyId), JSON.stringify(cfg));
  }

  function defaultConfig() {
    return {
      enabled: true,
      weeklyDay: 1,                               // 0=Dom,1=Seg..6=Sab
      weekly:    { enabled: false, dayOfWeek: 1, lastSent: null },
      monthly:   { enabled: true, lastSent: null },
      quarterly: { enabled: true, lastSent: null },
      annual:    { enabled: true, lastSent: null },
      recipients: [],
    };
  }

  // ── CHECK WHAT'S DUE ──
  function check(companyId) {
    const cfg = getConfig(companyId);
    if (cfg.enabled === false) return [];
    const now = new Date();
    const due = [];

    // Weekly (use weeklyDay from flat config OR legacy cfg.weekly.dayOfWeek)
    const weeklyEnabled = cfg.weekly?.enabled !== false;
    if (weeklyEnabled) {
      const lastSent = cfg.weekly?.lastSent ? new Date(cfg.weekly.lastSent) : null;
      const todayDOW = now.getDay();
      const targetDOW = cfg.weeklyDay ?? cfg.weekly?.dayOfWeek ?? 1;
      if (todayDOW === targetDOW) {
        if (!lastSent || daysDiff(lastSent, now) >= 7) {
          due.push({ type: 'weekly', label: 'Semanal', period: 'week' });
        }
      }
    }

    // Monthly (last day of month)
    if (cfg.monthly.enabled) {
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      if (now.getDate() === lastDayOfMonth) {
        const lastSent = cfg.monthly.lastSent ? new Date(cfg.monthly.lastSent) : null;
        if (!lastSent || daysDiff(lastSent, now) >= 28) {
          due.push({ type: 'monthly', label: 'Mensal', period: 'month' });
        }
      }
    }

    // Quarterly (last day of quarter: Mar 31, Jun 30, Sep 30, Dec 31)
    if (cfg.quarterly.enabled) {
      const qEnds = { 2:31, 5:30, 8:30, 11:31 }; // month (0-indexed): last day
      const lastDayQ = qEnds[now.getMonth()];
      if (lastDayQ && now.getDate() === lastDayQ) {
        const lastSent = cfg.quarterly.lastSent ? new Date(cfg.quarterly.lastSent) : null;
        if (!lastSent || daysDiff(lastSent, now) >= 85) {
          due.push({ type: 'quarterly', label: 'Trimestral', period: 'quarter' });
        }
      }
    }

    // Annual (Dec 31)
    if (cfg.annual.enabled) {
      if (now.getMonth() === 11 && now.getDate() === 31) {
        const lastSent = cfg.annual.lastSent ? new Date(cfg.annual.lastSent) : null;
        if (!lastSent || daysDiff(lastSent, now) >= 360) {
          due.push({ type: 'annual', label: 'Anual', period: 'year' });
        }
      }
    }

    return due;
  }

  function markSent(companyId, type) {
    const cfg = getConfig(companyId);
    if (!cfg[type]) cfg[type] = {};
    cfg[type].lastSent = new Date().toISOString().slice(0, 10);
    saveConfig(companyId, cfg);
  }

  function daysDiff(d1, d2) {
    return Math.floor((d2 - d1) / (1000 * 3600 * 24));
  }

  return { getConfig, saveConfig, defaultConfig, check, markSent, _key };
})();


/* ── PDF GENERATOR ── */
const ReportPDF = (() => {

  function generate(expenses, options = {}) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210; const margin = 15; const contentW = W - 2 * margin;
    let y = 15;

    const company = options.company || { name: 'SGDC', currency: 'MZN' };
    const title   = options.title || 'Relatório de Despesas';
    const period  = options.period || '';
    const currency = company.currency || 'MZN';

    // ── HEADER ──
    doc.setFillColor(26, 86, 219);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('SGDC', margin, 12);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text('Sistema de Gestão de Despesas de Campo', margin, 19);
    doc.setFontSize(9);
    doc.text(company.name, W - margin, 12, { align: 'right' });
    doc.text(new Date().toLocaleDateString('pt-PT'), W - margin, 19, { align: 'right' });
    y = 36;

    // ── TITLE ──
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text(title, margin, y); y += 6;
    if (period) {
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(period, margin, y); y += 8;
    }

    // ── SUMMARY BOXES ──
    const approved = expenses.filter(e => e.status === 'approved');
    const pending  = expenses.filter(e => e.status === 'pending');
    const rejected = expenses.filter(e => e.status === 'rejected');
    const total    = approved.reduce((s, e) => s + (e.valor || 0), 0);

    const boxes = [
      { label: 'Total Aprovado', value: fmt(total, currency), color: [16, 120, 94] },
      { label: 'Nº Despesas',    value: String(expenses.length), color: [26, 86, 219] },
      { label: 'Pendentes',      value: String(pending.length),  color: [243, 167, 18] },
      { label: 'Rejeitadas',     value: String(rejected.length), color: [220, 38, 38] },
    ];

    const boxW = (contentW - 9) / 4;
    boxes.forEach((b, i) => {
      const bx = margin + i * (boxW + 3);
      doc.setFillColor(...b.color); doc.roundedRect(bx, y, boxW, 18, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(b.label, bx + boxW/2, y + 5, { align: 'center' });
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text(b.value, bx + boxW/2, y + 13, { align: 'center' });
    });
    y += 25;

    // ── TABLE ──
    doc.setFillColor(31, 41, 55);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    const cols = [
      { text: 'Data',        x: margin + 2,   w: 22 },
      { text: 'Tipo',        x: margin + 25,  w: 20 },
      { text: 'Descrição',   x: margin + 46,  w: 62 },
      { text: 'Projeto',     x: margin + 109, w: 22 },
      { text: 'Valor',       x: margin + 132, w: 26 },
      { text: 'Estado',      x: margin + 159, w: 24 },
    ];
    cols.forEach(c => doc.text(c.text, c.x, y + 5.5));
    y += 8;

    const expSorted = [...expenses].sort((a,b)=>(b.data||'').localeCompare(a.data||''));
    let rowIdx = 0;
    for (const e of expSorted) {
      if (y > 260) { doc.addPage(); y = 20; }

      const bg = rowIdx % 2 === 0 ? [249,250,251] : [255,255,255];
      doc.setFillColor(...bg); doc.rect(margin, y, contentW, 7, 'F');
      doc.setTextColor(31, 41, 55); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');

      const statusColors = { approved: [16,120,94], pending: [161,98,7], rejected: [185,28,28], draft: [107,114,128] };
      const sc = statusColors[e.status] || [107,114,128];
      const statusTxt = { approved:'Aprovado', pending:'Pendente', rejected:'Rejeitado', draft:'Rascunho' }[e.status] || e.status;

      doc.text(e.data || '—',             cols[0].x, y + 4.8, { maxWidth: cols[0].w });
      doc.text(e.type === 'procurement' ? 'Proc.' : 'Campo', cols[1].x, y + 4.8);
      doc.text((e.name || '').substring(0, 45), cols[2].x, y + 4.8, { maxWidth: cols[2].w });
      doc.text((e.projeto || '—').substring(0, 12), cols[3].x, y + 4.8);
      doc.text(fmt(e.valor || 0, e.moeda || currency), cols[4].x, y + 4.8, { maxWidth: cols[4].w });

      doc.setFillColor(...sc, 0.15);
      doc.setTextColor(...sc); doc.setFont('helvetica', 'bold');
      doc.text(statusTxt, cols[5].x, y + 4.8);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(31,41,55);

      y += 7; rowIdx++;
    }

    // ── FOOTER ──
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFillColor(243, 244, 246);
      doc.rect(0, 290, W, 7, 'F');
      doc.setTextColor(107, 114, 128); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(`SGDC – ${company.name}  |  Gerado em ${new Date().toLocaleDateString('pt-PT')}`, margin, 294.5);
      doc.text(`Página ${p} / ${pages}`, W - margin, 294.5, { align: 'right' });
    }

    return doc;
  }

  function download(doc, filename) {
    doc.save(filename || `SGDC_Relatorio_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  function getBlob(doc) {
    return doc.output('blob');
  }

  function fmt(val, cur='MZN') {
    return new Intl.NumberFormat('pt-MZ',{minimumFractionDigits:2}).format(val)+' '+(cur||'MZN');
  }

  return { generate, download, getBlob };
})();


/* ── EMAIL SENDER ── */
const EmailSender = (() => {

  // Send via mailto: (opens default email client)
  function sendViaMailto(recipients, subject, body) {
    const to = recipients.join(',');
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  }

  // Send via EmailJS (requires config)
  async function sendViaEmailJS(cfg, templateParams) {
    if (!window.emailjs || !cfg.emailjsServiceId) return false;
    try {
      emailjs.init(cfg.emailjsPublicKey);
      await emailjs.send(cfg.emailjsServiceId, cfg.emailjsTemplateId, templateParams);
      return true;
    } catch (e) {
      console.error('EmailJS error:', e);
      return false;
    }
  }

  function buildEmailBody(type, expenses, company) {
    const currency = company?.currency || 'MZN';
    const labels = { weekly:'Semanal', monthly:'Mensal', quarterly:'Trimestral', annual:'Anual' };
    const approved = expenses.filter(e=>e.status==='approved');
    const pending  = expenses.filter(e=>e.status==='pending');
    const total    = approved.reduce((s,e)=>s+(e.valor||0),0);
    const fmt      = v => new Intl.NumberFormat('pt-MZ',{minimumFractionDigits:2}).format(v)+' '+currency;

    return `SGDC – Relatório ${labels[type]||type}
Empresa: ${company?.name || 'SGDC'}
Data: ${new Date().toLocaleDateString('pt-PT')}

RESUMO
───────────────────────────────
Total Aprovado:  ${fmt(total)}
Nº Despesas:     ${expenses.length}
Aprovadas:       ${approved.length}
Pendentes:       ${pending.length}
Rejeitadas:      ${expenses.filter(e=>e.status==='rejected').length}

TOP 5 DESPESAS APROVADAS
───────────────────────────────
${approved.sort((a,b)=>(b.valor||0)-(a.valor||0)).slice(0,5)
  .map((e,i)=>`${i+1}. ${e.name||'—'} – ${fmt(e.valor||0)} (${e.data||'—'})`).join('\n')}

Este relatório foi gerado automaticamente pelo SGDC.
Para detalhes completos, abra a aplicação SGDC.`;
  }

  return { sendViaMailto, sendViaEmailJS, buildEmailBody };
})();


/* ── REPORT TRIGGER ── */
function triggerReport(type, period, company, expenses, autoSend = false) {
  const cfg = Scheduler.getConfig();
  if (!cfg.recipients.length && !autoSend) {
    showToast('Configure os destinatários em Configurações → Relatórios', 'error');
    return;
  }

  const filtered = filterByReportPeriod(expenses, period);
  const labels   = { weekly:'Semanal', monthly:'Mensal', quarterly:'Trimestral', annual:'Anual' };
  const label    = labels[type] || type;
  const filename = `SGDC_${label}_${new Date().toISOString().slice(0,7)}.pdf`;

  // Generate PDF
  const doc = ReportPDF.generate(filtered, {
    company,
    title: `Relatório ${label} de Despesas`,
    period: getPeriodLabel(period),
  });

  // Download PDF
  ReportPDF.download(doc, filename);
  Scheduler.markSent(type);

  // Send email
  if (cfg.recipients.length) {
    const subject = `[SGDC] Relatório ${label} – ${company?.name || ''} – ${new Date().toLocaleDateString('pt-PT')}`;
    const body    = EmailSender.buildEmailBody(type, filtered, company);

    if (cfg.emailjsServiceId && window.emailjs) {
      EmailSender.sendViaEmailJS(cfg, { to_email: cfg.recipients.join(','), subject, message: body })
        .then(ok => showToast(ok ? `📧 Relatório ${label} enviado!` : `📧 EmailJS falhou. Use "Enviar por Email" manualmente.`, ok ? 'success' : 'error'));
    } else {
      EmailSender.sendViaMailto(cfg.recipients, subject, body);
      showToast(`📄 PDF gerado. Email preparado para envio.`, 'success');
    }
  } else {
    showToast(`📄 Relatório ${label} gerado e descarregado!`, 'success');
  }
}

function filterByReportPeriod(expenses, period) {
  const now = new Date();
  return expenses.filter(e => {
    if (!e.data) return false;
    const d = new Date(e.data);
    if (period === 'week') {
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
      return d >= startOfWeek;
    }
    if (period === 'month') return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
    if (period === 'quarter') {
      const q = Math.floor(now.getMonth()/3);
      return d.getFullYear()===now.getFullYear() && Math.floor(d.getMonth()/3)===q;
    }
    if (period === 'year') return d.getFullYear() === now.getFullYear();
    return true;
  });
}

function getPeriodLabel(period) {
  const now = new Date();
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  if (period === 'week') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    return `Semana de ${start.toLocaleDateString('pt-PT')} a ${now.toLocaleDateString('pt-PT')}`;
  }
  if (period === 'month') return `${months[now.getMonth()]} ${now.getFullYear()}`;
  if (period === 'quarter') return `${Math.floor(now.getMonth()/3)+1}º Trimestre ${now.getFullYear()}`;
  if (period === 'year') return `Ano ${now.getFullYear()}`;
  return '';
}

/* ── CHECK ON APP LOAD ── */
function checkScheduledReports(companyId) {
  if (!companyId) return;
  const due = Scheduler.check(companyId);
  if (due.length === 0) return;

  due.forEach(d => {
    const notifEl = document.getElementById('scheduled-report-notification');
    if (notifEl) {
      notifEl.classList.remove('hidden');
      const list = document.getElementById('scheduled-report-list');
      if (list) {
        const li = document.createElement('div');
        li.className = 'sched-report-item';
        li.innerHTML = `📊 Relatório <strong>${d.label}</strong> está pronto
          <button class="btn btn-primary btn-sm" onclick="autoTriggerReport('${d.type}','${d.period}')">Gerar e Enviar</button>`;
        list.appendChild(li);
      }
    }
  });
}

function autoTriggerReport(type, period) {
  if (!currentCompany) return;
  const expenses = DB.getExpensesByCompany(currentCompany.id).filter(e=>e.status!=='draft');
  triggerReport(type, period, currentCompany, expenses, true);
  document.getElementById('scheduled-report-notification')?.classList.add('hidden');
}
