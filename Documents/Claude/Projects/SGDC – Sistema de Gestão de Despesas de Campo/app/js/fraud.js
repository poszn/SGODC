/* ═══════════════════════════════════════════
   SGDC – fraud.js
   Detecção automática de fraude e anomalias
═══════════════════════════════════════════ */

const FraudDetector = (() => {

  const RULES = {
    DUPLICATE_HOURS: 24,        // Duplicado se mesmo valor+utilizador em 24h
    ROUND_NUMBER_THRESHOLD: 5,  // Alertar se 5+ despesas consecutivas de valores redondos
    HIGH_AMOUNT_MULTIPLIER: 3,  // Alertar se valor > 3× média do utilizador
    WEEKEND_WARNING: false,     // Alertar despesas no fim-de-semana (configurável)
    MAX_DAILY_SUBMISSIONS: 10,  // Alertar se > 10 despesas num dia
  };

  // ── RISK LEVELS ──
  const RISK = {
    LOW:    { level: 0, label: 'Baixo',  color: '10785E', icon: '✅' },
    MEDIUM: { level: 1, label: 'Médio',  color: 'F59E0B', icon: '⚠️' },
    HIGH:   { level: 2, label: 'Alto',   color: 'DC2626', icon: '🚨' },
  };

  // ── ANALYSE SINGLE EXPENSE ──
  function analyseExpense(expense, allExpenses) {
    const alerts = [];
    const companyExpenses = allExpenses.filter(e => e.companyId === expense.companyId);
    const userExpenses    = companyExpenses.filter(e => e.userId === expense.userId && e.id !== expense.id);

    // 1. DUPLICATE CHECK
    const dup = userExpenses.find(e => {
      if (!e.data || !expense.data) return false;
      const sameAmount = Math.abs((e.valor || 0) - (expense.valor || 0)) < 0.01;
      const d1 = new Date(e.data).getTime();
      const d2 = new Date(expense.data).getTime();
      const hoursDiff = Math.abs(d1 - d2) / (1000 * 3600);
      return sameAmount && e.moeda === expense.moeda && hoursDiff <= RULES.DUPLICATE_HOURS;
    });
    if (dup) {
      alerts.push({
        rule: 'DUPLICATE',
        risk: RISK.HIGH,
        message: `Possível duplicado: valor idêntico (${fmtValor(expense.valor, expense.moeda)}) registado em ${fmtDate(dup.data)} pelo mesmo utilizador.`,
        duplicateId: dup.id,
      });
    }

    // 2. HIGH AMOUNT
    if (userExpenses.length >= 3) {
      const avg = userExpenses.reduce((s,e) => s + (e.valor||0), 0) / userExpenses.length;
      if (avg > 0 && (expense.valor || 0) > avg * RULES.HIGH_AMOUNT_MULTIPLIER) {
        alerts.push({
          rule: 'HIGH_AMOUNT',
          risk: RISK.MEDIUM,
          message: `Valor inusualmente alto: ${fmtValor(expense.valor, expense.moeda)} vs. média de ${fmtValor(avg, expense.moeda)} deste utilizador.`,
        });
      }
    }

    // 3. ROUND NUMBER
    const val = expense.valor || 0;
    if (val > 0 && val % 1000 === 0 && val >= 10000) {
      const recentRound = userExpenses.filter(e => (e.valor||0) % 1000 === 0 && e.status !== 'draft')
                                      .slice(-4).length;
      if (recentRound >= 3) {
        alerts.push({
          rule: 'ROUND_NUMBER',
          risk: RISK.LOW,
          message: `Padrão de valores redondos: ${recentRound + 1} das últimas despesas são múltiplos de 1.000.`,
        });
      }
    }

    // 4. WEEKEND (if enabled)
    if (RULES.WEEKEND_WARNING && expense.data) {
      const dow = new Date(expense.data + 'T12:00:00').getDay();
      if (dow === 0 || dow === 6) {
        alerts.push({
          rule: 'WEEKEND',
          risk: RISK.LOW,
          message: `Despesa registada ao fim-de-semana (${dow === 0 ? 'Domingo' : 'Sábado'}). Verifique se é justificado.`,
        });
      }
    }

    // 5. MANY SAME-DAY EXPENSES
    if (expense.data) {
      const sameDay = userExpenses.filter(e => e.data === expense.data && e.status !== 'draft').length;
      if (sameDay >= RULES.MAX_DAILY_SUBMISSIONS - 1) {
        alerts.push({
          rule: 'MANY_DAILY',
          risk: RISK.MEDIUM,
          message: `${sameDay + 1} despesas num único dia (${fmtDate(expense.data)}). Verifique se todas são legítimas.`,
        });
      }
    }

    // 6. MISSING RECEIPT
    if (!expense.receiptData && (expense.valor || 0) > 5000) {
      alerts.push({
        rule: 'NO_RECEIPT',
        risk: RISK.MEDIUM,
        message: `Despesa de ${fmtValor(expense.valor, expense.moeda)} sem recibo anexado.`,
      });
    }

    // Calculate overall risk
    const maxRisk = alerts.length === 0 ? RISK.LOW :
      alerts.reduce((max, a) => a.risk.level > max.level ? a.risk : max, RISK.LOW);

    return {
      expenseId: expense.id,
      alerts,
      riskLevel: maxRisk,
      score: alerts.reduce((s, a) => s + (a.risk.level * 30), 0),
      passed: alerts.length === 0,
    };
  }

  // ── ANALYSE ALL COMPANY EXPENSES ──
  function analyseCompany(companyId, allExpenses) {
    const companyExp = allExpenses.filter(e => e.companyId === companyId && e.status !== 'draft');
    const results = companyExp.map(e => analyseExpense(e, allExpenses));
    const flagged = results.filter(r => r.alerts.length > 0);

    return {
      total: companyExp.length,
      flagged: flagged.length,
      highRisk: flagged.filter(r => r.riskLevel.level >= 2).length,
      results: flagged,
      summary: buildSummary(flagged, companyExp),
    };
  }

  function buildSummary(flagged, allExp) {
    const byRule = {};
    flagged.forEach(r => r.alerts.forEach(a => {
      byRule[a.rule] = (byRule[a.rule] || 0) + 1;
    }));
    return {
      totalAmount: allExp.filter(e=>e.status==='approved').reduce((s,e)=>s+(e.valor||0),0),
      atRiskAmount: flagged.reduce((s,r) => {
        const exp = allExp.find(e=>e.id===r.expenseId);
        return s + (exp?.valor || 0);
      }, 0),
      byRule,
    };
  }

  // ── HELPERS ──
  function fmtValor(val, cur='MZN') {
    return new Intl.NumberFormat('pt-MZ',{minimumFractionDigits:2}).format(val||0)+' '+(cur||'MZN');
  }
  function fmtDate(s) {
    if (!s) return '—';
    return new Date(s+'T00:00:00').toLocaleDateString('pt-PT',{day:'2-digit',month:'short',year:'numeric'});
  }

  return { analyseExpense, analyseCompany, RISK };
})();


