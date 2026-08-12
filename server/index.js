const http = require('http');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const MIMO_API_KEY = process.env.MIMO_API_KEY;
const MIMO_BASE_URL = 'https://api.xiaomimimo.com/anthropic';
const MIMO_MODEL = process.env.MIMO_MODEL;

async function fetchFromSupabase(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase error on ${table}: ${await res.text()}`);
  return res.json();
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function toCsv(rows, columns) {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map(r => columns.map(c => escape(r[c])).join(','));
  return [columns.join(','), ...lines].join('\n');
}

function assetYear(a) {
  if (!a.date_place_in_service) return null;
  const y = new Date(a.date_place_in_service).getFullYear();
  return Number.isNaN(y) ? null : y;
}

function computeAssetAggregates(assets) {
  const maxCostByYear = new Map();
  for (const a of assets) {
    const year = assetYear(a);
    if (!year) continue;
    const cost = Number(a.asset_cost) || 0;
    const current = maxCostByYear.get(year);
    if (!current || cost > current.biaya) {
      maxCostByYear.set(year, {
        tahun: year, no: a.asset_number, deskripsi: a.asset_description,
        subsidiary: a.subsidiary, biaya: cost,
      });
    }
  }

  const top10ByCost = [...assets]
    .sort((a, b) => (Number(b.asset_cost) || 0) - (Number(a.asset_cost) || 0))
    .slice(0, 10)
    .map(a => ({
      no: a.asset_number, deskripsi: a.asset_description, subsidiary: a.subsidiary,
      biaya: Number(a.asset_cost) || 0, tahun: assetYear(a),
    }));

  const byYear = new Map();
  for (const a of assets) {
    const year = assetYear(a);
    if (!year) continue;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(a);
  }
  const top5ByYear = Object.fromEntries(
    [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, list]) => [
      year,
      [...list]
        .sort((a, b) => (Number(b.asset_cost) || 0) - (Number(a.asset_cost) || 0))
        .slice(0, 5)
        .map(a => ({ no: a.asset_number, deskripsi: a.asset_description, subsidiary: a.subsidiary, biaya: Number(a.asset_cost) || 0 })),
    ])
  );

  const groupBy = (key) => {
    const groups = new Map();
    for (const a of assets) {
      const k = a[key] || 'Unknown';
      const g = groups.get(k) || { count: 0, totalBiaya: 0 };
      g.count += 1;
      g.totalBiaya += Number(a.asset_cost) || 0;
      groups.set(k, g);
    }
    return Object.fromEntries(groups);
  };

  return {
    maxCostByYear: [...maxCostByYear.values()].sort((a, b) => a.tahun - b.tahun),
    top10ByCost,
    top5ByYear,
    bySubsidiary: groupBy('subsidiary'),
    byCategory: groupBy('category_segment1'),
  };
}

const CACHE_TTL_MS = 90 * 1000;
let dataCache = { expiresAt: 0, payload: null };

async function getAssetData() {
  if (dataCache.payload && Date.now() < dataCache.expiresAt) {
    return dataCache.payload;
  }

  const [assets, maintenance] = await Promise.all([
    fetchFromSupabase('assets'),
    fetchFromSupabase('maintenance_records'),
  ]);

  const payload = { assets, maintenance, agg: computeAssetAggregates(assets) };
  dataCache = { expiresAt: Date.now() + CACHE_TTL_MS, payload };
  return payload;
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { question, history = [] } = JSON.parse(body);

        if (!question) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'question is required' }));
        }

        const { assets, maintenance, agg } = await getAssetData();

        const totalAssets = assets.length;
        const activeAssets = assets.filter(a => a.status?.toLowerCase() === 'active').length;
        const brokenAssets = assets.filter(a => a.status?.toLowerCase() === 'broken').length;
        const inMaintenance = assets.filter(a => a.status?.toLowerCase().includes('maintenance')).length;
        const pendingMaint = maintenance.filter(m => m.status?.toLowerCase() === 'pending').length;
        const doneMaint = maintenance.filter(m => m.status?.toLowerCase() === 'done').length;

        const assetsCsv = toCsv(
          assets.map(a => ({
            no: a.asset_number, deskripsi: a.asset_description,
            kategori1: a.category_segment1, kategori2: a.category_segment2,
            subsidiary: a.subsidiary, status: a.status,
            biaya: a.asset_cost, unit: a.asset_units,
            tgl_pakai: a.date_place_in_service,
          })),
          ['no', 'deskripsi', 'kategori1', 'kategori2', 'subsidiary', 'status', 'biaya', 'unit', 'tgl_pakai']
        );

        const maintenanceCsv = toCsv(
          maintenance.map(m => ({
            no: m.asset_number, deskripsi: m.asset_description,
            service: m.service_type, status: m.status,
            jadwal: m.scheduled_date, estimasi: m.estimate_cost, aktual: m.actual_cost,
          })),
          ['no', 'deskripsi', 'service', 'status', 'jadwal', 'estimasi', 'aktual']
        );

        const systemPrompt = `Kamu adalah asisten AI untuk dashboard manajemen aset perusahaan Raja.
Jawab pertanyaan user berdasarkan data berikut. Jawab dalam Bahasa Indonesia, ringkas dan akurat.
Untuk pertanyaan soal nilai tertinggi/terendah/top-N, PRIORITASKAN angka dari bagian "AGREGAT" di bawah (sudah dihitung akurat) daripada menghitung ulang dari data mentah.

=== RINGKASAN ===
Total Aset: ${totalAssets} | Aktif: ${activeAssets} | Rusak: ${brokenAssets} | Dalam Maintenance: ${inMaintenance}
Total Maintenance: ${maintenance.length} | Pending: ${pendingMaint} | Selesai: ${doneMaint}

=== AGREGAT: ASET BIAYA TERTINGGI PER TAHUN (date_place_in_service) ===
${JSON.stringify(agg.maxCostByYear)}

=== AGREGAT: TOP 10 ASET TERMAHAL (keseluruhan) ===
${JSON.stringify(agg.top10ByCost)}

=== AGREGAT: TOP 5 ASET TERMAHAL PER TAHUN (date_place_in_service) ===
${JSON.stringify(agg.top5ByYear)}

=== AGREGAT: JUMLAH & TOTAL BIAYA PER SUBSIDIARY ===
${JSON.stringify(agg.bySubsidiary)}

=== AGREGAT: JUMLAH & TOTAL BIAYA PER KATEGORI ===
${JSON.stringify(agg.byCategory)}

=== DATA ASET (CSV, mentah, untuk pertanyaan di luar agregat di atas) ===
${assetsCsv}

=== DATA MAINTENANCE (CSV) ===
${maintenanceCsv}`;

        const mimoRes = await fetch(`${MIMO_BASE_URL}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': MIMO_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: MIMO_MODEL,
            max_tokens: 2048,
            system: systemPrompt,
            stream: true,
            messages: [...history, { role: 'user', content: question }],
          }),
        });

        if (!mimoRes.ok) {
          const errText = await mimoRes.text();
          console.error('MiMo error:', errText);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `MiMo API error: ${errText}` }));
        }

        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });

        const reader = mimoRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let stopReason = null;
        let wroteAnyText = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const evt of events) {
            const dataLine = evt.split('\n').find(l => l.startsWith('data:'));
            if (!dataLine) continue;
            let parsed;
            try {
              parsed = JSON.parse(dataLine.slice(5).trim());
            } catch {
              continue;
            }
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              wroteAnyText = true;
              res.write(parsed.delta.text);
            } else if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
              stopReason = parsed.delta.stop_reason;
            }
          }
        }

        if (!wroteAnyText) {
          console.error(`MiMo returned no text content (stop_reason: ${stopReason})`);
          res.write('Maaf, pertanyaan ini terlalu kompleks untuk dijawab langsung. Coba pertanyaan yang lebih spesifik atau sederhana.');
        }

        return res.end();
      } catch (err) {
        console.error('Error:', err);
        if (res.headersSent) {
          return res.end();
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const REQUIRED_ENV = {
  SUPABASE_URL: SUPABASE_URL,
  SUPABASE_ANON_KEY: SUPABASE_KEY,
  MIMO_API_KEY: MIMO_API_KEY,
  MIMO_MODEL: MIMO_MODEL,
};
const missingEnv = Object.entries(REQUIRED_ENV).filter(([, v]) => !v).map(([k]) => k);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnv.join(', ')}`);
  process.exit(1);
}

const PORT = parseInt(process.env.PORT) || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Raja AI server running on port ${PORT}`);
});
