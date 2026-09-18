// script.js — Catalog + Builder + AI Suggestor

// ── Catalog ────────────────────────────────────────────────────────────────
const partsGrid = document.getElementById('partsGrid');
const catBtns = document.querySelectorAll('.cat-btn');
let activeCat = 'all';
const PART_ICONS = {
  cpu: '<svg viewBox="0 0 24 24" focusable="false"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 9h6v6H9zM9 2v4m6-4v4m0 12v4m-6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/></svg>',
  gpu: '<svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="9" cy="12" r="3"/><path d="M15 9h3m-3 3h3m-3 3h3M6 20v2m12-2v2"/></svg>',
  ram: '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 7h18v9H3zM6 10h2m2 0h2m2 0h2m2 0h1M6 16v3m3-3v3m3-3v3m3-3v3m3-3v3"/></svg>',
  mobo: '<svg viewBox="0 0 24 24" focusable="false"><rect x="4" y="3" width="16" height="18" rx="2"/><rect x="7" y="6" width="6" height="6"/><path d="M15 7h2m-2 3h2M7 16h10m-7-4v4"/></svg>',
  storage: '<svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 9h10M7 13h6M17 16h.01"/></svg>',
  psu: '<svg viewBox="0 0 24 24" focusable="false"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m13 6-4 7h3l-1 5 4-7h-3z"/></svg>',
  case: '<svg viewBox="0 0 24 24" focusable="false"><rect x="6" y="2" width="12" height="20" rx="2"/><circle cx="12" cy="7" r="2"/><path d="M9 13h6m-6 3h4"/></svg>',
  cooling: '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M12 3c3 2 3 5 0 6-3-1-3-4 0-6Zm9 9c-2 3-5 3-6 0 1-3 4-3 6 0Zm-9 9c-3-2-3-5 0-6 3 1 3 4 0 6ZM3 12c2-3 5-3 6 0-1 3-4 3-6 0Z"/></svg>'
};
const PART_LABELS = {
  cpu: 'Processor',
  gpu: 'Graphics card',
  ram: 'Memory',
  mobo: 'Motherboard',
  storage: 'Storage',
  psu: 'Power supply',
  case: 'Case',
  cooling: 'Cooling'
};

function renderCatalog(cat) {
  const list = cat === 'all' ? PARTS : PARTS.filter(p => p.cat === cat);
  partsGrid.innerHTML = list.map(p => {
    const stockClass = p.stock === 'in' ? 'stock-in' : p.stock === 'low' ? 'stock-low' : 'stock-out';
    const stockText = p.stock === 'in' ? 'In Stock' : p.stock === 'low' ? 'Low Stock' : 'Out of Stock';
    const tags = [];
    if (p.limited) tags.push('limited');
    if (p.preorder) tags.push('preorder');
    const tagStr = tags.map(t => ` ${t}`).join('');
    const selected = buildParts.some(part => part.id === p.id);
    return `
      <div class="part-card${tagStr}${selected ? ' selected' : ''}" data-id="${p.id}" data-cat="${p.cat}">
        <div class="part-category"><span class="part-icon part-icon-${p.cat}" aria-hidden="true">${PART_ICONS[p.cat] || 'PART'}</span><span>${PART_LABELS[p.cat] || 'Part'}</span></div>
        <div class="part-brand">${p.brand}</div>
        <div class="part-name">${p.name}</div>
        <div class="part-specs">${p.specs}</div>
        <div class="part-price">$${p.price.toLocaleString()}</div>
        <div class="part-stock ${stockClass}">${stockText}${p.preorder ? ' · Ships when available' : ''}</div>
        <div class="part-card-actions"><button class="inspect-part" type="button">Inspect</button><button class="select-part" type="button">${selected ? 'Remove part' : 'Select part'}</button></div>
      </div>
    `;
  }).join('');
  // attach click listeners
  partsGrid.querySelectorAll('.part-card').forEach(card => {
    const selectButton = card.querySelector('.select-part');
    const inspectButton = card.querySelector('.inspect-part');
    const togglePart = () => {
      const id = card.dataset.id;
      const part = PARTS.find(p => p.id === id);
      if (!part) return;
      if (buildParts.some(selectedPart => selectedPart.id === id)) {
        removeFromBuild(id);
      } else {
        addToBuild(part);
      }
      if (part) renderCatalog(activeCat);
    };
    selectButton.addEventListener('click', (event) => {
      event.stopPropagation();
      togglePart();
    });
    inspectButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const part = PARTS.find(p => p.id === card.dataset.id);
      if (part) openPartInspection(part);
    });
    card.addEventListener('click', togglePart);
  });
}

catBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCat = btn.dataset.cat;
    renderCatalog(activeCat);
  });
});

// ── Builder ────────────────────────────────────────────────────────────────
const buildList = document.getElementById('buildList');
const buildSummary = document.getElementById('buildSummary');
const totalPriceEl = document.getElementById('totalPrice');
const compatStatus = document.getElementById('compatStatus');
const compatMessages = document.getElementById('compatMessages');
const clearBuildBtn = document.getElementById('clearBuildBtn');
let buildParts = [];
try {
  const savedBuild = JSON.parse(localStorage.getItem('renderShopBuild') || '[]');
  buildParts = Array.isArray(savedBuild) ? savedBuild : [];
} catch (_) {
  localStorage.removeItem('renderShopBuild');
}

function addToBuild(part) {
  if (buildParts.find(p => p.id === part.id)) return;
  buildParts.push(part);
  localStorage.setItem('renderShopBuild', JSON.stringify(buildParts));
  renderBuild();
}

function removeFromBuild(id) {
  buildParts = buildParts.filter(p => p.id !== id);
  localStorage.setItem('renderShopBuild', JSON.stringify(buildParts));
  renderBuild();
}

function renderBuild() {
  if (!buildList) return;
  if (buildParts.length === 0) {
    buildList.innerHTML = '<p class="empty-msg">No parts selected yet. Start picking below!</p>';
    buildSummary.style.display = 'none';
    clearBuildBtn.style.display = 'none';
    compatMessages.innerHTML = '<li>Select parts to see compatibility checks.</li>';
    compatStatus.textContent = 'Not checked';
    return;
  }
  clearBuildBtn.style.display = 'inline-block';
  buildSummary.style.display = 'block';
  const total = buildParts.reduce((s, p) => s + p.price, 0);
  totalPriceEl.textContent = '$' + total.toLocaleString();

  buildList.innerHTML = buildParts.map(p => `
    <div class="build-item">
      <span><strong>${p.brand}</strong> ${p.name}</span>
      <span class="part-price">$${p.price}</span>
      <button class="remove-part" data-id="${p.id}">&times;</button>
    </div>
  `).join('');

  buildList.querySelectorAll('.remove-part').forEach(btn => {
    btn.addEventListener('click', () => removeFromBuild(btn.dataset.id));
  });

  // Compatibility
  const checks = runCompatibility(buildParts);
  compatMessages.innerHTML = checks.map(c => `<li class="${c.type}">${c.msg}</li>`).join('');
  const allGood = checks.every(c => c.type === 'good');
  compatStatus.textContent = allGood ? 'No issues found' : 'Compatibility issues found. See below.';
  compatStatus.style.color = allGood ? 'var(--green)' : 'var(--orange)';
}