// ── FRAUD BADGE UI ──
function renderFraudBadge(analysis) {
  if (!analysis || analysis.passed) return '';
  const r = analysis.riskLevel;
  return `<span class="fraud-badge" style="background:#${r.color}20;color:#${r.color};border:1px solid #${r.color}40">
    ${r.icon} Risco ${r.label}
  </span>`;
}

function showFraudAlerts(expenseId) {
  const allExp = DB.getExpenses();
  const exp = DB.getExpense(expenseId);
  if (!exp) return;
  const analysis = FraudDetector.analyseExpense(exp, allExp);
  if (analysis.passed) { showToast('✅ Sem alertas de fraude detectados', 'success'); return; }

  const modal = document.getElementById('modal-fraud');
  const body  = document.getElementById('fraud-modal-body');
  if (!modal || !body) return;

  body.innerHTML = analysis.alerts.map(a => `
    <div class="fraud-alert-item" style="border-left:4px solid #${a.risk.color}">
      <div class="fraud-alert-title">${a.risk.icon} ${ruleLabel(a.rule)}</div>
      <div class="fraud-alert-msg">${a.message}</div>
    </div>`).join('');

  modal.classList.remove('hidden');
}

function ruleLabel(rule) {
  return {
    DUPLICATE: 'Possível Duplicado',
    HIGH_AMOUNT: 'Valor Anómalo',
    ROUND_NUMBER: 'Padrão Suspeito',
    WEEKEND: 'Despesa de Fim-de-Semana',
    MANY_DAILY: 'Múltiplas Despesas no Mesmo Dia',
    NO_RECEIPT: 'Sem Recibo',
  }[rule] || rule;
}
