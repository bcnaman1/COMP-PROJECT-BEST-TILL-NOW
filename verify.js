// Verify AI suggestor logic produces real builds
const fs = require('fs');

// Load PARTS data — eval in global scope using globalThis trick
const dataCode = fs.readFileSync('data.js', 'utf8');
let wrapped = dataCode.replace('const PARTS =', 'globalThis.PARTS =');
wrapped = wrapped.replace('const CAT_LABELS =', 'globalThis.CAT_LABELS =');
eval(wrapped);

// Verify PARTS is loaded
if (!globalThis.PARTS || globalThis.PARTS.length === 0) {
  console.log('ERROR: PARTS not loaded');
  process.exit(1);
}
if (!globalThis.CAT_LABELS) {
  console.log('ERROR: CAT_LABELS not loaded');
  process.exit(1);
}
console.log('Data loaded: ' + globalThis.PARTS.length + ' parts, ' + Object.keys(globalThis.CAT_LABELS).length + ' categories\n');

const PARTS = globalThis.PARTS;
const CAT_LABELS = globalThis.CAT_LABELS;

const PERF_MAP = {
  basic:      { cpuMin: 100,  gpuMin: 0 },
  'gaming-mid': { cpuMin: 250,  gpuMin: 300 },
  'gaming-high':{ cpuMin: 350,  gpuMin: 500 },
  'gaming-ultra':{cpuMin:450,   gpuMin: 1000 },
  workstation:{ cpuMin: 400,  gpuMin: 600 },
};

function aiTest(budget, perf, avail, style) {
  const bMin = parseInt(budget.split('-')[0].replace('+',''));
  const bMax = parseInt(budget.split('-')[1] || '99999');
  let availFilter;
  if (avail === 'in-stock') availFilter = p => p.stock === 'in';
  else if (avail === 'mixed') availFilter = p => p.stock === 'in' || p.stock === 'low' || p.stock === 'preorder';
  else availFilter = p => true;
  const perfReq = PERF_MAP[perf] || PERF_MAP.basic;

  function pick(cat, minPrice, maxPrice, minScore=null) {
    let candidates = PARTS.filter(p => p.cat === cat && availFilter(p) && p.price >= minPrice && p.price <= maxPrice);
    if (candidates.length === 0) candidates = PARTS.filter(p => p.cat === cat && availFilter(p) && p.price <= maxPrice);
    if (candidates.length === 0) return null;
    if (minScore !== null) {
      candidates = candidates.filter(p => p.price >= minScore);
    }
    if (candidates.length === 0) candidates = PARTS.filter(p => p.cat === cat && availFilter(p) && p.price <= maxPrice);
    if (candidates.length === 0) return null;
    candidates.sort((a,b) => {
      const aScore = a.stock === 'in' ? 0 : a.stock === 'low' ? 1 : 2;
      const bScore = b.stock === 'in' ? 0 : b.stock === 'low' ? 1 : 2;
      if (aScore !== bScore) return aScore - bScore;
      return b.price - a.price;
    });
    return candidates[0];
  }

  const selected = {};
  const cpu = pick('cpu', 0, bMax, perfReq.cpuMin);
  if (cpu) selected.cpu = cpu;

  if (perfReq.gpuMin > 0) {
    const gpu = pick('gpu', 100, bMax, perfReq.gpuMin);
    if (gpu) selected.gpu = gpu;
  }

  let moboCandidates = PARTS.filter(p => p.cat === 'mobo' && availFilter(p) && p.price <= bMax * 0.25 && p.price >= 100);
  if (cpu) {
    if (cpu.brand === 'AMD') moboCandidates = moboCandidates.filter(p => p.name.includes('AM5') || p.name.includes('AM4') || p.name.includes('TRX'));
    if (cpu.brand === 'Intel') moboCandidates = moboCandidates.filter(p => p.name.includes('LGA') || p.name.includes('Z790') || p.name.includes('Z890'));
  }
  if (moboCandidates.length === 0) moboCandidates = PARTS.filter(p => p.cat === 'mobo' && availFilter(p) && p.price <= bMax * 0.25);
  moboCandidates.sort((a,b) => a.price - b.price);
  if (moboCandidates.length > 0) selected.mobo = moboCandidates[0];

  const ram = pick('ram', 40, Math.min(bMax * 0.12, 400));
  if (ram) selected.ram = ram;

  const storage = pick('storage', 40, Math.min(bMax * 0.1, 300));
  if (storage) selected.storage = storage;

  let psuCandidates = PARTS.filter(p => p.cat === 'psu' && availFilter(p) && p.price <= Math.min(bMax * 0.12, 400));
  if (cpu && selected.gpu) {
    const cpuW = cpu.specs.includes('65W') ? 65 : cpu.specs.includes('125W') ? 125 : cpu.specs.includes('253W') ? 253 : cpu.specs.includes('320W') ? 320 : 150;
    const gpuW = selected.gpu.specs.includes('120W') ? 120 : selected.gpu.specs.includes('285W') ? 285 : selected.gpu.specs.includes('320W') ? 320 : selected.gpu.specs.includes('450W') ? 450 : selected.gpu.specs.includes('263W') ? 263 : selected.gpu.specs.includes('355W') ? 355 : 150;
    const needed = cpuW + gpuW + 100;
    psuCandidates = psuCandidates.filter(p => { const m = p.name.match(/(\d+)/); const w = m ? parseInt(m[1]) : 0; return w >= needed; });
  }
  psuCandidates.sort((a,b) => a.price - b.price);
  if (psuCandidates.length > 0) selected.psu = psuCandidates[0];

  let caseCandidates = PARTS.filter(p => p.cat === 'case' && availFilter(p) && p.price <= Math.min(bMax * 0.08, 200));
  if (style === 'minimal') caseCandidates = caseCandidates.filter(p => !p.name.includes('RGB') && !p.name.includes('Glass'));
  if (style === 'gamer' || style === 'show') caseCandidates = caseCandidates.filter(p => p.name.includes('RGB') || p.name.includes('Glass') || p.name.includes('AORUS') || p.name.includes('ROG'));
  if (style === 'silent') caseCandidates = caseCandidates.filter(p => p.name.includes('Airflow') || p.name.includes('Silent'));
  if (caseCandidates.length === 0) caseCandidates = PARTS.filter(p => p.cat === 'case' && availFilter(p) && p.price <= Math.min(bMax * 0.08, 200));
  caseCandidates.sort((a,b) => a.price - b.price);
  if (caseCandidates.length > 0) selected.case = caseCandidates[0];

  let coolCandidates = PARTS.filter(p => p.cat === 'cooling' && availFilter(p) && p.price <= Math.min(bMax * 0.06, 150));
  if (style === 'silent') coolCandidates = coolCandidates.filter(p => p.name.includes('Noctua') || p.name.includes('be quiet') || p.name.includes('Liquid Freezer'));
  if (style === 'gamer' || style === 'show') coolCandidates = coolCandidates.filter(p => p.name.includes('RGB') || p.name.includes('ARGB'));
  if (coolCandidates.length === 0) coolCandidates = PARTS.filter(p => p.cat === 'cooling' && availFilter(p) && p.price <= Math.min(bMax * 0.06, 150));
  coolCandidates.sort((a,b) => a.price - b.price);
  if (coolCandidates.length > 0) selected.cooling = coolCandidates[0];

  return selected;
}