function runCompatibility(parts) {
  const msgs = [];
  const cpus = parts.filter(p => p.cat === 'cpu');
  const gpus = parts.filter(p => p.cat === 'gpu');
  const rams = parts.filter(p => p.cat === 'ram');
  const mobos = parts.filter(p => p.cat === 'mobo');
  const cases = parts.filter(p => p.cat === 'case');
  const psus = parts.filter(p => p.cat === 'psu');

  if (cpus.length > 0 && mobos.length > 0) {
    for (const cpu of cpus) {
      for (const mobo of mobos) {
        let ok = false;
        if (cpu.brand === 'AMD') ok = mobo.name.includes('AM5') || mobo.name.includes('AM4') || mobo.name.includes('TRX');
        if (cpu.brand === 'Intel') ok = mobo.name.includes('Z790') || mobo.name.includes('Z890') || (mobo.name.includes('LGA') && !mobo.name.includes('AM5'));
        if (cpu.brand === 'Intel' && !mobo.name.includes('LGA') && !mobo.name.includes('Z790') && !mobo.name.includes('Z890')) {
          msgs.push({ type:'warn', msg:`${cpu.brand} ${cpu.name} may not fit ${mobo.name} (socket mismatch).` });
        }
        if (cpu.brand === 'AMD' && !mobo.name.includes('AM5') && !mobo.name.includes('AM4') && !mobo.name.includes('TRX')) {
          msgs.push({ type:'warn', msg:`${cpu.brand} ${cpu.name} may not fit ${mobo.name} (socket mismatch).` });
        }
      }
    }
  }

  // 2. PSU wattage check
  if (psus.length > 0 && (cpus.length > 0 || gpus.length > 0)) {
    const cpuTDP = cpus.length > 0 ? (cpus[0].specs.includes('65W') ? 65 : cpus[0].specs.includes('125W') ? 125 : cpus[0].specs.includes('253W') ? 253 : cpus[0].specs.includes('320W') ? 320 : 150) : 0;
    const gpuTDP = gpus.length > 0 ? (gpus[0].specs.includes('120W') ? 120 : gpus[0].specs.includes('285W') ? 285 : gpus[0].specs.includes('320W') ? 320 : gpus[0].specs.includes('450W') ? 450 : gpus[0].specs.includes('263W') ? 263 : gpus[0].specs.includes('355W') ? 355 : 150) : 0;
    const estLoad = cpuTDP + gpuTDP + 100;
    for (const psu of psus) {
      // extract wattage from name
      const match = psu.name.match(/(\d{3,4})W/);
      const psuW = match ? parseInt(match[1]) : 0;
      if (psuW > 0 && psuW < estLoad) {
        msgs.push({ type:'warn', msg:`${psu.name} (${psuW}W) may be underpowered for ${cpuTDP}W CPU + ${gpuTDP}W GPU (est. ${estLoad}W load).` });
      }
    }
  }

  // 3. Case ↔ motherboard size
  if (cases.length > 0 && mobos.length > 0) {
    for (const mobo of mobos) {
      for (const c of cases) {
        if (mobo.name.includes('ATX') && c.name.includes('ITX') && !c.name.includes('ATX')) {
          // skip — most ATX cases also fit mATX, but ITX cases may not fit ATX
        }
        if (mobo.name.includes('E-ATX') && !c.name.includes('E-ATX') && !c.name.includes('Full-tower')) {
          msgs.push({ type:'warn', msg:`${mobo.name} (large format) may not fit ${c.name}.` });
        }
      }
    }
  }

  if (msgs.length === 0) {
    msgs.push({ type:'good', msg:'All selected parts appear compatible.' });
  }
  return msgs;
}

if (clearBuildBtn) {
  clearBuildBtn.addEventListener('click', () => {
    buildParts = [];
    localStorage.removeItem('renderShopBuild');
    renderBuild();
  });
}

