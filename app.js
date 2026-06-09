/* ============================================================
   RM Conquest Proyect — Main Application Logic
   SPA, CRUD, localStorage, export/import
   ============================================================ */

(function () {
  'use strict';

  // ─── Default Categories ───
  const DEFAULT_CATEGORIES = {
    negocio: {
      ingreso: ['Ventas', 'Servicios', 'Cobros', 'Inversión', 'Otros'],
      gasto: ['Proveedores', 'Alquiler', 'Impuestos', 'Sueldos', 'Marketing', 'Insumos', 'Transporte', 'Servicios', 'Otros'],
    },
    personal: {
      ingreso: ['Sueldo', 'Freelance', 'Ventas', 'Regalos', 'Otros'],
      gasto: ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Educación', 'Servicios', 'Alquiler', 'Ropa', 'Suscripciones', 'Otros'],
    },
  };

  const DEFAULT_ENTITIES = [
    { id: 'negocio-1', type: 'negocio', name: 'Negocio 1' },
    { id: 'negocio-2', type: 'negocio', name: 'Negocio 2' },
    { id: 'negocio-3', type: 'negocio', name: 'Negocio 3' },
    { id: 'personal-1', type: 'personal', name: 'Personal 1' },
    { id: 'personal-2', type: 'personal', name: 'Personal 2' },
    { id: 'personal-3', type: 'personal', name: 'Tarjeta' },
  ];

  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const STORAGE_KEY = 'finanzas_proyect_beta_data';

  // ─── Application State ───
  const state = {
    currentView: 'general',
    transactions: [],
    categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
    entities: JSON.parse(JSON.stringify(DEFAULT_ENTITIES)),
    goals: [],
    metasSubTab: 'presupuestos',
    gananciasCurrency: 'ARS',
    activeEntityId: { negocio: 'negocio-1', personal: 'personal-1' },
    editingTitleId: null,
    selectedMonth: new Date().getMonth(),
    selectedYear: new Date().getFullYear(),
    editingId: null,
    scopeFilter: { currency: 'all', medium: 'all' },
    analysisScope: 'todo',
    analysisCurrency: 'ARS',
    dashboardCurrency: 'ARS',
    settingsCatScope: 'negocio',
    settingsCatType: 'gasto',
  };

  // ─── Helpers ───

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  function formatCurrency(amount, currency) {
    const abs = Math.abs(amount);
    if (currency === 'USD') {
      return 'US$ ' + abs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '$ ' + abs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  }

  function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].substring(0, 3)}`;
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getMonthLabel() {
    return `${MONTH_NAMES[state.selectedMonth]} ${state.selectedYear}`;
  }

  function filterTransactionByEntity(t, entityId) {
    if (!entityId || entityId === 'todo') return true;
    if (entityId === 'negocio' || entityId === 'personal') return t.scope === entityId;
    return t.entityId === entityId;
  }

  function transactionsForMonth(month, year, entityId) {
    return state.transactions.filter(t => {
      const d = new Date(t.date + 'T12:00:00');
      if (d.getMonth() !== month || d.getFullYear() !== year) return false;
      return filterTransactionByEntity(t, entityId);
    });
  }

  function applyFilters(transactions) {
    return transactions.filter(t => {
      if (state.scopeFilter.currency !== 'all' && t.currency !== state.scopeFilter.currency) return false;
      if (state.scopeFilter.medium !== 'all' && t.medium !== state.scopeFilter.medium) return false;
      return true;
    });
  }

  function renameEntity(entityId, newName) {
    const ent = state.entities.find(e => e.id === entityId);
    if (ent && newName && newName.trim()) {
      ent.name = newName.trim();
      saveData();
      state.editingTitleId = null;
      updateDropdownMenus();
      renderView();
      renderStatsTicker();
    }
  }

  // ─── Storage ───

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        transactions: state.transactions,
        categories: state.categories,
        entities: state.entities,
        goals: state.goals || [],
      }));
    } catch (e) { console.error('Error saving:', e); }
  }

  function loadData() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = localStorage.getItem('finanzas360_data');
        if (raw) localStorage.setItem(STORAGE_KEY, raw);
      }
      if (raw) {
        const data = JSON.parse(raw);
        state.transactions = data.transactions || [];
        if (data.categories) state.categories = data.categories;
        if (data.entities) state.entities = data.entities;
        state.goals = data.goals || [];
        let migrated = false;
        state.transactions.forEach(t => {
          if (!t.entityId) { t.entityId = t.scope === 'negocio' ? 'negocio-1' : 'personal-1'; migrated = true; }
        });
        if (migrated) saveData();
      } else {
        state.goals = [];
      }
    } catch (e) { console.error('Error loading:', e); }
  }

  // ─── Calculations ───

  function calculateMonthTotals(month, year, scope) {
    const totals = { incomeARS: 0, expenseARS: 0, incomeUSD: 0, expenseUSD: 0 };
    transactionsForMonth(month, year, scope).forEach(t => {
      if (t.type === 'ingreso') { t.currency === 'ARS' ? totals.incomeARS += t.amount : totals.incomeUSD += t.amount; }
      else { t.currency === 'ARS' ? totals.expenseARS += t.amount : totals.expenseUSD += t.amount; }
    });
    return totals;
  }

  function calculateAllTimeTotals(entityId) {
    const totals = { incomeARS: 0, expenseARS: 0, incomeUSD: 0, expenseUSD: 0 };
    state.transactions.forEach(t => {
      if (!filterTransactionByEntity(t, entityId)) return;
      if (t.type === 'ingreso') { t.currency === 'ARS' ? totals.incomeARS += t.amount : totals.incomeUSD += t.amount; }
      else { t.currency === 'ARS' ? totals.expenseARS += t.amount : totals.expenseUSD += t.amount; }
    });
    return totals;
  }

  function calculateFilteredMonthTotals(month, year, entityId) {
    const totals = { incomeARS: 0, expenseARS: 0, incomeUSD: 0, expenseUSD: 0 };
    applyFilters(transactionsForMonth(month, year, entityId)).forEach(t => {
      if (t.type === 'ingreso') { t.currency === 'ARS' ? totals.incomeARS += t.amount : totals.incomeUSD += t.amount; }
      else { t.currency === 'ARS' ? totals.expenseARS += t.amount : totals.expenseUSD += t.amount; }
    });
    return totals;
  }

  function calculateFilteredAllTimeTotals(entityId) {
    const totals = { incomeARS: 0, expenseARS: 0, incomeUSD: 0, expenseUSD: 0 };
    state.transactions.filter(t => {
      if (!filterTransactionByEntity(t, entityId)) return false;
      if (state.scopeFilter.currency !== 'all' && t.currency !== state.scopeFilter.currency) return false;
      if (state.scopeFilter.medium !== 'all' && t.medium !== state.scopeFilter.medium) return false;
      return true;
    }).forEach(t => {
      if (t.type === 'ingreso') { t.currency === 'ARS' ? totals.incomeARS += t.amount : totals.incomeUSD += t.amount; }
      else { t.currency === 'ARS' ? totals.expenseARS += t.amount : totals.expenseUSD += t.amount; }
    });
    return totals;
  }

  function calculateMediumDistribution(month, year, entityId) {
    const distribution = {
      month: {
        efectivo: { incomeARS: 0, expenseARS: 0, incomeUSD: 0, expenseUSD: 0 },
        virtual:  { incomeARS: 0, expenseARS: 0, incomeUSD: 0, expenseUSD: 0 }
      },
      allTime: {
        efectivo: { incomeARS: 0, expenseARS: 0, incomeUSD: 0, expenseUSD: 0 },
        virtual:  { incomeARS: 0, expenseARS: 0, incomeUSD: 0, expenseUSD: 0 }
      }
    };

    state.transactions.forEach(t => {
      if (!filterTransactionByEntity(t, entityId)) return;

      const medium = t.medium; // 'efectivo' or 'virtual'
      if (medium !== 'efectivo' && medium !== 'virtual') return;

      const isARS = t.currency === 'ARS';
      const amount = t.amount;
      const isIncome = t.type === 'ingreso';

      // All-Time
      if (isIncome) {
        if (isARS) distribution.allTime[medium].incomeARS += amount;
        else distribution.allTime[medium].incomeUSD += amount;
      } else {
        if (isARS) distribution.allTime[medium].expenseARS += amount;
        else distribution.allTime[medium].expenseUSD += amount;
      }

      // Selected Month
      const d = new Date(t.date + 'T12:00:00');
      if (d.getMonth() === month && d.getFullYear() === year) {
        if (isIncome) {
          if (isARS) distribution.month[medium].incomeARS += amount;
          else distribution.month[medium].incomeUSD += amount;
        } else {
          if (isARS) distribution.month[medium].expenseARS += amount;
          else distribution.month[medium].expenseUSD += amount;
        }
      }
    });

    return distribution;
  }

  function buildMediumDistributionCardHTML(month, year, entityId, filterCurrency = 'all') {
    const dist = calculateMediumDistribution(month, year, entityId);
    const isUSD = filterCurrency === 'USD';
    const activeCurrency = isUSD ? 'USD' : 'ARS';

    const netEfectivo = isUSD
      ? dist.allTime.efectivo.incomeUSD - dist.allTime.efectivo.expenseUSD
      : dist.allTime.efectivo.incomeARS - dist.allTime.efectivo.expenseARS;

    const netVirtual = isUSD
      ? dist.allTime.virtual.incomeUSD - dist.allTime.virtual.expenseUSD
      : dist.allTime.virtual.incomeARS - dist.allTime.virtual.expenseARS;

    const absEfectivo = Math.max(0, netEfectivo);
    const absVirtual = Math.max(0, netVirtual);
    const totalNet = absEfectivo + absVirtual;

    let pctEfectivo = 50;
    let pctVirtual = 50;
    if (totalNet > 0) {
      pctEfectivo = Math.round((absEfectivo / totalNet) * 100);
      pctVirtual = 100 - pctEfectivo;
    } else if (absEfectivo === 0 && absVirtual === 0) {
      pctEfectivo = 0;
      pctVirtual = 0;
    }

    const barHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 2px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">
          <span>Distribución (${activeCurrency})</span>
          <span>EF: ${pctEfectivo}% | VI: ${pctVirtual}%</span>
        </div>
        <div style="height: 6px; border-radius: 3px; overflow: hidden; display: flex; background: rgba(255,255,255,0.04);">
          ${pctEfectivo > 0 ? `<div style="width: ${pctEfectivo}%; background: var(--income);"></div>` : ''}
          ${pctVirtual > 0 ? `<div style="width: ${pctVirtual}%; background: var(--accent);"></div>` : ''}
          ${(pctEfectivo === 0 && pctVirtual === 0) ? '<div style="width: 100%; background: rgba(255,255,255,0.06);"></div>' : ''}
        </div>
      </div>
    `;

    function formatFlow(amount, curr) {
      const symbol = curr === 'USD' ? 'US$ ' : '$ ';
      return symbol + amount.toLocaleString('es-AR', { maximumFractionDigits: 0 });
    }

    const currencies = [];
    if (filterCurrency === 'all' || filterCurrency === 'ARS') currencies.push('ARS');
    if (filterCurrency === 'all' || filterCurrency === 'USD') currencies.push('USD');

    let bodyHTML = '';
    currencies.forEach((curr, idx) => {
      const isARS = curr === 'ARS';
      const efNet = isARS
        ? dist.allTime.efectivo.incomeARS - dist.allTime.efectivo.expenseARS
        : dist.allTime.efectivo.incomeUSD - dist.allTime.efectivo.expenseUSD;

      const virtNet = isARS
        ? dist.allTime.virtual.incomeARS - dist.allTime.virtual.expenseARS
        : dist.allTime.virtual.incomeUSD - dist.allTime.virtual.expenseUSD;

      const efMonthInc = isARS ? dist.month.efectivo.incomeARS : dist.month.efectivo.incomeUSD;
      const efMonthExp = isARS ? dist.month.efectivo.expenseARS : dist.month.efectivo.expenseUSD;

      const virtMonthInc = isARS ? dist.month.virtual.incomeARS : dist.month.virtual.incomeUSD;
      const virtMonthExp = isARS ? dist.month.virtual.expenseARS : dist.month.virtual.expenseUSD;

      const efSign = efNet > 0 ? '▲' : (efNet < 0 ? '▼' : '—');
      const efColor = efNet > 0 ? 'var(--income)' : (efNet < 0 ? 'var(--expense)' : 'var(--text-muted)');

      const virtSign = virtNet > 0 ? '▲' : (virtNet < 0 ? '▼' : '—');
      const virtColor = virtNet > 0 ? 'var(--income)' : (virtNet < 0 ? 'var(--expense)' : 'var(--text-muted)');

      bodyHTML += `
        <div style="display: flex; flex-direction: column; gap: 4px; ${idx < currencies.length - 1 ? 'padding-bottom: 6px; border-bottom: 1px dashed rgba(255,255,255,0.04);' : ''}">
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700;">MEDIOS EN ${curr}</div>
          <div style="display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 0.8rem; font-weight: 600;">
              <span style="font-weight: normal; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--income); display: inline-block;"></span>💵 Efectivo
              </span>
              <span style="color: ${efColor}; display: flex; align-items: center; gap: 4px;">
                ${formatCurrency(efNet, curr)} <span style="font-size: 0.65rem;">${efSign}</span>
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-muted); padding-left: 10px;">
              <span>Este mes</span>
              <span>+${formatFlow(efMonthInc, curr)} | -${formatFlow(efMonthExp, curr)}</span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; margin-top: 2px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 0.8rem; font-weight: 600;">
              <span style="font-weight: normal; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--accent); display: inline-block;"></span>💳 Virtual
              </span>
              <span style="color: ${virtColor}; display: flex; align-items: center; gap: 4px;">
                ${formatCurrency(virtNet, curr)} <span style="font-size: 0.65rem;">${virtSign}</span>
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-muted); padding-left: 10px;">
              <span>Este mes</span>
              <span>+${formatFlow(virtMonthInc, curr)} | -${formatFlow(virtMonthExp, curr)}</span>
            </div>
          </div>
        </div>
      `;
    });

    return `
      <div class="summary-box-card neutral" style="min-height: 180px;">
        <div class="summary-box-inner">
          <div class="summary-box-header neutral" style="border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 10px;"><span class="dot" style="background: var(--text-muted); box-shadow: none;"></span>Dinero Disponible</div>
          <div class="summary-box-value-list" style="gap: 8px; justify-content: center;">
            ${barHTML}
            ${bodyHTML}
          </div>
        </div>
      </div>
    `;
  }

  // ─── Chart Data Builders ───

  function buildBarData(month, year, scope, currency) {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i, y = year;
      if (m < 0) { m += 12; y--; }
      const mt = calculateMonthTotals(m, y, scope);
      data.push({
        label: MONTH_NAMES[m].substring(0, 3),
        income:  currency === 'ARS' ? mt.incomeARS  : mt.incomeUSD,
        expense: currency === 'ARS' ? mt.expenseARS : mt.expenseUSD,
      });
    }
    return data;
  }

  function buildLineChartData(month, year, scope) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let runningBalance = 0;
    state.transactions
      .filter(t => {
        const d = new Date(t.date + 'T12:00:00');
        return filterTransactionByEntity(t, scope) && d < new Date(year, month, 1);
      })
      .forEach(t => { runningBalance += t.type === 'ingreso' ? t.amount : -t.amount; });

    const lineData = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      state.transactions
        .filter(t => t.date === dayStr && filterTransactionByEntity(t, scope))
        .forEach(t => { runningBalance += t.type === 'ingreso' ? t.amount : -t.amount; });
      lineData.push({ label: String(day), value: runningBalance });
    }
    return lineData;
  }

  // ─── Summary Boxes HTML Builder ───

  function buildSummaryBoxesHTML(monthTotals, allTimeTotals, filterCurrency, mediumHTML = '') {
    const filt = filterCurrency;

    function buildSide(type) {
      const cls  = type === 'income' ? 'income-val' : 'expense-val';
      const sign = type === 'income' ? '+' : '-';
      const mARS = type === 'income' ? monthTotals.incomeARS  : monthTotals.expenseARS;
      const mUSD = type === 'income' ? monthTotals.incomeUSD  : monthTotals.expenseUSD;
      const hARS = type === 'income' ? allTimeTotals.incomeARS  : allTimeTotals.expenseARS;
      const hUSD = type === 'income' ? allTimeTotals.incomeUSD  : allTimeTotals.expenseUSD;
      const netARS = allTimeTotals.incomeARS - allTimeTotals.expenseARS;
      const netUSD = allTimeTotals.incomeUSD - allTimeTotals.expenseUSD;

      let mainHTML = '';
      if (filt === 'all' || filt === 'ARS') mainHTML += `
        <div class="summary-box-value-item">
          <span class="summary-box-main-value ${cls}">${sign} ${formatCurrency(mARS, 'ARS')}</span>
          <span class="summary-box-net-label">ARS — este mes</span>
        </div>`;
      if (filt === 'all' || filt === 'USD') mainHTML += `
        <div class="summary-box-value-item">
          <span class="summary-box-main-value ${cls}">${sign} ${formatCurrency(mUSD, 'USD')}</span>
          <span class="summary-box-net-label">USD — este mes</span>
        </div>`;

      let footerRows = '';
      if (filt === 'all' || filt === 'ARS') footerRows += `
        <div class="summary-box-footer-item"><span>ARS Histórico</span><span>${sign} ${formatCurrency(hARS, 'ARS')}</span></div>
        <div class="summary-box-footer-item"><span>Neto ARS</span><span style="color:${netARS >= 0 ? 'var(--income)' : 'var(--expense)'}">${formatCurrency(netARS, 'ARS')}</span></div>`;
      if (filt === 'all' || filt === 'USD') footerRows += `
        <div class="summary-box-footer-item"><span>USD Histórico</span><span>${sign} ${formatCurrency(hUSD, 'USD')}</span></div>
        <div class="summary-box-footer-item"><span>Neto USD</span><span style="color:${netUSD >= 0 ? 'var(--income)' : 'var(--expense)'}">${formatCurrency(netUSD, 'USD')}</span></div>`;

      return { mainHTML, footerRows };
    }

    const inc = buildSide('income');
    const exp = buildSide('expense');
    return `
      <div class="summary-box-card income">
        <div class="summary-box-inner">
          <div class="summary-box-header income"><span class="dot"></span>Ingresos (+)</div>
          <div class="summary-box-value-list">${inc.mainHTML}</div>
          <div class="summary-box-divider"></div>
          <div class="summary-box-footer"><div class="summary-box-footer-title">Acumulado Total</div>${inc.footerRows}</div>
        </div>
      </div>
      ${mediumHTML}
      <div class="summary-box-card expense">
        <div class="summary-box-inner">
          <div class="summary-box-header expense"><span class="dot"></span>Gastos (-)</div>
          <div class="summary-box-value-list">${exp.mainHTML}</div>
          <div class="summary-box-divider"></div>
          <div class="summary-box-footer"><div class="summary-box-footer-title">Acumulado Total</div>${exp.footerRows}</div>
        </div>
      </div>`;
  }

  // ─── Navigation ───

  function navigate(view) {
    state.currentView = view;
    state.scopeFilter = { currency: 'all', medium: 'all' };
    state.editingTitleId = null;

    // Sync top nav (desktop)
    document.querySelectorAll('.nav-link[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Sync bottom nav (mobile)
    document.querySelectorAll('.bottom-nav-btn[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    document.querySelectorAll('.nav-dropdown-wrap').forEach(w => w.classList.remove('open'));

    const newBtn = document.getElementById('btn-new-transaction');
    if (newBtn) newBtn.style.display = (view === 'ajustes' || view === 'analisis' || view === 'metas') ? 'none' : 'inline-flex';

    updateDropdownMenus();
    renderStatsTicker();
    renderView();
  }

  function renderView() {
    const main = document.getElementById('main-content');
    main.innerHTML = '';
    switch (state.currentView) {
      case 'general':  renderGeneral(main); break;
      case 'negocio':  renderScopeView(main, 'negocio'); break;
      case 'personal': renderScopeView(main, 'personal'); break;
      case 'analisis': renderAnalisis(main); break;
      case 'metas':    renderMetas(main); break;
      case 'ajustes':  renderAjustes(main); break;
    }
  }

  // ─── Stats Ticker ───

  function renderStatsTicker() {
    const ticker = document.getElementById('stats-ticker');
    if (!ticker) return;
    const t = calculateAllTimeTotals();
    const netARS = t.incomeARS - t.expenseARS;
    const netUSD = t.incomeUSD - t.expenseUSD;
    const netPosARS = netARS >= 0;
    const netPosUSD = netUSD >= 0;

    ticker.innerHTML = `
      <!-- ── Balance Global destacado ── -->
      <div class="ticker-net-pill ${netPosARS ? 'positive' : 'negative'}" title="Balance neto histórico global">
        <span class="ticker-net-label">Balance Global</span>
        <div class="ticker-net-values">
          <span class="ticker-net-value ${netPosARS ? 'income' : 'expense'}">
            ${netPosARS ? '▲' : '▼'} ${formatCurrency(netARS, 'ARS')}
          </span>
          <span class="ticker-net-sep">/</span>
          <span class="ticker-net-value ${netPosUSD ? 'income' : 'expense'}">
            ${netPosUSD ? '▲' : '▼'} ${formatCurrency(netUSD, 'USD')}
          </span>
        </div>
      </div>
      <div class="ticker-divider"></div>
      <!-- ── Detalle ARS ── -->
      <div class="ticker-group">
        <span class="ticker-item income">
          <span class="ticker-arrow">↑</span>
          <span class="ticker-label">Ing. ARS</span>
          <span class="ticker-value">+ ${formatCurrency(t.incomeARS, 'ARS')}</span>
        </span>
        <span class="ticker-sep">|</span>
        <span class="ticker-item expense">
          <span class="ticker-arrow">↓</span>
          <span class="ticker-label">Gas. ARS</span>
          <span class="ticker-value">- ${formatCurrency(t.expenseARS, 'ARS')}</span>
        </span>
      </div>
      <div class="ticker-divider"></div>
      <!-- ── Detalle USD ── -->
      <div class="ticker-group">
        <span class="ticker-item income">
          <span class="ticker-arrow">↑</span>
          <span class="ticker-label">Ing. USD</span>
          <span class="ticker-value">+ ${formatCurrency(t.incomeUSD, 'USD')}</span>
        </span>
        <span class="ticker-sep">|</span>
        <span class="ticker-item expense">
          <span class="ticker-arrow">↓</span>
          <span class="ticker-label">Gas. USD</span>
          <span class="ticker-value">- ${formatCurrency(t.expenseUSD, 'USD')}</span>
        </span>
      </div>`;
  }

  // ─── Dropdown Menus ───

  function updateDropdownMenus() {
    ['negocio', 'personal'].forEach(scope => {
      const menu = document.getElementById(`dropdown-${scope}`);
      if (!menu) return;
      menu.innerHTML = '';

      state.entities.filter(e => e.type === scope).forEach(ent => {
        const item = document.createElement('div');
        const isActive = state.activeEntityId[scope] === ent.id && state.currentView === scope;
        item.className = `dropdown-item${isActive ? ' active' : ''}`;

        if (state.editingTitleId === ent.id) {
          item.innerHTML = `
            <input type="text" class="dropdown-rename-input" id="rename-input-${ent.id}" value="${ent.name}" maxlength="25">
            <button class="dropdown-rename-save" data-id="${ent.id}">✓</button>
            <button class="dropdown-rename-cancel" data-id="${ent.id}">✕</button>`;

          setTimeout(() => {
            const inp = document.getElementById(`rename-input-${ent.id}`);
            if (inp) {
              inp.focus();
              inp.select();
              // Scroll input into view so keyboard doesn't cover it on mobile
              inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 80);

          item.querySelector('.dropdown-rename-save').addEventListener('click', () => {
            const inp = document.getElementById(`rename-input-${ent.id}`);
            if (inp) renameEntity(ent.id, inp.value);
          });
          item.querySelector('.dropdown-rename-cancel').addEventListener('click', () => {
            state.editingTitleId = null;
            updateDropdownMenus();
          });
          item.querySelector('.dropdown-rename-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') { const inp = document.getElementById(`rename-input-${ent.id}`); if (inp) renameEntity(ent.id, inp.value); }
            if (e.key === 'Escape') { state.editingTitleId = null; updateDropdownMenus(); }
          });

        } else {
          item.innerHTML = `
            <span class="dropdown-item-name">${ent.name}</span>
            <button class="dropdown-item-rename" title="Renombrar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>`;

          item.querySelector('.dropdown-item-name').addEventListener('click', () => {
            state.activeEntityId[scope] = ent.id;
            document.querySelectorAll('.nav-dropdown-wrap').forEach(w => w.classList.remove('open'));
            navigate(scope);
          });
          item.querySelector('.dropdown-item-rename').addEventListener('click', e => {
            e.stopPropagation();
            state.editingTitleId = ent.id;
            updateDropdownMenus();
          });
        }
        menu.appendChild(item);
      });
    });
  }

  // ─── General View ───

  function renderGeneral(container) {
    const now   = new Date();
    const month = now.getMonth();
    const year  = now.getFullYear();

    const html = document.createElement('div');
    html.className = 'animate-in';

    // Label
    const lbl = document.createElement('div');
    lbl.className = 'view-section-header';
    lbl.innerHTML = `<span class="view-section-label">Resumen General — ${MONTH_NAMES[month]} ${year}</span>`;
    html.appendChild(lbl);

    // Summary boxes
    const monthTotals   = calculateMonthTotals(month, year);
    const allTimeTotals = calculateAllTimeTotals();
    const summaryRow = document.createElement('div');
    summaryRow.className = 'summary-row-3-col stagger';
    const mediumHTML = buildMediumDistributionCardHTML(month, year, 'todo', 'all');
    summaryRow.innerHTML = buildSummaryBoxesHTML(monthTotals, allTimeTotals, 'all', mediumHTML);
    html.appendChild(summaryRow);

    // Split
    const split = document.createElement('div');
    split.className = 'split-layout';

    // LEFT: table of all accounts this month
    const leftCol = document.createElement('div');
    leftCol.className = 'split-left';
    const colTitle = document.createElement('div');
    colTitle.className = 'col-section-title';
    colTitle.textContent = `Movimientos de ${MONTH_NAMES[month]} ${year} — Todas las cuentas`;
    leftCol.appendChild(colTitle);
    const tableContainer = document.createElement('div');
    tableContainer.id = 'general-table-container';
    leftCol.appendChild(tableContainer);

    // RIGHT: 3 charts stacked
    const rightCol = document.createElement('div');
    rightCol.className = 'split-right';

    const donutSec = document.createElement('div');
    donutSec.className = 'chart-section';
    donutSec.innerHTML = `<div class="chart-header"><span class="chart-title">Distribución de Gastos ARS — ${MONTH_NAMES[month]}</span></div>`;
    const donutCont = document.createElement('div');
    donutCont.className = 'chart-container';
    donutCont.id = 'general-donut';
    donutSec.appendChild(donutCont);
    rightCol.appendChild(donutSec);



    const barSec = document.createElement('div');
    barSec.className = 'chart-section';
    barSec.innerHTML = `
      <div class="chart-header">
        <span class="chart-title">Ingresos vs Gastos — 6 meses</span>
        <div class="chart-toggle-mini" id="general-currency-toggle">
          <button class="toggle-btn-mini ${state.dashboardCurrency === 'ARS' ? 'active' : ''}" data-currency="ARS">ARS</button>
          <button class="toggle-btn-mini ${state.dashboardCurrency === 'USD' ? 'active' : ''}" data-currency="USD">USD</button>
        </div>
      </div>`;
    const barCont = document.createElement('div');
    barCont.className = 'chart-container';
    barCont.id = 'general-bar';
    barSec.appendChild(barCont);
    rightCol.appendChild(barSec);

    split.appendChild(leftCol);
    split.appendChild(rightCol);
    html.appendChild(split);
    container.appendChild(html);

    renderGeneralTable(tableContainer, month, year);

    setTimeout(() => {
      // Donut
      const catMap = {};
      transactionsForMonth(month, year).filter(t => t.type === 'gasto' && t.currency === 'ARS')
        .forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
      const donutData = Object.entries(catMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
      const donutEl = document.getElementById('general-donut');
      if (donutEl) Charts.renderDonutChart(donutEl, donutData, { currency: 'ARS' });



      // Bar
      const barEl = document.getElementById('general-bar');
      if (barEl) Charts.renderBarChart(barEl, buildBarData(month, year, 'todo', state.dashboardCurrency));

      document.getElementById('general-currency-toggle')?.querySelectorAll('.toggle-btn-mini').forEach(btn => {
        btn.addEventListener('click', () => { state.dashboardCurrency = btn.dataset.currency; renderView(); });
      });
    }, 50);
  }

  function renderGeneralTable(container, month, year) {
    const txs = [...state.transactions]
      .filter(t => { const d = new Date(t.date + 'T12:00:00'); return d.getMonth() === month && d.getFullYear() === year; })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    if (txs.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:30px 16px"><p class="empty-state-text">Sin movimientos en ${MONTH_NAMES[month]} ${year}.<br>Usá <strong>Nuevo</strong> para agregar uno.</p></div>`;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'table-container';
    wrapper.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Fecha</th><th>Tipo</th><th>Categoría</th>
          <th class="col-desc">Descripción</th><th>Cuenta</th>
          <th class="col-medio">Medio</th><th>Monto</th>
        </tr></thead>
        <tbody id="general-tbody"></tbody>
      </table>`;
    container.appendChild(wrapper);

    const tbody = document.getElementById('general-tbody');
    txs.forEach(t => {
      const entityName = (state.entities.find(e => e.id === t.entityId) || {}).name || (t.scope === 'negocio' ? 'Negocio' : 'Personal');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(t.date)}</td>
        <td><span class="badge badge-${t.type}">${t.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</span></td>
        <td style="color:#fff;font-weight:500">${t.category}</td>
        <td class="col-desc">${t.description || '—'}</td>
        <td style="color:var(--text-muted);font-size:0.78rem">${entityName}</td>
        <td class="col-medio"><span class="badge badge-${t.medium}">${t.medium === 'efectivo' ? 'Efectivo' : 'Virtual'}</span></td>
        <td class="col-amount ${t.type === 'ingreso' ? 'income' : 'expense'}">${t.type === 'ingreso' ? '+' : '-'}${formatCurrency(t.amount, t.currency)}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ─── Scope View (Negocio / Personal) ───

  function renderScopeView(container, scope) {
    const activeEntityId = state.activeEntityId[scope];
    const activeEntity   = state.entities.find(e => e.id === activeEntityId);

    const html = document.createElement('div');
    html.className = 'animate-in';

    // Header
    const lbl = document.createElement('div');
    lbl.className = 'view-section-header';

    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      const entitiesOfScope = state.entities.filter(e => e.type === scope);
      let optionsHTML = '';
      entitiesOfScope.forEach(ent => {
        optionsHTML += `<option value="${ent.id}" ${ent.id === activeEntityId ? 'selected' : ''}>${ent.name}</option>`;
      });

      lbl.innerHTML = `
        <div class="mobile-scope-header-wrap">
          <div class="mobile-entity-selector-wrap">
            <span class="mobile-entity-label" id="mobile-entity-label-text">${activeEntity?.name || scope}</span>
            <svg class="dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            <select class="mobile-entity-select" id="mobile-entity-select">
              ${optionsHTML}
            </select>
          </div>
          <button class="btn-rename-entity-mobile" id="btn-rename-entity-mobile" title="Renombrar cuenta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <span class="view-section-date-separator">•</span>
          <span class="view-section-date-label">${getMonthLabel()}</span>
        </div>
      `;
    } else {
      lbl.innerHTML = `<span class="view-section-label">${activeEntity?.name || scope} — ${getMonthLabel()}</span>`;
    }
    html.appendChild(lbl);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'scope-controls';
    controls.innerHTML = `
      <div class="month-selector">
        <button class="month-btn" id="prev-month">‹</button>
        <span class="month-label" id="month-label">${getMonthLabel()}</span>
        <button class="month-btn" id="next-month">›</button>
      </div>
      <div class="filters">
        <button class="filter-btn ${state.scopeFilter.currency === 'all' ? 'active' : ''}" data-filter-currency="all">Todas</button>
        <button class="filter-btn ${state.scopeFilter.currency === 'ARS' ? 'active' : ''}" data-filter-currency="ARS">ARS</button>
        <button class="filter-btn ${state.scopeFilter.currency === 'USD' ? 'active' : ''}" data-filter-currency="USD">USD</button>
        <span class="filter-sep"></span>
        <button class="filter-btn ${state.scopeFilter.medium === 'all'      ? 'active' : ''}" data-filter-medium="all">Todos</button>
        <button class="filter-btn ${state.scopeFilter.medium === 'efectivo' ? 'active' : ''}" data-filter-medium="efectivo">Efectivo</button>
        <button class="filter-btn ${state.scopeFilter.medium === 'virtual'  ? 'active' : ''}" data-filter-medium="virtual">Virtual</button>
      </div>`;
    html.appendChild(controls);

    // Summary boxes
    const monthTotals   = calculateFilteredMonthTotals(state.selectedMonth, state.selectedYear, activeEntityId);
    const allTimeTotals = calculateFilteredAllTimeTotals(activeEntityId);
    const summaryRow = document.createElement('div');
    summaryRow.className = 'summary-row-3-col stagger';
    summaryRow.id = 'scope-summary';
    const mediumHTML = buildMediumDistributionCardHTML(state.selectedMonth, state.selectedYear, activeEntityId, state.scopeFilter.currency);
    summaryRow.innerHTML = buildSummaryBoxesHTML(monthTotals, allTimeTotals, state.scopeFilter.currency, mediumHTML);
    html.appendChild(summaryRow);

    // Split layout
    const split = document.createElement('div');
    split.className = 'split-layout';

    // LEFT: table
    const leftCol = document.createElement('div');
    leftCol.className = 'split-left';
    const tableSection = document.createElement('div');
    tableSection.id = 'scope-table-container';
    leftCol.appendChild(tableSection);

    // RIGHT: donut → line → bar stacked
    const rightCol = document.createElement('div');
    rightCol.className = 'split-right';

    const donutSec = document.createElement('div');
    donutSec.className = 'chart-section';
    donutSec.innerHTML = `<div class="chart-header"><span class="chart-title">Distribución de Gastos</span></div>`;
    const donutCont = document.createElement('div');
    donutCont.className = 'chart-container';
    donutCont.id = 'scope-donut';
    donutSec.appendChild(donutCont);
    rightCol.appendChild(donutSec);

    const barSec = document.createElement('div');
    barSec.className = 'chart-section';
    barSec.innerHTML = `<div class="chart-header"><span class="chart-title">Ingresos vs Gastos — 6 meses</span></div>`;
    const barCont = document.createElement('div');
    barCont.className = 'chart-container';
    barCont.id = 'scope-bar';
    barSec.appendChild(barCont);
    rightCol.appendChild(barSec);

    split.appendChild(leftCol);
    split.appendChild(rightCol);
    html.appendChild(split);
    container.appendChild(html);

    // Wire mobile account switcher listeners if rendered
    if (isMobile) {
      const selectEl = html.querySelector('#mobile-entity-select');
      selectEl?.addEventListener('change', e => {
        state.activeEntityId[scope] = e.target.value;
        renderView();
        updateDropdownMenus();
      });

      const renameBtn = html.querySelector('#btn-rename-entity-mobile');
      renameBtn?.addEventListener('click', () => {
        const newName = prompt('Renombrar cuenta:', activeEntity?.name || '');
        if (newName && newName.trim()) {
          renameEntity(activeEntityId, newName.trim());
        }
      });
    }

    renderScopeTable(scope);
    renderScopeCharts(scope);
    setupScopeListeners(scope);
  }

  function renderScopeCharts(scope) {
    const activeEntityId = state.activeEntityId[scope];
    const month    = state.selectedMonth;
    const year     = state.selectedYear;
    const currency = state.scopeFilter.currency === 'all' ? 'ARS' : state.scopeFilter.currency;
    const filterC  = state.scopeFilter.currency;

    setTimeout(() => {
      // Donut
      const catMap = {};
      transactionsForMonth(month, year, activeEntityId)
        .filter(t => t.type === 'gasto' && (filterC === 'all' || t.currency === filterC))
        .forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
      const donutData = Object.entries(catMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
      const donutEl = document.getElementById('scope-donut');
      if (donutEl) Charts.renderDonutChart(donutEl, donutData, { currency });



      // Bar
      const barEl = document.getElementById('scope-bar');
      if (barEl) Charts.renderBarChart(barEl, buildBarData(month, year, activeEntityId, currency));
    }, 50);
  }

  function renderScopeTable(scope) {
    const tableSection = document.getElementById('scope-table-container');
    if (!tableSection) return;
    tableSection.innerHTML = '';

    const activeEntityId = state.activeEntityId[scope];
    let txs = applyFilters(transactionsForMonth(state.selectedMonth, state.selectedYear, activeEntityId));
    txs.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    if (txs.length === 0) {
      tableSection.innerHTML = `
        <div class="table-container">
          <div class="empty-state">
            <svg class="empty-state-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/></svg>
            <p class="empty-state-text">Sin movimientos para ${getMonthLabel()}</p>
            <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-new-transaction').click()">+ Agregar</button>
          </div>
        </div>`;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'table-container';
    wrapper.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Fecha</th><th>Tipo</th><th>Categoría</th>
          <th class="col-desc">Descripción</th><th class="col-medio">Medio</th>
          <th>Monto</th><th class="col-actions"></th>
        </tr></thead>
        <tbody id="scope-tbody"></tbody>
      </table>`;
    tableSection.appendChild(wrapper);

    const tbody = document.getElementById('scope-tbody');
    txs.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(t.date)}</td>
        <td><span class="badge badge-${t.type}">${t.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</span></td>
        <td style="color:#fff;font-weight:500">${t.category}</td>
        <td class="col-desc">${t.description || '—'}</td>
        <td class="col-medio"><span class="badge badge-${t.medium}">${t.medium === 'efectivo' ? 'Efectivo' : 'Virtual'}</span></td>
        <td class="col-amount ${t.type === 'ingreso' ? 'income' : 'expense'}">${t.type === 'ingreso' ? '+' : '-'}${formatCurrency(t.amount, t.currency)}</td>
        <td class="col-actions">
          <button class="btn-icon btn-edit" data-id="${t.id}" title="Editar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon btn-delete" data-id="${t.id}" title="Eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.id)));
    tbody.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => confirmDelete(btn.dataset.id)));
  }

  function setupScopeListeners(scope) {
    document.getElementById('prev-month')?.addEventListener('click', () => {
      state.selectedMonth--;
      if (state.selectedMonth < 0) { state.selectedMonth = 11; state.selectedYear--; }
      updateScopeView(scope);
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
      state.selectedMonth++;
      if (state.selectedMonth > 11) { state.selectedMonth = 0; state.selectedYear++; }
      updateScopeView(scope);
    });
    document.querySelectorAll('[data-filter-currency]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter-currency]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.scopeFilter.currency = btn.dataset.filterCurrency;
        updateScopeView(scope);
      });
    });
    document.querySelectorAll('[data-filter-medium]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter-medium]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.scopeFilter.medium = btn.dataset.filterMedium;
        updateScopeView(scope);
      });
    });
  }

  function updateScopeView(scope) {
    const activeEntityId = state.activeEntityId[scope];
    const monthTotals   = calculateFilteredMonthTotals(state.selectedMonth, state.selectedYear, activeEntityId);
    const allTimeTotals = calculateFilteredAllTimeTotals(activeEntityId);
    const lbl = document.getElementById('month-label');
    if (lbl) lbl.textContent = getMonthLabel();
    const summary = document.getElementById('scope-summary');
    if (summary) {
      const mediumHTML = buildMediumDistributionCardHTML(state.selectedMonth, state.selectedYear, activeEntityId, state.scopeFilter.currency);
      summary.innerHTML = buildSummaryBoxesHTML(monthTotals, allTimeTotals, state.scopeFilter.currency, mediumHTML);
    }
    renderScopeTable(scope);
    renderScopeCharts(scope);
  }

  // ─── Análisis View ───

  function renderAnalisis(container) {
    const html = document.createElement('div');
    html.className = 'animate-in';

    // Controls header
    const header = document.createElement('div');
    header.className = 'view-section-header';
    header.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div class="month-selector">
          <button class="month-btn" id="prev-month">‹</button>
          <span class="month-label" id="month-label">${getMonthLabel()}</span>
          <button class="month-btn" id="next-month">›</button>
        </div>
        <select class="form-select" id="analysis-entity-select" style="width:auto;min-width:180px;padding:6px 30px 6px 10px;font-size:0.82rem;height:auto;">
          <option value="todo">Todas las cuentas</option>
          <option value="negocio">Consolidado Negocio</option>
          <option value="personal">Consolidado Personal</option>
          <optgroup label="Negocios" id="analysis-optgroup-negocios"></optgroup>
          <optgroup label="Cuentas Personales" id="analysis-optgroup-personales"></optgroup>
        </select>
        <div class="currency-tabs">
          <button class="currency-tab ${state.analysisCurrency === 'ARS' ? 'active' : ''}" data-currency="ARS">ARS</button>
          <button class="currency-tab ${state.analysisCurrency === 'USD' ? 'active' : ''}" data-currency="USD">USD</button>
        </div>
      </div>`;
    html.appendChild(header);

    // Populate options
    state.entities.forEach(ent => {
      const opt = document.createElement('option');
      opt.value = ent.id;
      opt.textContent = ent.name;
      opt.selected = state.analysisScope === ent.id;
      header.querySelector(ent.type === 'negocio' ? '#analysis-optgroup-negocios' : '#analysis-optgroup-personales').appendChild(opt);
    });
    header.querySelector('#analysis-entity-select').value = state.analysisScope;

    // Section label
    const sectionLbl = document.createElement('div');
    sectionLbl.style.cssText = 'font-size:0.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin:14px 0 10px;';
    sectionLbl.id = 'analysis-section-label';
    sectionLbl.textContent = `Resumen del mes — ${getMonthLabel()}`;
    html.appendChild(sectionLbl);

    // Summary boxes
    const summaryRow = document.createElement('div');
    summaryRow.className = 'summary-row-3-col stagger';
    summaryRow.id = 'analysis-summary-row';
    html.appendChild(summaryRow);

    // Split layout
    const split = document.createElement('div');
    split.className = 'split-layout';

    // LEFT: bar chart (wide)
    const leftCol = document.createElement('div');
    leftCol.className = 'split-left';
    const barSec = document.createElement('div');
    barSec.className = 'chart-section';
    barSec.innerHTML = `<div class="chart-header"><span class="chart-title">Ingresos vs Gastos — últimos 6 meses (${state.analysisCurrency})</span></div>`;
    const barCont = document.createElement('div');
    barCont.className = 'chart-container';
    barCont.id = 'analisis-bar';
    barSec.appendChild(barCont);
    leftCol.appendChild(barSec);

    // RIGHT: donut + line stacked
    const rightCol = document.createElement('div');
    rightCol.className = 'split-right';

    const donutSec = document.createElement('div');
    donutSec.className = 'chart-section';
    donutSec.innerHTML = `<div class="chart-header"><span class="chart-title">Distribución de Gastos</span></div>`;
    const donutCont = document.createElement('div');
    donutCont.className = 'chart-container';
    donutCont.id = 'analisis-donut';
    donutSec.appendChild(donutCont);
    rightCol.appendChild(donutSec);



    split.appendChild(leftCol);
    split.appendChild(rightCol);
    html.appendChild(split);
    container.appendChild(html);

    renderAnalysisSummary();
    renderAnalisisCharts();
    setupAnalisisListeners();
  }

  function renderAnalysisSummary() {
    const row = document.getElementById('analysis-summary-row');
    if (!row) return;
    const monthTotals   = calculateMonthTotals(state.selectedMonth, state.selectedYear, state.analysisScope);
    const allTimeTotals = calculateAllTimeTotals(state.analysisScope);
    const mediumHTML = buildMediumDistributionCardHTML(state.selectedMonth, state.selectedYear, state.analysisScope, state.analysisCurrency);
    row.innerHTML = buildSummaryBoxesHTML(monthTotals, allTimeTotals, state.analysisCurrency, mediumHTML);
  }

  function renderAnalisisCharts() {
    const scope    = state.analysisScope;
    const currency = state.analysisCurrency;
    const month    = state.selectedMonth;
    const year     = state.selectedYear;

    setTimeout(() => {
      const barEl = document.getElementById('analisis-bar');
      if (barEl) Charts.renderBarChart(barEl, buildBarData(month, year, scope, currency));

      const txs = transactionsForMonth(month, year, scope).filter(t => t.type === 'gasto' && t.currency === currency);
      const catMap = {};
      txs.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
      const donutData = Object.entries(catMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
      const donutEl = document.getElementById('analisis-donut');
      if (donutEl) Charts.renderDonutChart(donutEl, donutData, { currency });


    }, 50);
  }

  function setupAnalisisListeners() {
    const updateLabel = () => {
      const lbl = document.getElementById('analysis-section-label');
      if (lbl) lbl.textContent = `Resumen del mes — ${getMonthLabel()}`;
      const mlbl = document.getElementById('month-label');
      if (mlbl) mlbl.textContent = getMonthLabel();
    };

    document.getElementById('prev-month')?.addEventListener('click', () => {
      state.selectedMonth--;
      if (state.selectedMonth < 0) { state.selectedMonth = 11; state.selectedYear--; }
      updateLabel(); renderAnalysisSummary(); renderAnalisisCharts();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
      state.selectedMonth++;
      if (state.selectedMonth > 11) { state.selectedMonth = 0; state.selectedYear++; }
      updateLabel(); renderAnalysisSummary(); renderAnalisisCharts();
    });
    document.querySelectorAll('.currency-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.currency-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.analysisCurrency = tab.dataset.currency;
        renderAnalysisSummary(); renderAnalisisCharts();
      });
    });
    const entitySelect = document.getElementById('analysis-entity-select');
    if (entitySelect) {
      entitySelect.addEventListener('change', e => {
        state.analysisScope = e.target.value;
        renderAnalysisSummary(); renderAnalisisCharts();
      });
    }
  }

  // ─── Ajustes View ───

  function renderAjustes(container) {
    const html = document.createElement('div');
    html.className = 'animate-in';

    const dataSection = document.createElement('div');
    dataSection.className = 'settings-section';
    dataSection.innerHTML = `
      <div class="settings-section-title">Datos</div>
      <div class="settings-item">
        <div class="settings-item-info">
          <span class="settings-item-label">Exportar datos</span>
          <span class="settings-item-desc">Descargar todos tus datos como archivo JSON</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-export">Exportar</button>
      </div>
      <div class="settings-item">
        <div class="settings-item-info">
          <span class="settings-item-label">Importar datos</span>
          <span class="settings-item-desc">Restaurar datos desde un archivo JSON</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-import">Importar</button>
      </div>
      <div class="settings-item">
        <div class="settings-item-info">
          <span class="settings-item-label">Borrar todos los datos</span>
          <span class="settings-item-desc">Eliminar permanentemente todos los movimientos y categorías</span>
        </div>
        <button class="btn btn-danger btn-sm" id="btn-clear-all">Borrar todo</button>
      </div>`;
    html.appendChild(dataSection);

    const catSection = document.createElement('div');
    catSection.className = 'settings-section';
    catSection.id = 'settings-categories-section';
    html.appendChild(catSection);

    const totalTx      = state.transactions.length;
    const totalIncome  = state.transactions.filter(t => t.type === 'ingreso').length;
    const totalExpense = state.transactions.filter(t => t.type === 'gasto').length;
    const statsSection = document.createElement('div');
    statsSection.className = 'settings-section';
    statsSection.innerHTML = `
      <div class="settings-section-title">Estadísticas</div>
      <div class="settings-item"><div class="settings-item-info"><span class="settings-item-label">Total de movimientos</span></div><span style="color:#fff;font-weight:600">${totalTx}</span></div>
      <div class="settings-item"><div class="settings-item-info"><span class="settings-item-label">Ingresos registrados</span></div><span style="color:var(--income);font-weight:600">${totalIncome}</span></div>
      <div class="settings-item"><div class="settings-item-info"><span class="settings-item-label">Gastos registrados</span></div><span style="color:var(--expense);font-weight:600">${totalExpense}</span></div>`;
    html.appendChild(statsSection);

    const aboutSection = document.createElement('div');
    aboutSection.className = 'settings-section';
    aboutSection.innerHTML = `
      <div class="settings-section-title">Acerca de</div>
      <div class="settings-item">
        <div class="settings-item-info">
          <span class="settings-item-label">RM Conquest Proyect</span>
          <span class="settings-item-desc">Gestor personal de finanzas — v2.0</span>
          <span class="settings-item-desc" style="margin-top:4px">Tus datos se almacenan localmente en este navegador. Sin servidores.</span>
        </div>
      </div>`;
    html.appendChild(aboutSection);
    container.appendChild(html);

    renderSettingsCategories(catSection);

    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('file-import').click());
    document.getElementById('btn-clear-all').addEventListener('click', () => {
      showConfirm('¿Estás seguro de que querés eliminar TODOS los datos? Esta acción no se puede deshacer.', () => {
        state.transactions = [];
        state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        saveData();
        navigate('ajustes');
      });
    });
  }

  function renderSettingsCategories(container) {
    if (!container) return;
    const scope = state.settingsCatScope;
    const type  = state.settingsCatType;
    const categoriesList = state.categories[scope]?.[type] || [];

    container.innerHTML = `
      <div class="settings-section-title">Gestionar Categorías</div>
      <div style="padding:20px 20px 10px;">
        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
          <div class="scope-tabs" id="settings-cat-scope-tabs">
            <button class="scope-tab ${scope === 'negocio' ? 'active' : ''}" data-scope="negocio">Negocio</button>
            <button class="scope-tab ${scope === 'personal' ? 'active' : ''}" data-scope="personal">Personal</button>
          </div>
          <div class="scope-tabs" id="settings-cat-type-tabs">
            <button class="scope-tab ${type === 'ingreso' ? 'active' : ''}" data-type="ingreso">Ingresos</button>
            <button class="scope-tab ${type === 'gasto' ? 'active' : ''}" data-type="gasto">Gastos</button>
          </div>
        </div>
        <div id="category-manager-list"></div>
        <form id="category-add-form" style="display:flex;gap:10px;margin-top:16px;">
          <input type="text" id="category-add-input" class="form-input" placeholder="Nueva categoría..." required maxlength="25">
          <button type="submit" class="btn btn-primary" style="padding:8px 14px;">Agregar</button>
        </form>
      </div>`;

    const listEl = container.querySelector('#category-manager-list');
    if (categoriesList.length === 0) {
      listEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem;">No hay categorías</span>';
    } else {
      categoriesList.forEach(cat => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:6px;background:var(--bg-base);';
        const label = document.createElement('span');
        label.textContent = cat;
        label.style.cssText = 'font-size:0.87rem;color:#fff;flex:1;';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon';
        deleteBtn.style.cssText = 'width:24px;height:24px;color:var(--text-muted);';
        deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        deleteBtn.title = 'Eliminar';
        if (categoriesList.length <= 1) { deleteBtn.disabled = true; deleteBtn.style.opacity = '0.3'; }
        else {
          deleteBtn.addEventListener('click', () => {
            state.categories[scope][type] = state.categories[scope][type].filter(c => c !== cat);
            saveData();
            renderSettingsCategories(container);
          });
        }
        item.appendChild(label);
        item.appendChild(deleteBtn);
        listEl.appendChild(item);
      });
    }

    container.querySelector('#settings-cat-scope-tabs').querySelectorAll('.scope-tab').forEach(tab => {
      tab.addEventListener('click', () => { state.settingsCatScope = tab.dataset.scope; renderSettingsCategories(container); });
    });
    container.querySelector('#settings-cat-type-tabs').querySelectorAll('.scope-tab').forEach(tab => {
      tab.addEventListener('click', () => { state.settingsCatType = tab.dataset.type; renderSettingsCategories(container); });
    });
    container.querySelector('#category-add-form').addEventListener('submit', e => {
      e.preventDefault();
      const input = container.querySelector('#category-add-input');
      const newCat = input.value.trim();
      if (!newCat) return;
      if (categoriesList.some(c => c.toLowerCase() === newCat.toLowerCase())) { alert('Esta categoría ya existe.'); input.focus(); return; }
      state.categories[scope][type].push(newCat);
      saveData();
      input.value = '';
      renderSettingsCategories(container);
    });
  }

  // ─── Export / Import ───

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'RM Conquest Proyect', version: '2.0', exportDate: new Date().toISOString(), transactions: state.transactions, categories: state.categories }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rm_conquest_backup_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.transactions && Array.isArray(data.transactions)) {
          showConfirm('¿Querés reemplazar todos los datos actuales con los del archivo importado?', () => {
            state.transactions = data.transactions;
            if (data.categories) state.categories = data.categories;
            saveData();
            navigate(state.currentView);
          });
        } else { alert('El archivo no contiene datos válidos.'); }
      } catch (err) { alert('Error al leer el archivo: ' + err.message); }
    };
    reader.readAsText(file);
  }

  // ─── Modal ───

  function openModal(editId) {
    state.editingId = editId || null;
    const overlay = document.getElementById('modal-overlay');
    const title   = document.getElementById('modal-title');
    const form    = document.getElementById('transaction-form');

    title.textContent = editId ? 'Editar Movimiento' : 'Nuevo Movimiento';
    form.reset();
    document.getElementById('field-date').value = todayStr();

    setToggleValue('toggle-type', 'ingreso');
    setToggleValue('toggle-currency', 'ARS');
    setToggleValue('toggle-medium', 'efectivo');

    const scopeDefault = state.currentView === 'personal' ? 'personal' : 'negocio';
    setToggleValue('toggle-scope', scopeDefault);
    updateModalEntityOptions();
    updateCategoryOptions();

    if (editId) {
      const t = state.transactions.find(tx => tx.id === editId);
      if (t) {
        setToggleValue('toggle-type', t.type);
        setToggleValue('toggle-currency', t.currency);
        setToggleValue('toggle-medium', t.medium);
        setToggleValue('toggle-scope', t.scope);
        updateModalEntityOptions();
        setToggleValue('toggle-entity', t.entityId);
        updateCategoryOptions();
        document.getElementById('field-amount').value = t.amount;
        document.getElementById('field-description').value = t.description || '';
        document.getElementById('field-date').value = t.date;
        document.getElementById('field-category').value = t.category;
      }
    }
    overlay.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    state.editingId = null;
  }

  function getToggleValue(groupId) {
    const group = document.getElementById(groupId);
    return group?.querySelector('.toggle-btn.active')?.dataset.value || '';
  }

  function setToggleValue(groupId, value) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === value));
  }

  function updateModalEntityOptions() {
    const scope = getToggleValue('toggle-scope');
    const container = document.getElementById('toggle-entity');
    if (!container) return;
    container.innerHTML = '';
    state.entities.filter(e => e.type === scope).forEach((ent, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `toggle-btn ${idx === 0 ? 'active' : ''}`;
      btn.dataset.value = ent.id;
      btn.textContent = ent.name;
      btn.addEventListener('click', () => {
        container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      container.appendChild(btn);
    });
  }

  function updateCategoryOptions() {
    const type  = getToggleValue('toggle-type');
    const scope = getToggleValue('toggle-scope');
    const select = document.getElementById('field-category');
    const cats = [...(state.categories[scope]?.[type] || ['Otros'])];
    if (state.editingId) {
      const t = state.transactions.find(tx => tx.id === state.editingId);
      if (t && t.type === type && t.scope === scope && !cats.includes(t.category)) cats.push(t.category);
    }
    select.innerHTML = '';
    cats.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; select.appendChild(opt); });
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('field-amount').value);
    if (isNaN(amount) || amount <= 0) { document.getElementById('field-amount').focus(); return; }

    const transaction = {
      id: state.editingId || generateId(),
      type: getToggleValue('toggle-type'),
      amount,
      currency: getToggleValue('toggle-currency'),
      medium: getToggleValue('toggle-medium'),
      scope: getToggleValue('toggle-scope'),
      entityId: getToggleValue('toggle-entity'),
      category: document.getElementById('field-category').value,
      description: document.getElementById('field-description').value.trim(),
      date: document.getElementById('field-date').value,
    };

    if (state.editingId) {
      const idx = state.transactions.findIndex(t => t.id === state.editingId);
      if (idx >= 0) state.transactions[idx] = transaction;
    } else {
      state.transactions.push(transaction);
    }

    if (transaction.scope === 'negocio' || transaction.scope === 'personal') {
      state.activeEntityId[transaction.scope] = transaction.entityId;
    }

    saveData();
    closeModal();
    renderStatsTicker();
    renderView();
  }

  // ─── Confirm Dialog ───

  let confirmCallback = null;

  function showConfirm(message, onConfirm) {
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-overlay').classList.remove('hidden');
    confirmCallback = onConfirm;
  }

  function hideConfirm() {
    document.getElementById('confirm-overlay').classList.add('hidden');
    confirmCallback = null;
  }

  function confirmDelete(id) {
    showConfirm('¿Estás seguro de que querés eliminar este movimiento?', () => {
      state.transactions = state.transactions.filter(t => t.id !== id);
      saveData();
      renderStatsTicker();
      renderView();
    });
  }

  // ─── Metas & Ganancias Section ───

  let editingGoalId = null;

  function openGoalModal(goalId = null) {
    editingGoalId = goalId || null;
    const overlay = document.getElementById('goal-modal-overlay');
    const title   = document.getElementById('goal-modal-title');
    const form    = document.getElementById('goal-form');

    title.textContent = goalId ? 'Editar Meta' : 'Nueva Meta';
    form.reset();

    setToggleValue('goal-toggle-type', 'gasto');
    setToggleValue('goal-toggle-scope', 'negocio');
    setToggleValue('goal-toggle-currency', 'ARS');

    updateGoalModalEntityOptions();
    updateGoalCategoryOptions();

    if (goalId) {
      const g = state.goals.find(goal => goal.id === goalId);
      if (g) {
        setToggleValue('goal-toggle-type', g.type);
        setToggleValue('goal-toggle-scope', g.scope);
        setToggleValue('goal-toggle-currency', g.currency);
        updateGoalModalEntityOptions();
        document.getElementById('goal-entity-select').value = g.entityId;
        updateGoalCategoryOptions();
        document.getElementById('goal-category-select').value = g.category;
        document.getElementById('goal-amount').value = g.amount;
      }
    }
    overlay.classList.remove('hidden');
  }

  function closeGoalModal() {
    document.getElementById('goal-modal-overlay').classList.add('hidden');
    editingGoalId = null;
  }

  function updateGoalModalEntityOptions() {
    const scope = getToggleValue('goal-toggle-scope');
    const select = document.getElementById('goal-entity-select');
    if (!select) return;
    select.innerHTML = '';
    state.entities.filter(e => e.type === scope).forEach(ent => {
      const opt = document.createElement('option');
      opt.value = ent.id;
      opt.textContent = ent.name;
      select.appendChild(opt);
    });
  }

  function updateGoalCategoryOptions() {
    const type  = getToggleValue('goal-toggle-type');
    const scope = getToggleValue('goal-toggle-scope');
    const select = document.getElementById('goal-category-select');
    if (!select) return;
    const cats = [...(state.categories[scope]?.[type] || ['Otros'])];
    select.innerHTML = '';
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
  }

  function handleGoalFormSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('goal-amount').value);
    if (isNaN(amount) || amount <= 0) { document.getElementById('goal-amount').focus(); return; }

    const goal = {
      id: editingGoalId || generateId(),
      type: getToggleValue('goal-toggle-type'),
      scope: getToggleValue('goal-toggle-scope'),
      entityId: document.getElementById('goal-entity-select').value,
      category: document.getElementById('goal-category-select').value,
      currency: getToggleValue('goal-toggle-currency'),
      amount,
      active: true
    };

    if (!state.goals) state.goals = [];

    if (editingGoalId) {
      const idx = state.goals.findIndex(g => g.id === editingGoalId);
      if (idx >= 0) state.goals[idx] = goal;
    } else {
      state.goals.push(goal);
    }

    saveData();
    closeGoalModal();
    renderView();
  }

  function calculateGoalProgress(goal, month, year) {
    const txs = state.transactions.filter(t => {
      const d = new Date(t.date + 'T12:00:00');
      return t.entityId === goal.entityId &&
             d.getMonth() === month &&
             d.getFullYear() === year &&
             t.category === goal.category &&
             t.currency === goal.currency &&
             t.type === goal.type;
    });

    const total = txs.reduce((sum, t) => sum + t.amount, 0);
    const pct = goal.amount > 0 ? (total / goal.amount) * 100 : 0;
    return { total, pct };
  }

  function renderMetas(container) {
    const html = document.createElement('div');
    html.className = 'animate-in';

    // Header
    const header = document.createElement('div');
    header.className = 'view-section-header';
    header.style.marginBottom = '20px';
    header.innerHTML = `
      <span class="view-section-label">Metas & Ganancias</span>
      <div style="display: flex; gap: 12px; align-items: center;">
        <div class="sub-tab-group" style="display: flex; background: rgba(255,255,255,0.05); padding: 3px; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <button class="sub-tab-btn ${state.metasSubTab === 'presupuestos' ? 'active' : ''}" data-subtab="presupuestos" style="padding: 6px 12px; font-size: 0.8rem; border-radius: var(--radius-sm); border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.2s;">Presupuestos</button>
          <button class="sub-tab-btn ${state.metasSubTab === 'ganancias' ? 'active' : ''}" data-subtab="ganancias" style="padding: 6px 12px; font-size: 0.8rem; border-radius: var(--radius-sm); border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.2s;">Ganancias</button>
        </div>
        <button class="btn btn-primary" id="btn-new-goal" style="height: 32px; font-size: 0.8rem; padding: 0 12px; gap: 4px; display: ${state.metasSubTab === 'presupuestos' ? 'inline-flex' : 'none'}; align-items: center; border-radius: var(--radius-sm);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva Meta
        </button>
      </div>
    `;
    html.appendChild(header);

    // Subview wrapper
    const subviewWrapper = document.createElement('div');
    subviewWrapper.id = 'metas-subview-container';
    html.appendChild(subviewWrapper);
    container.appendChild(html);

    // Hook up sub-tab buttons
    header.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.metasSubTab = btn.dataset.subtab;
        header.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.subtab === state.metasSubTab));
        const newGoalBtn = document.getElementById('btn-new-goal');
        if (newGoalBtn) newGoalBtn.style.display = state.metasSubTab === 'presupuestos' ? 'inline-flex' : 'none';
        renderMetasSubview(subviewWrapper);
      });
    });

    const newGoalBtn = document.getElementById('btn-new-goal');
    if (newGoalBtn) {
      newGoalBtn.addEventListener('click', () => openGoalModal());
    }

    renderMetasSubview(subviewWrapper);
  }

  function renderMetasSubview(wrapper) {
    wrapper.innerHTML = '';
    if (state.metasSubTab === 'presupuestos') {
      renderPresupuestos(wrapper);
    } else {
      renderGanancias(wrapper);
    }
  }

  function renderPresupuestos(container) {
    state.goalFilterEntity = state.goalFilterEntity || 'all';

    const controls = document.createElement('div');
    controls.className = 'scope-controls';
    controls.style.marginBottom = '20px';

    // Account options select
    let entityOptions = '<option value="all">Todas las cuentas</option>';
    state.entities.forEach(ent => {
      entityOptions += `<option value="${ent.id}" ${state.goalFilterEntity === ent.id ? 'selected' : ''}>${ent.name}</option>`;
    });

    controls.innerHTML = `
      <div class="month-selector">
        <button class="month-btn" id="prev-month-goals">‹</button>
        <span class="month-label" id="month-label-goals">${getMonthLabel()}</span>
        <button class="month-btn" id="next-month-goals">›</button>
      </div>
      <div style="display: flex; gap: 12px; align-items: center;">
        <span style="font-size: 0.8rem; color: var(--text-muted);">Filtrar Cuenta:</span>
        <select id="goal-filter-entity" class="form-select" style="max-width: 200px; height: 32px; padding: 0 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-primary);">
          ${entityOptions}
        </select>
      </div>
    `;
    container.appendChild(controls);

    // Event listeners for month changes
    document.getElementById('prev-month-goals').addEventListener('click', () => {
      state.selectedMonth--;
      if (state.selectedMonth < 0) { state.selectedMonth = 11; state.selectedYear--; }
      renderMetasSubview(container.parentNode);
    });

    document.getElementById('next-month-goals').addEventListener('click', () => {
      state.selectedMonth++;
      if (state.selectedMonth > 11) { state.selectedMonth = 0; state.selectedYear++; }
      renderMetasSubview(container.parentNode);
    });

    document.getElementById('goal-filter-entity').addEventListener('change', e => {
      state.goalFilterEntity = e.target.value;
      renderMetasSubview(container.parentNode);
    });

    // Filtering goals
    const filteredGoals = (state.goals || []).filter(g => {
      if (state.goalFilterEntity !== 'all' && g.entityId !== state.goalFilterEntity) return false;
      return true;
    });

    if (filteredGoals.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.padding = '40px 20px';
      empty.innerHTML = `<p class="empty-state-text">No hay metas configuradas para esta selección.<br>Hacé clic en <strong>Nueva Meta</strong> para agregar una.</p>`;
      container.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'goals-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    grid.style.gap = '20px';
    container.appendChild(grid);

    filteredGoals.forEach(g => {
      const { total, pct } = calculateGoalProgress(g, state.selectedMonth, state.selectedYear);
      const entity = state.entities.find(e => e.id === g.entityId);
      const entityName = entity ? entity.name : 'Cuenta';

      let statusClass = 'neutral';
      let statusText = 'Dentro';

      if (g.type === 'gasto') {
        if (pct > 100) {
          statusClass = 'expense';
          statusText = 'Superado';
        } else if (pct > 85) {
          statusClass = 'warning';
          statusText = 'Al límite';
        } else {
          statusClass = 'income';
          statusText = 'Dentro';
        }
      } else {
        // Ingreso meta
        if (pct >= 100) {
          statusClass = 'income';
          statusText = 'Cumplida';
        } else {
          statusClass = 'warning';
          statusText = 'En curso';
        }
      }

      const card = document.createElement('div');
      card.className = 'goals-card';
      card.innerHTML = `
        <div class="goals-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div class="goals-card-title-wrap">
            <h4 class="goals-card-category" style="margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary);">${g.category}</h4>
            <span class="goals-card-entity" style="font-size: 0.72rem; color: var(--text-muted);">${entityName} (${g.currency}) • ${g.type === 'gasto' ? 'Límite Gasto' : 'Meta Ingreso'}</span>
          </div>
          <span class="goal-status-badge badge-${statusClass}" style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; padding: 3px 6px; border-radius: var(--radius-sm);">${statusText}</span>
        </div>
        <div class="goals-card-progress-wrap" style="margin-bottom: 16px;">
          <div class="goal-progress-bar" style="height: 8px; border-radius: 4px; background: rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 6px; position: relative;">
            <div class="goal-progress-bar-fill fill-${statusClass}" style="height: 100%; width: ${Math.min(100, pct)}%; transition: width 0.3s ease;"></div>
          </div>
          <div class="goal-progress-labels" style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">
            <span>${formatCurrency(total, g.currency)} / ${formatCurrency(g.amount, g.currency)}</span>
            <span>${Math.round(pct)}%</span>
          </div>
        </div>
        <div class="goals-card-actions" style="display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px;">
          <button class="btn-icon btn-edit-goal" data-id="${g.id}" title="Editar" style="padding: 4px; background: transparent; border: none; cursor: pointer; color: var(--text-muted); transition: color 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon btn-delete-goal" data-id="${g.id}" title="Eliminar" style="padding: 4px; background: transparent; border: none; cursor: pointer; color: var(--text-muted); transition: color 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      card.querySelector('.btn-edit-goal').addEventListener('click', () => openGoalModal(g.id));
      card.querySelector('.btn-delete-goal').addEventListener('click', () => {
        showConfirm('¿Querés eliminar esta meta?', () => {
          state.goals = state.goals.filter(goal => goal.id !== g.id);
          saveData();
          renderMetasSubview(container.parentNode);
        });
      });

      grid.appendChild(card);
    });
  }

  function calculateGainsData(year, entityId, currency) {
    const monthsData = [];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const limitMonth = (year === currentYear) ? currentMonth : 11;

    let bestMonthIdx = 0;
    let bestMonthNet = -Infinity;
    let totalNetForAvg = 0;
    let avgCount = 0;

    for (let m = 0; m <= 11; m++) {
      const txs = state.transactions.filter(t => {
        const d = new Date(t.date + 'T12:00:00');
        if (d.getMonth() !== m || d.getFullYear() !== year) return false;
        if (t.currency !== currency) return false;
        return filterTransactionByEntity(t, entityId);
      });

      let inc = 0;
      let exp = 0;
      txs.forEach(t => {
        if (t.type === 'ingreso') inc += t.amount;
        else exp += t.amount;
      });

      const net = inc - exp;
      const margin = inc > 0 ? (net / inc) * 100 : 0;

      monthsData.push({ monthIdx: m, income: inc, expense: exp, net, margin });

      if (net > bestMonthNet) {
        bestMonthNet = net;
        bestMonthIdx = m;
      }

      if (m <= limitMonth) {
        totalNetForAvg += net;
        avgCount++;
      }
    }

    const avgNet = avgCount > 0 ? totalNetForAvg / avgCount : 0;
    const bestMonthName = MONTH_NAMES[bestMonthIdx];

    return {
      monthsData,
      bestMonthName,
      bestMonthVal: bestMonthNet === -Infinity ? 0 : bestMonthNet,
      avgNet
    };
  }

  function renderGanancias(container) {
    state.gainsFilterEntity = state.gainsFilterEntity || 'all';
    state.gananciasCurrency = state.gananciasCurrency || 'ARS';

    const controls = document.createElement('div');
    controls.className = 'scope-controls';
    controls.style.marginBottom = '20px';

    // Account options select
    let entityOptions = '<option value="all">Todas las cuentas</option>';
    state.entities.forEach(ent => {
      entityOptions += `<option value="${ent.id}" ${state.gainsFilterEntity === ent.id ? 'selected' : ''}>${ent.name}</option>`;
    });

    controls.innerHTML = `
      <div class="month-selector">
        <button class="month-btn" id="prev-year-gains">‹</button>
        <span class="month-label" id="year-label-gains">${state.selectedYear}</span>
        <button class="month-btn" id="next-year-gains">›</button>
      </div>
      <div style="display: flex; gap: 16px; align-items: center;">
        <div class="filters" style="margin: 0;">
          <button class="filter-btn ${state.gananciasCurrency === 'ARS' ? 'active' : ''}" id="gains-currency-ars">ARS</button>
          <button class="filter-btn ${state.gananciasCurrency === 'USD' ? 'active' : ''}" id="gains-currency-usd">USD</button>
        </div>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Filtrar Cuenta:</span>
        <select id="gains-filter-entity" class="form-select" style="max-width: 200px; height: 32px; padding: 0 8px; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-primary);">
          ${entityOptions}
        </select>
      </div>
    `;
    container.appendChild(controls);

    // Event listeners
    document.getElementById('prev-year-gains').addEventListener('click', () => {
      state.selectedYear--;
      renderMetasSubview(container.parentNode);
    });

    document.getElementById('next-year-gains').addEventListener('click', () => {
      state.selectedYear++;
      renderMetasSubview(container.parentNode);
    });

    document.getElementById('gains-currency-ars').addEventListener('click', () => {
      state.gananciasCurrency = 'ARS';
      renderMetasSubview(container.parentNode);
    });

    document.getElementById('gains-currency-usd').addEventListener('click', () => {
      state.gananciasCurrency = 'USD';
      renderMetasSubview(container.parentNode);
    });

    document.getElementById('gains-filter-entity').addEventListener('change', e => {
      state.gainsFilterEntity = e.target.value;
      renderMetasSubview(container.parentNode);
    });

    // Calculations
    const gCurr = state.gananciasCurrency;
    const { monthsData, bestMonthName, bestMonthVal, avgNet } = calculateGainsData(state.selectedYear, state.gainsFilterEntity, gCurr);

    const currentMonthData = monthsData[state.selectedMonth];
    const net = currentMonthData.net;
    const margin = currentMonthData.margin;

    // Render KPI Cards
    const kpiRow = document.createElement('div');
    kpiRow.className = 'kpi-row';
    kpiRow.style.display = 'grid';
    kpiRow.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    kpiRow.style.gap = '20px';
    kpiRow.style.marginBottom = '20px';

    kpiRow.innerHTML = `
      <div class="kpi-card" style="background: var(--bg-surface); border: 2px solid var(--card-border); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--card-shadow); display: flex; flex-direction: column; justify-content: space-between; min-height: 90px;">
        <div>
          <span class="kpi-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 6px;">Ganancia Neta</span>
          <span class="kpi-value ${net >= 0 ? 'income' : 'expense'}" style="font-size: 1.4rem; font-weight: 700; display: block; word-break: break-all;">${net >= 0 ? '+' : ''}${formatCurrency(net, gCurr)}</span>
        </div>
        <span class="kpi-sub" style="font-size: 0.68rem; color: var(--text-muted); margin-top: 4px;">${MONTH_NAMES[state.selectedMonth]} ${state.selectedYear}</span>
      </div>
      <div class="kpi-card" style="background: var(--bg-surface); border: 2px solid var(--card-border); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--card-shadow); display: flex; flex-direction: column; justify-content: space-between; min-height: 90px;">
        <div>
          <span class="kpi-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 6px;">Margen de Ganancia</span>
          <span class="kpi-value" style="font-size: 1.4rem; font-weight: 700; display: block; color: ${margin >= 0 ? 'var(--income)' : 'var(--expense)'}">${margin.toFixed(1)}%</span>
        </div>
        <span class="kpi-sub" style="font-size: 0.68rem; color: var(--text-muted); margin-top: 4px;">De cada $100 ingresados</span>
      </div>
      <div class="kpi-card" style="background: var(--bg-surface); border: 2px solid var(--card-border); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--card-shadow); display: flex; flex-direction: column; justify-content: space-between; min-height: 90px;">
        <div>
          <span class="kpi-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 6px;">Mejor Mes</span>
          <span class="kpi-value" style="font-size: 1.2rem; font-weight: 700; display: block; color: var(--income);">${bestMonthName}</span>
        </div>
        <span class="kpi-sub" style="font-size: 0.68rem; color: var(--text-muted); margin-top: 4px;">${bestMonthVal >= 0 ? '+' : ''}${formatCurrency(bestMonthVal, gCurr)}</span>
      </div>
      <div class="kpi-card" style="background: var(--bg-surface); border: 2px solid var(--card-border); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--card-shadow); display: flex; flex-direction: column; justify-content: space-between; min-height: 90px;">
        <div>
          <span class="kpi-label" style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 6px;">Promedio Mensual</span>
          <span class="kpi-value ${avgNet >= 0 ? 'income' : 'expense'}" style="font-size: 1.4rem; font-weight: 700; display: block; word-break: break-all;">${avgNet >= 0 ? '+' : ''}${formatCurrency(avgNet, gCurr)}</span>
        </div>
        <span class="kpi-sub" style="font-size: 0.68rem; color: var(--text-muted); margin-top: 4px;">Año ${state.selectedYear}</span>
      </div>
    `;
    container.appendChild(kpiRow);

    // Chart container
    const chartSec = document.createElement('div');
    chartSec.className = 'chart-section';
    chartSec.style.marginBottom = '20px';
    chartSec.innerHTML = `
      <div class="chart-header" style="margin-bottom: 12px;">
        <span class="chart-title" style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">Tendencia de Ganancias Netas (${gCurr}) — ${state.selectedYear}</span>
      </div>
      <div class="chart-container" id="gains-trend-chart" style="height: 220px; position: relative;"></div>
    `;
    container.appendChild(chartSec);

    // Table container
    const tableSec = document.createElement('div');
    tableSec.className = 'table-container';
    tableSec.innerHTML = `
      <div class="col-section-title" style="margin-bottom: 12px; font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">Detalle Mes a Mes (${state.selectedYear})</div>
      <table class="data-table gains-table">
        <thead>
          <tr>
            <th>Mes</th>
            <th>Ingresos</th>
            <th>Gastos</th>
            <th>Resultado Neto</th>
            <th>Margen %</th>
          </tr>
        </thead>
        <tbody id="gains-table-body">
        </tbody>
      </table>
    `;
    container.appendChild(tableSec);

    // Populate table rows
    const tbody = tableSec.querySelector('#gains-table-body');
    monthsData.forEach(m => {
      const tr = document.createElement('tr');
      if (m.monthIdx === state.selectedMonth) {
        tr.style.background = 'rgba(255, 255, 255, 0.03)';
      }
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--text-primary);">${MONTH_NAMES[m.monthIdx]}</td>
        <td class="income" style="color: var(--income);">${formatCurrency(m.income, gCurr)}</td>
        <td class="expense" style="color: var(--expense);">${formatCurrency(m.expense, gCurr)}</td>
        <td style="font-weight: 600; color: ${m.net >= 0 ? 'var(--income)' : 'var(--expense)'}">${m.net >= 0 ? '+' : ''}${formatCurrency(m.net, gCurr)}</td>
        <td style="color: var(--text-secondary);">${m.margin.toFixed(1)}%</td>
      `;
      tbody.appendChild(tr);
    });

    // Render chart
    setTimeout(() => {
      const chartEl = document.getElementById('gains-trend-chart');
      if (chartEl) {
        const trendData = monthsData.map(m => ({
          label: MONTH_NAMES[m.monthIdx].substring(0, 3),
          value: m.net
        }));
        Charts.renderLineChart(chartEl, trendData, { color: '#00f2fe' });
      }
    }, 50);
  }

  // ─── Theme ───

  const THEME_KEY = 'rmcp_theme';

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    // Also respect prefers-color-scheme if nothing saved
    const preferLight = !saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    if (saved === 'light' || preferLight) {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
    updateThemeUI();
  }

  function updateThemeUI() {
    const isLight = document.documentElement.classList.contains('light-mode');
    const moon    = document.getElementById('theme-icon-moon');
    const sun     = document.getElementById('theme-icon-sun');
    const label   = document.getElementById('theme-label');
    if (moon)  moon.style.display  = isLight ? 'none'  : '';
    if (sun)   sun.style.display   = isLight ? ''      : 'none';
    if (label) label.textContent   = isLight ? 'Oscuro' : 'Claro';
  }

  function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light-mode');
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
    updateThemeUI();
  }

  // ─── Initialize ───

  function init() {
    initTheme();
    loadData();

    // Nav links (simple views)
    document.querySelectorAll('.nav-link[data-view]:not(.has-dropdown)').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });

    // Dropdown toggle buttons
    ['negocio', 'personal'].forEach(scope => {
      const wrap = document.getElementById(`dropdown-wrap-${scope}`);
      const btn  = wrap?.querySelector('.has-dropdown');
      if (!btn) return;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = wrap.classList.contains('open');
        document.querySelectorAll('.nav-dropdown-wrap').forEach(w => w.classList.remove('open'));
        if (!isOpen) wrap.classList.add('open');
      });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      document.querySelectorAll('.nav-dropdown-wrap').forEach(w => w.classList.remove('open'));
    });

    // Theme toggle
    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

    // Settings toggle
    const btnSettings = document.getElementById('btn-settings-header');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(4);
        navigate('ajustes');
      });
    }

    // New transaction button (desktop header)
    document.getElementById('btn-new-transaction').addEventListener('click', () => openModal());

    // FAB button (mobile — floating action button)
    const fab = document.getElementById('btn-fab');
    if (fab) fab.addEventListener('click', () => {
      if (navigator.vibrate) navigator.vibrate(6);
      openModal();
    });

    // Bottom nav buttons (mobile)
    document.querySelectorAll('.bottom-nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(4);
        const view = btn.dataset.view;
        navigate(view);
      });
    });

    // Auto-scroll any modal input into view when focused (prevents keyboard overlap)
    document.querySelectorAll('#transaction-form input, #transaction-form select, #goal-form input, #goal-form select').forEach(el => {
      el.addEventListener('focus', () => {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
      });
    });

    // Modal
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
    document.getElementById('transaction-form').addEventListener('submit', handleFormSubmit);

    // Goal Modal
    document.getElementById('btn-close-goal-modal').addEventListener('click', closeGoalModal);
    document.getElementById('btn-cancel-goal-modal').addEventListener('click', closeGoalModal);
    document.getElementById('goal-modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeGoalModal(); });
    document.getElementById('goal-form').addEventListener('submit', handleGoalFormSubmit);

    // Toggle groups in modal
    document.querySelectorAll('.toggle-group').forEach(group => {
      group.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (group.id === 'toggle-scope') updateModalEntityOptions();
          if (group.id === 'toggle-type' || group.id === 'toggle-scope') updateCategoryOptions();
          if (group.id === 'goal-toggle-scope') updateGoalModalEntityOptions();
          if (group.id === 'goal-toggle-type' || group.id === 'goal-toggle-scope') updateGoalCategoryOptions();
        });
      });
    });

    // Confirm dialog
    document.getElementById('btn-confirm-yes').addEventListener('click', () => { if (confirmCallback) confirmCallback(); hideConfirm(); });
    document.getElementById('btn-confirm-no').addEventListener('click', hideConfirm);
    document.getElementById('confirm-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) hideConfirm(); });

    // File import
    document.getElementById('file-import').addEventListener('change', e => {
      if (e.target.files[0]) { importData(e.target.files[0]); e.target.value = ''; }
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!document.getElementById('confirm-overlay').classList.contains('hidden')) hideConfirm();
        else if (!document.getElementById('modal-overlay').classList.contains('hidden')) closeModal();
        else if (!document.getElementById('goal-modal-overlay').classList.contains('hidden')) closeGoalModal();
      }
    });

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
          .then(reg => console.log('Service Worker registered!', reg))
          .catch(err => console.error('Service Worker registration failed:', err));
      });
    }

    navigate('general');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