const tests = [
  ['300-500',    'basic',         'in-stock', 'minimal'],
  ['500-800',    'gaming-mid',    'in-stock', 'gamer'],
  ['800-1200',   'gaming-high',   'mixed',    'gamer'],
  ['1200-2000',  'gaming-ultra',  'mixed',    'show'],
  ['2000+',      'workstation',   'any',      'show'],
  ['300-500',    'basic',         'any',      'silent'],
];

console.log('=== AI BUILD VERIFICATION ===\n');
for (const [budget, perf, avail, style] of tests) {
  const build = aiTest(budget, perf, avail, style);
  const count = Object.keys(build).length;
  const total = Object.values(build).reduce((s,p) => s + p.price, 0);
  const labels = { cpu:'CPU', gpu:'GPU', mobo:'Mobo', ram:'RAM', storage:'Storage', psu:'PSU', case:'Case', cooling:'Cooling' };
  const partsList = Object.entries(build).map(([k,v]) => `${labels[k]||k}: ${v.brand} ${v.name} ($${v.price})`).join('\n  ');
  console.log(`Budget ${budget} | Perf ${perf} | Avail ${avail} | Style ${style}`);
  console.log(`  Parts: ${count} ($${total} total)`);
  if (partsList) console.log(`  ${partsList}`);
  console.log('');
}

console.log('=== CATALOG STATS ===');
for (const cat of ['cpu','gpu','ram','mobo','storage','psu','case','cooling']) {
  const all = PARTS.filter(p => p.cat === cat);
  const inStock = all.filter(p => p.stock === 'in' || p.stock === 'low');
  const limited = all.filter(p => p.limited);
  const preorders = all.filter(p => p.preorder);
  console.log(`${cat.padEnd(12)}: ${all.length} total, ${inStock.length} available, ${limited.length} limited, ${preorders.length} pre-order`);
}
console.log(`\nTotal parts in catalog: ${PARTS.length}`);
console.log(`Limited/rare editions: ${PARTS.filter(p=>p.limited).length}`);
console.log(`Pre-order items: ${PARTS.filter(p=>p.preorder).length}`);