// ── Part inspection ────────────────────────────────────────────────────────
let inspectionModal;
function ensureInspectionModal() {
  if (inspectionModal) return inspectionModal;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="inspection-backdrop" id="inspectionBackdrop" hidden>
      <section class="inspection-modal" role="dialog" aria-modal="true" aria-labelledby="inspectionTitle">
        <button class="inspection-close" type="button" aria-label="Close inspection">×</button>
        <div id="inspectionContent"></div>
      </section>
    </div>`);
  inspectionModal = document.getElementById('inspectionBackdrop');
  inspectionModal.querySelector('.inspection-close').addEventListener('click', closePartInspection);
  inspectionModal.addEventListener('click', event => { if (event.target === inspectionModal) closePartInspection(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !inspectionModal.hidden) closePartInspection(); });
  return inspectionModal;
}

function stockLabel(part) {
  return part.stock === 'in' ? 'In stock' : part.stock === 'low' ? 'Low stock' : part.stock === 'preorder' ? 'Pre-order' : 'Out of stock';
}

function openPartInspection(part) {
  const modal = ensureInspectionModal();
  const alternatives = PARTS.filter(candidate => candidate.cat === part.cat && candidate.id !== part.id).sort((a, b) => Math.abs(a.price - part.price) - Math.abs(b.price - part.price)).slice(0, 3);
  const research = (window.RESEARCHED_PRICES || []).find(item => item.catalog_id === part.id);
  const historyHTML = research && research.history_available && research.history_points.length ? (() => { const values = research.history_points.map(point => point.price); const min = Math.min(...values); const max = Math.max(...values); const span = Math.max(1, max - min); const graph = research.history_points.map(point => `<div class="research-bar-item"><div class="research-bar-value">₹${Math.round(point.price).toLocaleString('en-IN')}</div><div class="research-bar" style="height:${Math.max(18, ((point.price - min) / span) * 78 + 22)}%" title="${point.label}: ₹${point.price.toLocaleString('en-IN')}"></div><small>${point.label}</small></div>`).join(''); return `<div class="price-history-loaded"><strong>Researched public history</strong><p>${research.history_summary}</p><div class="research-chart" aria-label="Researched price range from low to high">${graph}</div><div class="research-chart-caption">Indian price range summary. These are sourced low, average, and high observations, not invented daily points.</div><div class="research-stats">${research.history_points.map(point => `<span><small>${point.label}</small><b>₹${point.price.toLocaleString('en-IN')}</b></span>`).join('')}</div><div class="price-history-links">${research.sources.slice(0, 3).map(source => `<a href="${source}" target="_blank" rel="noopener">Source</a>`).join('')}</div></div>`; })() : `<div class="price-history-unavailable"><strong>${research && research.current_price_inr && research.current_price_inr !== 'unavailable' && research.current_price_inr !== 'Unavailable' && research.current_price_inr !== 'N/A' ? 'Current price sourced, history unavailable' : 'No verified Indian history found'}</strong><p>${research ? research.history_summary : 'This product has not been matched to a researched public price source yet.'}</p><div class="price-history-links">${research ? research.sources.slice(0, 3).map(source => `<a href="${source}" target="_blank" rel="noopener">Source</a>`).join('') : ''}</div></div>`;
  const heuristic = part.stock === 'out' || part.stock === 'preorder' ? 'Wait or consider an alternative' : part.stock === 'low' || part.limited ? 'Buy soon if it fits your build' : part.price < 250 ? 'Reasonable to buy now' : 'Compare before buying';
  const alternativeHTML = alternatives.length ? alternatives.map(candidate => `<button class="inspection-alternative" data-alt-id="${candidate.id}" type="button"><span>${candidate.brand} ${candidate.name}</span><strong>$${candidate.price.toLocaleString()}</strong></button>`).join('') : '<p class="empty-msg">No close alternatives in this category.</p>';
  modal.querySelector('#inspectionContent').innerHTML = `
    <p class="eyebrow">Part inspection</p>
    <h2 id="inspectionTitle">${part.brand} ${part.name}</h2>
    <p class="inspection-specs">${part.specs}</p>
    <div class="inspection-meta"><strong>$${part.price.toLocaleString()}</strong><span class="${part.stock === 'in' ? 'stock-in' : part.stock === 'low' ? 'stock-low' : 'stock-out'}">${stockLabel(part)}</span>${part.limited ? '<span>Limited edition</span>' : ''}</div>
    <div class="inspection-grid"><div><div class="inspection-section-title">Researched price history</div><div id="priceHistoryPanel">${historyHTML}</div></div><div><div class="inspection-section-title">Initial guidance</div><div class="inspection-verdict">${heuristic}</div><p id="inspectionAI" class="inspection-ai-copy">Core is checking the part against its price, stock status, and nearby alternatives...</p></div></div>
    <div class="inspection-section-title">Alternatives</div><div class="inspection-alternatives">${alternativeHTML}</div>
    <div class="inspection-actions"><button class="btn btn-primary inspection-select" type="button">${buildParts.some(selectedPart => selectedPart.id === part.id) ? 'Remove from build' : 'Add to build'}</button><button class="btn btn-secondary inspection-ai-button" type="button">Ask Core again</button></div>`;
  if (research && !research.history_available) {
    const historyPanel = modal.querySelector('#priceHistoryPanel');
    const reference = document.createElement('div');
    reference.className = 'inspection-price-reference';
    reference.textContent = `Catalog reference: $${part.price.toLocaleString()} · Amazon India price not verified for this exact listing.`;
    historyPanel?.appendChild(reference);
  }
  modal.hidden = false;
  modal.querySelector('.inspection-select').addEventListener('click', () => { if (buildParts.some(selectedPart => selectedPart.id === part.id)) removeFromBuild(part.id); else addToBuild(part); closePartInspection(); if (partsGrid) renderCatalog(activeCat); });
  modal.querySelectorAll('.inspection-alternative').forEach(button => button.addEventListener('click', () => { const alternative = PARTS.find(candidate => candidate.id === button.dataset.altId); if (alternative) openPartInspection(alternative); }));
  const askCore = () => requestPartAnalysis(part, modal.querySelector('#inspectionAI'));
  modal.querySelector('.inspection-ai-button').addEventListener('click', askCore);
  askCore();
}


async function requestPartAnalysis(part, target) {
  target.textContent = 'Core is checking the part against its price, stock status, and nearby alternatives...';
  const alternatives = PARTS.filter(candidate => candidate.cat === part.cat && candidate.id !== part.id).sort((a, b) => Math.abs(a.price - part.price) - Math.abs(b.price - part.price)).slice(0, 3).map(candidate => `${candidate.brand} ${candidate.name} ($${candidate.price})`).join(', ');
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: `Inspect this PC part and give a concise buy-now/wait recommendation. Part: ${part.brand} ${part.name}. Specs: ${part.specs}. Current listed price: $${part.price}. Stock: ${stockLabel(part)}. Nearby alternatives: ${alternatives || 'none'}. No verified price-history series is available, so do not claim a price trend.` }] }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Server returned HTTP ${response.status}.`);
    target.textContent = String(data.text || '').replace(/\*/g, '');
  } catch (error) { target.textContent = `Core could not analyze this part right now. ${error.message || ''}`; }
}

