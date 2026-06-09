/* ============================================================
   Finanzas Proyect Beta — Charts Module (SVG-based)
   Renders bar charts, line charts and donut charts with
   smooth animations using native SVG — no external deps.
   ============================================================ */

const Charts = (() => {
  'use strict';

  const COLORS = {
    income: '#10b981',
    expense: '#ef4444',
    accent: '#8b5cf6',
    accentAlt: '#6366f1',
    teal: '#14b8a6',
    amber: '#f59e0b',
    textMuted: '#63637a',
    textSecondary: '#a1a1aa',
    border: 'rgba(255,255,255,0.06)',
    surface: '#131316',
  };

  const DONUT_PALETTE = [
    '#8b5cf6', '#6366f1', '#10b981', '#14b8a6',
    '#f59e0b', '#ef4444', '#ec4899', '#3b82f6',
    '#a855f7', '#22d3ee',
  ];

  // ─── Helpers ───

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  function clearContainer(container) {
    container.innerHTML = '';
  }

  function formatCompact(n) {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString('es-AR');
  }

  function formatCurrency(amount, currency = 'ARS') {
    const abs = Math.abs(amount);
    if (currency === 'USD') {
      return 'US$ ' + abs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '$ ' + abs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ─── Bar Chart (Grouped: Income vs Expense) ───

  /**
   * @param {HTMLElement} container
   * @param {Array<{label: string, income: number, expense: number}>} data
   * @param {object} [options]
   */
  function renderBarChart(container, data, options = {}) {
    clearContainer(container);
    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color:#63637a;text-align:center;padding:30px 0;font-size:0.85rem;">Sin datos para mostrar</p>';
      return;
    }

    const {
      height = 220,
      barRadius = 3,
      showLabels = true,
    } = options;

    const paddingLeft = 50;
    const paddingRight = 16;
    const paddingTop = 10;
    const paddingBottom = showLabels ? 32 : 14;

    const svg = svgEl('svg', { viewBox: `0 0 600 ${height}`, preserveAspectRatio: 'xMidYMid meet' });
    container.appendChild(svg);

    const chartW = 600 - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    const maxVal = Math.max(1, ...data.map(d => Math.max(d.income || 0, d.expense || 0)));
    const groupWidth = chartW / data.length;
    const barWidth = Math.min(groupWidth * 0.3, 32);
    const barGap = 4;

    // Grid lines
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = paddingTop + (chartH / gridLines) * i;
      const val = maxVal - (maxVal / gridLines) * i;
      svg.appendChild(svgEl('line', {
        x1: paddingLeft, y1: y, x2: 600 - paddingRight, y2: y,
        stroke: COLORS.border, 'stroke-width': '1',
      }));
      svg.appendChild(svgEl('text', {
        x: paddingLeft - 8, y: y + 4,
        'text-anchor': 'end', fill: COLORS.textMuted,
        'font-size': '10', 'font-family': 'Inter, sans-serif',
      })).textContent = formatCompact(val);
    }

    // Bars
    data.forEach((d, i) => {
      const cx = paddingLeft + groupWidth * i + groupWidth / 2;

      // Income bar
      const incH = maxVal > 0 ? (d.income / maxVal) * chartH : 0;
      const incBar = svgEl('rect', {
        x: cx - barWidth - barGap / 2, y: paddingTop + chartH - incH,
        width: barWidth, height: Math.max(incH, 0),
        rx: barRadius, fill: COLORS.income, opacity: '0.85',
      });
      incBar.innerHTML = `<animate attributeName="height" from="0" to="${incH}" dur="0.5s" fill="freeze"/>
        <animate attributeName="y" from="${paddingTop + chartH}" to="${paddingTop + chartH - incH}" dur="0.5s" fill="freeze"/>`;
      svg.appendChild(incBar);

      // Expense bar
      const expH = maxVal > 0 ? (d.expense / maxVal) * chartH : 0;
      const expBar = svgEl('rect', {
        x: cx + barGap / 2, y: paddingTop + chartH - expH,
        width: barWidth, height: Math.max(expH, 0),
        rx: barRadius, fill: COLORS.expense, opacity: '0.85',
      });
      expBar.innerHTML = `<animate attributeName="height" from="0" to="${expH}" dur="0.5s" fill="freeze" begin="0.1s"/>
        <animate attributeName="y" from="${paddingTop + chartH}" to="${paddingTop + chartH - expH}" dur="0.5s" fill="freeze" begin="0.1s"/>`;
      svg.appendChild(expBar);

      // Label
      if (showLabels) {
        svg.appendChild(svgEl('text', {
          x: cx, y: height - 6,
          'text-anchor': 'middle', fill: COLORS.textMuted,
          'font-size': '10', 'font-family': 'Inter, sans-serif',
        })).textContent = d.label;
      }
    });

    // Legend
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;gap:16px;justify-content:center;margin-top:8px;';
    legend.innerHTML = `
      <span style="display:flex;align-items:center;gap:5px;font-size:0.75rem;color:${COLORS.textSecondary}">
        <span style="width:8px;height:8px;border-radius:2px;background:${COLORS.income};display:inline-block"></span>Ingresos
      </span>
      <span style="display:flex;align-items:center;gap:5px;font-size:0.75rem;color:${COLORS.textSecondary}">
        <span style="width:8px;height:8px;border-radius:2px;background:${COLORS.expense};display:inline-block"></span>Gastos
      </span>
    `;
    container.appendChild(legend);
  }

  // ─── Line Chart (Balance Evolution) ───

  /**
   * @param {HTMLElement} container
   * @param {Array<{label: string, value: number}>} data
   * @param {object} [options]
   */
  function renderLineChart(container, data, options = {}) {
    clearContainer(container);
    if (!data || data.length < 2) {
      container.innerHTML = '<p style="color:#63637a;text-align:center;padding:30px 0;font-size:0.85rem;">Datos insuficientes</p>';
      return;
    }

    const {
      height = 220,
      color = COLORS.accent,
    } = options;

    const paddingLeft = 50;
    const paddingRight = 16;
    const paddingTop = 10;
    const paddingBottom = 32;

    const svg = svgEl('svg', { viewBox: `0 0 600 ${height}`, preserveAspectRatio: 'xMidYMid meet' });
    container.appendChild(svg);

    const chartW = 600 - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    const vals = data.map(d => d.value);
    const minVal = Math.min(0, ...vals);
    const maxVal = Math.max(1, ...vals);
    const range = maxVal - minVal || 1;

    // Grid
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = paddingTop + (chartH / gridLines) * i;
      const val = maxVal - (range / gridLines) * i;
      svg.appendChild(svgEl('line', {
        x1: paddingLeft, y1: y, x2: 600 - paddingRight, y2: y,
        stroke: COLORS.border, 'stroke-width': '1',
      }));
      svg.appendChild(svgEl('text', {
        x: paddingLeft - 8, y: y + 4,
        'text-anchor': 'end', fill: COLORS.textMuted,
        'font-size': '10', 'font-family': 'Inter, sans-serif',
      })).textContent = formatCompact(Math.round(val));
    }

    // Points
    const points = data.map((d, i) => {
      const x = paddingLeft + (chartW / (data.length - 1)) * i;
      const y = paddingTop + chartH - ((d.value - minVal) / range) * chartH;
      return { x, y };
    });

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

    // Area fill
    const areaPath = pathData +
      ` L${points[points.length - 1].x},${paddingTop + chartH}` +
      ` L${points[0].x},${paddingTop + chartH} Z`;

    // Gradient
    const gradId = 'lineGrad_' + Math.random().toString(36).substr(2, 5);
    const defs = svgEl('defs');
    defs.innerHTML = `<linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>`;
    svg.appendChild(defs);

    // Area
    const area = svgEl('path', {
      d: areaPath, fill: `url(#${gradId})`,
    });
    svg.appendChild(area);

    // Line
    const line = svgEl('path', {
      d: pathData, fill: 'none', stroke: color,
      'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    });
    const totalLen = line.getTotalLength ? 1200 : 1200;
    line.setAttribute('stroke-dasharray', totalLen);
    line.setAttribute('stroke-dashoffset', totalLen);
    line.innerHTML = `<animate attributeName="stroke-dashoffset" from="${totalLen}" to="0" dur="0.8s" fill="freeze"/>`;
    svg.appendChild(line);

    // Dots
    points.forEach((p, i) => {
      const dot = svgEl('circle', {
        cx: p.x, cy: p.y, r: '3',
        fill: color, stroke: COLORS.surface, 'stroke-width': '2',
        opacity: '0',
      });
      dot.innerHTML = `<animate attributeName="opacity" from="0" to="1" dur="0.2s" fill="freeze" begin="${0.6 + i * 0.05}s"/>`;
      svg.appendChild(dot);
    });

    // X labels
    const labelStep = Math.max(1, Math.floor(data.length / 8));
    data.forEach((d, i) => {
      if (i % labelStep === 0 || i === data.length - 1) {
        svg.appendChild(svgEl('text', {
          x: points[i].x, y: height - 6,
          'text-anchor': 'middle', fill: COLORS.textMuted,
          'font-size': '10', 'font-family': 'Inter, sans-serif',
        })).textContent = d.label;
      }
    });
  }

  // ─── Donut Chart (Category Distribution) ───

  /**
   * @param {HTMLElement} container
   * @param {Array<{label: string, value: number}>} data
   * @param {object} [options]
   */
  function renderDonutChart(container, data, options = {}) {
    clearContainer(container);
    if (!data || data.length === 0 || data.every(d => d.value === 0)) {
      container.innerHTML = '<p style="color:#63637a;text-align:center;padding:30px 0;font-size:0.85rem;">Sin datos para mostrar</p>';
      return;
    }

    const {
      size = 200,
      thickness = 28,
      currency = 'ARS',
    } = options;

    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) {
      container.innerHTML = '<p style="color:#63637a;text-align:center;padding:30px 0;font-size:0.85rem;">Sin datos</p>';
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;align-items:center;gap:24px;flex-wrap:wrap;justify-content:center;';

    const svgSize = size;
    const cx = svgSize / 2;
    const cy = svgSize / 2;
    const radius = (svgSize - thickness) / 2;
    const circumference = 2 * Math.PI * radius;

    const svg = svgEl('svg', {
      viewBox: `0 0 ${svgSize} ${svgSize}`,
      width: svgSize, height: svgSize,
      style: 'flex-shrink:0',
    });

    // Background ring
    svg.appendChild(svgEl('circle', {
      cx, cy, r: radius,
      fill: 'none', stroke: 'rgba(255,255,255,0.04)',
      'stroke-width': thickness,
    }));

    let offset = 0;
    data.forEach((d, i) => {
      const pct = d.value / total;
      const dashLen = pct * circumference;
      const gap = circumference - dashLen;
      const color = DONUT_PALETTE[i % DONUT_PALETTE.length];

      const circle = svgEl('circle', {
        cx, cy, r: radius,
        fill: 'none', stroke: color,
        'stroke-width': thickness,
        'stroke-dasharray': `${dashLen} ${gap}`,
        'stroke-dashoffset': -offset,
        'stroke-linecap': 'butt',
        transform: `rotate(-90 ${cx} ${cy})`,
        opacity: '0',
      });
      circle.innerHTML = `<animate attributeName="opacity" from="0" to="1" dur="0.3s" fill="freeze" begin="${i * 0.08}s"/>`;
      svg.appendChild(circle);

      offset += dashLen;
    });

    // Center text
    svg.appendChild(svgEl('text', {
      x: cx, y: cy - 4,
      'text-anchor': 'middle', fill: '#fafafa',
      'font-size': '18', 'font-weight': '700', 'font-family': 'Inter, sans-serif',
    })).textContent = data.length;
    svg.appendChild(svgEl('text', {
      x: cx, y: cy + 14,
      'text-anchor': 'middle', fill: COLORS.textMuted,
      'font-size': '10', 'font-family': 'Inter, sans-serif',
    })).textContent = 'categorías';

    wrapper.appendChild(svg);

    // Legend
    const legendEl = document.createElement('div');
    legendEl.style.cssText = 'display:flex;flex-direction:column;gap:6px;min-width:180px;';

    data.forEach((d, i) => {
      const pct = ((d.value / total) * 100).toFixed(1);
      const color = DONUT_PALETTE[i % DONUT_PALETTE.length];
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:0.78rem;';
      const formattedVal = formatCurrency(d.value, currency);
      item.innerHTML = `
        <span style="width:8px;height:8px;border-radius:2px;background:${color};flex-shrink:0;display:inline-block"></span>
        <span style="color:#a1a1aa;flex:1;margin-right:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${d.label}">${d.label}</span>
        <span style="color:#fafafa;font-weight:600;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap;">
          ${formattedVal}
          <span style="color:#63637a;font-size:0.72rem;font-weight:normal;margin-left:4px;">(${pct}%)</span>
        </span>
      `;
      legendEl.appendChild(item);
    });

    wrapper.appendChild(legendEl);
    container.appendChild(wrapper);
  }

  // ─── Public API ───
  return { renderBarChart, renderLineChart, renderDonutChart };
})();
