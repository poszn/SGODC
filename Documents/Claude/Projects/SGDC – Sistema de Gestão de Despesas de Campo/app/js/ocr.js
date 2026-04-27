/* ═══════════════════════════════════════════
   SGDC – ocr.js
   OCR automático de recibos via Tesseract.js
═══════════════════════════════════════════ */

const OCR = (() => {
  let worker = null;
  let workerReady = false;

  // ── INIT WORKER ──
  async function init() {
    if (workerReady) return true;
    try {
      worker = await Tesseract.createWorker(['por', 'eng'], 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            const bar = document.getElementById('ocr-progress-bar');
            const lbl = document.getElementById('ocr-progress-label');
            if (bar) bar.style.width = pct + '%';
            if (lbl) lbl.textContent = `A processar recibo… ${pct}%`;
          }
        }
      });
      workerReady = true;
      return true;
    } catch (e) {
      console.error('OCR init failed:', e);
      return false;
    }
  }

  // ── PROCESS IMAGE ──
  async function processImage(imageData) {
    showOCRModal();
    try {
      const ready = await init();
      if (!ready) throw new Error('OCR não disponível');

      const { data: { text } } = await worker.recognize(imageData);
      hideOCRModal();
      return parseReceiptText(text);
    } catch (e) {
      hideOCRModal();
      showToast('OCR indisponível. Preencha manualmente.', 'error');
      return null;
    }
  }

  // ── PARSE EXTRACTED TEXT ──
  function parseReceiptText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
    const result = {
      rawText: text,
      valor: null,
      moeda: null,
      data: null,
      local: null,
      fornecedor: null,
      categoria: null,
    };

    // ── AMOUNT extraction ──
    const amountPatterns = [
      /TOTAL[:\s]+([0-9.,]+)/i,
      /MONTANTE[:\s]+([0-9.,]+)/i,
      /VALOR[:\s]+([0-9.,]+)/i,
      /AMOUNT[:\s]+([0-9.,]+)/i,
      /([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/,
      /([0-9]+[.,][0-9]{2})/,
    ];
    for (const pat of amountPatterns) {
      const m = text.match(pat);
      if (m) {
        const raw = m[1].replace(/\./g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val) && val > 0) { result.valor = val; break; }
      }
    }

    // ── CURRENCY ──
    if (/MZN|MT\b|METICAL/i.test(text)) result.moeda = 'MZN';
    else if (/USD|\$|DOLLAR/i.test(text)) result.moeda = 'USD';
    else if (/EUR|€/i.test(text)) result.moeda = 'EUR';
    else result.moeda = 'MZN';

    // ── DATE extraction ──
    const datePats = [
      /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/,  // DD/MM/YYYY
      /(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/,  // YYYY-MM-DD
      /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{2})/,  // DD/MM/YY
    ];
    for (const pat of datePats) {
      const m = text.match(pat);
      if (m) {
        try {
          let d;
          if (m[1].length === 4) {
            d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
          } else if (parseInt(m[3]) < 100) {
            const yr = parseInt(m[3]) + 2000;
            d = new Date(`${yr}-${m[2]}-${m[1]}`);
          } else {
            d = new Date(`${m[3]}-${m[2]}-${m[1]}`);
          }
          if (!isNaN(d.getTime())) {
            result.data = d.toISOString().slice(0, 10);
            break;
          }
        } catch {}
      }
    }

    // ── VENDOR (first meaningful line) ──
    const skipWords = /total|valor|data|hora|time|date|recibo|receipt|fatura|invoice|nif|nuit|iva|vat|\d{4}|\d{2}\/\d{2}/i;
    for (const line of lines.slice(0, 8)) {
      if (line.length > 3 && !skipWords.test(line) && /[a-záàâãéêíóôõúç]/i.test(line)) {
        result.fornecedor = line.substring(0, 60);
        break;
      }
    }

    // ── CATEGORY GUESS ──
    const catMap = [
      { keys: /hotel|hostel|pousada|alojamento|lodge|inn/i, cat: 'alojamento' },
      { keys: /restaurante|café|comida|lunch|dinner|food|refeição|alimentação/i, cat: 'alimentacao' },
      { keys: /táxi|uber|bolt|transporte|gasolina|combustível|posto|petro/i, cat: 'transporte' },
      { keys: /farmácia|pharmacy|clinic|hospital|saúde/i, cat: 'saude' },
      { keys: /vodacom|tmcel|movitel|telemo|airtime|comunicação/i, cat: 'comunicacao' },
      { keys: /supermercado|mercearia|shoprite|game|supermarket/i, cat: 'compras' },
    ];
    for (const { keys, cat } of catMap) {
      if (keys.test(text)) { result.categoria = cat; break; }
    }

    return result;
  }

  // ── MODAL HELPERS ──
  function showOCRModal() {
    const modal = document.getElementById('modal-ocr');
    if (modal) {
      modal.classList.remove('hidden');
      const bar = document.getElementById('ocr-progress-bar');
      const lbl = document.getElementById('ocr-progress-label');
      if (bar) bar.style.width = '5%';
      if (lbl) lbl.textContent = 'A iniciar OCR…';
    }
  }
  function hideOCRModal() {
    const modal = document.getElementById('modal-ocr');
    if (modal) modal.classList.add('hidden');
  }

  // ── PUBLIC API ──
  return { processImage, parseReceiptText };
})();