function closePartInspection() { if (inspectionModal) inspectionModal.hidden = true; }

// Initial
if (partsGrid) renderCatalog('all');
if (buildList) renderBuild();

// ── AI Suggestor ──────────────────────────────────────────────────────────
const aiBudget = document.getElementById('aiBudget');
const aiPerformance = document.getElementById('aiPerformance');
const aiAvailability = document.getElementById('aiAvailability');
const aiStyle = document.getElementById('aiStyle');
const aiSuggestBtn = document.getElementById('aiSuggestBtn');
const aiResultContent = document.getElementById('aiResultContent');

// Performance → CPU/GPU target tiers
const PERF_MAP = {
  'basic':      { cpuMin: 100,  gpuMin: 0 },
  'gaming-mid': { cpuMin: 250,  gpuMin: 300 },
  'gaming-high':{ cpuMin: 350,  gpuMin: 500 },
  'gaming-ultra':{cpuMin:450,   gpuMin: 1000 },
  'workstation':{ cpuMin: 400,  gpuMin: 600 },
};

function aiSuggest() {
  const budget = aiBudget.value;
  const perf   = aiPerformance.value;
  const avail  = aiAvailability.value;
  const style  = aiStyle.value;

  if (!budget || !perf) {
    aiResultContent.innerHTML = '<p class="empty-msg">Please select both a budget and a performance target to get a recommendation.</p>';
    return;
  }

  // parse budget range
  const bMin = parseInt(budget.split('-')[0].replace('+',''));
  const bMax = parseInt(budget.split('-')[1] || '99999');

  // Availability filter
  let availFilter;
  if (avail === 'in-stock') availFilter = p => p.stock === 'in';
  else if (avail === 'mixed') availFilter = p => p.stock === 'in' || p.stock === 'low' || p.stock === 'preorder';
  else availFilter = p => true; // any

  const perfReq = PERF_MAP[perf] || PERF_MAP.basic;

  // Helper: pick the best part in a category within budget, meeting min performance if applicable
  function pick(cat, minPrice, maxPrice, minScore=null) {
    let candidates = PARTS.filter(p => p.cat === cat && availFilter(p) && p.price >= minPrice && p.price <= maxPrice);
    if (candidates.length === 0) candidates = PARTS.filter(p => p.cat === cat && availFilter(p) && p.price <= maxPrice);
    if (candidates.length === 0) return null;
    // score: prefer higher price (better performance) but within budget
    // For GPU: filter by minScore if set
    if (minScore !== null) {
      // crude GPU score from price (higher price ≈ better card)
      candidates = candidates.filter(p => p.price >= minScore);
    }
    if (candidates.length === 0) candidates = PARTS.filter(p => p.cat === cat && availFilter(p) && p.price <= maxPrice);
    if (candidates.length === 0) return null;
    // prefer in-stock, then higher price within budget
    candidates.sort((a,b) => {
      const aScore = a.stock === 'in' ? 0 : a.stock === 'low' ? 1 : 2;
      const bScore = b.stock === 'in' ? 0 : b.stock === 'low' ? 1 : 2;
      if (aScore !== bScore) return aScore - bScore;
      return b.price - a.price; // higher price = better perf, but not above budget
    });
    return candidates[0];
  }

  // Build a full system
  const selected = {};
  let gpu = null;

  // CPU — must match budget tier
  const cpu = pick('cpu', 0, bMax, perfReq.cpuMin);
  if (cpu) selected.cpu = cpu;

  // GPU — mandatory for gaming/workstation, optional for basic
  if (perfReq.gpuMin > 0) {
    gpu = pick('gpu', 100, bMax, perfReq.gpuMin);
    if (gpu) selected.gpu = gpu;
  }

  // Motherboard — pick one that matches the CPU socket
  let moboCandidates = PARTS.filter(p => p.cat === 'mobo' && availFilter(p) && p.price <= bMax * 0.25 && p.price >= 100);
  if (cpu) {
    if (cpu.brand === 'AMD') moboCandidates = moboCandidates.filter(p => p.name.includes('AM5') || p.name.includes('AM4') || p.name.includes('TRX'));
    if (cpu.brand === 'Intel') moboCandidates = moboCandidates.filter(p => p.name.includes('LGA') || p.name.includes('Z790') || p.name.includes('Z890'));
  }
  // if no match, loosen
  if (moboCandidates.length === 0) moboCandidates = PARTS.filter(p => p.cat === 'mobo' && availFilter(p) && p.price <= bMax * 0.25);
  moboCandidates.sort((a,b) => a.price - b.price);
  if (moboCandidates.length > 0) selected.mobo = moboCandidates[0];

  // RAM
  const ram = pick('ram', 40, Math.min(bMax * 0.12, 400));
  if (ram) selected.ram = ram;

  // Storage
  const storage = pick('storage', 40, Math.min(bMax * 0.1, 300));
  if (storage) selected.storage = storage;

  // PSU
  let psuCandidates = PARTS.filter(p => p.cat === 'psu' && availFilter(p) && p.price <= Math.min(bMax * 0.12, 400));
  if (cpu && selected.gpu) {
    const cpuW = cpu.specs.includes('65W') ? 65 : cpu.specs.includes('125W') ? 125 : cpu.specs.includes('253W') ? 253 : cpu.specs.includes('320W') ? 320 : 150;
    const gpuW = selected.gpu.specs.includes('120W') ? 120 : selected.gpu.specs.includes('285W') ? 285 : selected.gpu.specs.includes('320W') ? 320 : selected.gpu.specs.includes('450W') ? 450 : selected.gpu.specs.includes('263W') ? 263 : selected.gpu.specs.includes('355W') ? 355 : 150;
    const needed = cpuW + gpuW + 100;
    psuCandidates = psuCandidates.filter(p => { const m = p.name.match(/(\d+)/); const w = m ? parseInt(m[1]) : 0; return w >= needed; });
  }
  psuCandidates.sort((a,b) => a.price - b.price);
  if (psuCandidates.length > 0) selected.psu = psuCandidates[0];

  // Case
  let caseCandidates = PARTS.filter(p => p.cat === 'case' && availFilter(p) && p.price <= Math.min(bMax * 0.08, 200));
  // Style filter
  if (style === 'minimal') caseCandidates = caseCandidates.filter(p => !p.name.includes('RGB') && !p.name.includes('Glass'));
  if (style === 'gamer' || style === 'show') caseCandidates = caseCandidates.filter(p => p.name.includes('RGB') || p.name.includes('Glass') || p.name.includes('AORUS') || p.name.includes('ROG'));
  if (style === 'silent') caseCandidates = caseCandidates.filter(p => p.name.includes('Airflow') || p.name.includes('Silent'));
  if (caseCandidates.length === 0) caseCandidates = PARTS.filter(p => p.cat === 'case' && availFilter(p) && p.price <= Math.min(bMax * 0.08, 200));
  caseCandidates.sort((a,b) => a.price - b.price);
  if (caseCandidates.length > 0) selected.case = caseCandidates[0];

  // Cooling
  let coolCandidates = PARTS.filter(p => p.cat === 'cooling' && availFilter(p) && p.price <= Math.min(bMax * 0.06, 150));
  if (style === 'silent') coolCandidates = coolCandidates.filter(p => p.name.includes('Noctua') || p.name.includes('be quiet') || p.name.includes('Liquid Freezer'));
  if (style === 'gamer' || style === 'show') coolCandidates = coolCandidates.filter(p => p.name.includes('RGB') || p.name.includes('ARGB'));
  if (coolCandidates.length === 0) coolCandidates = PARTS.filter(p => p.cat === 'cooling' && availFilter(p) && p.price <= Math.min(bMax * 0.06, 150));
  coolCandidates.sort((a,b) => a.price - b.price);
  if (coolCandidates.length > 0) selected.cooling = coolCandidates[0];

  // If no parts selected at all
  if (Object.keys(selected).length === 0) {
    aiResultContent.innerHTML = '<p class="empty-msg">No parts matched your criteria. Try broadening your budget or availability preference.</p>';
    return;
  }

  // Build HTML
  const catOrder = ['cpu','gpu','mobo','ram','storage','psu','case','cooling'];
  const catLabels = { cpu:'CPU', gpu:'GPU', mobo:'Motherboard', ram:'RAM', storage:'Storage', psu:'PSU', case:'Case', cooling:'Cooling' };
  const total = Object.values(selected).reduce((s,p) => s + p.price, 0);

  let html = '';
  for (const cat of catOrder) {
    const p = selected[cat];
    if (!p) continue;
    const stockNote = p.stock === 'in' ? 'In stock' : p.stock === 'low' ? 'Low stock' : p.stock === 'preorder' ? 'Pre-order' : 'Out of stock (rare)';
    html += `
      <div class="ai-build-item">
        <div>
          <div class="ai-part-name">${catLabels[cat]}: ${p.brand} ${p.name}</div>
          <div class="ai-part-detail">${p.specs} · ${stockNote}${p.limited ? ' · Limited edition' : ''}${p.preorder ? ' · Ships when available' : ''}</div>
        </div>
        <div class="ai-part-price">$${p.price.toLocaleString()}</div>
      </div>
    `;
  }
  html += `
    <div class="ai-build-total">
      <div class="total-label">Estimated total</div>
      <div class="total-price">$${total.toLocaleString()}</div>
    </div>
    <div class="ai-build-note">
      Based on: ${budgetLabel(budget)} · ${perfLabel(perf)} · ${availLabel(avail)} · ${styleLabel(style)}.
      Prices may vary. Verify socket compatibility before buying. Click any part to add it to your build above.
    </div>
  `;
  aiResultContent.innerHTML = html;
}

function budgetLabel(v) {
  const map = { '300-500':'Budget $300–500', '500-800':'Mid-range $500–800', '800-1200':'High-end $800–1,200',
                '1200-2000':'Enthusiast $1,200–2,000', '2000+':'Flagship $2,000+' };
  return map[v] || v;
}
function perfLabel(v) {
  const map = { basic:'Basic', 'gaming-mid':'Gaming 1080p', 'gaming-high':'Gaming 1440p', 'gaming-ultra':'Gaming 4K', workstation:'Workstation' };
  return map[v] || v;
}
function availLabel(v) {
  const map = { 'in-stock':'In-stock only', 'mixed':'Mixed', 'any':'Any availability' };
  return map[v] || v;
}
function styleLabel(v) {
  const map = { minimal:'Minimal', gamer:'Gamer RGB', show:'Showpiece', silent:'Silent' };
  return map[v] || v;
}

if (aiSuggestBtn) aiSuggestBtn.addEventListener('click', aiSuggest);
