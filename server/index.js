const http = require('http');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const MIMO_API_KEY = process.env.MIMO_API_KEY;
const MIMO_BASE_URL = 'https://token-plan-sgp.xiaomimimo.com/anthropic';
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

        const [assets, maintenance] = await Promise.all([
          fetchFromSupabase('assets'),
          fetchFromSupabase('maintenance_records'),
        ]);

        const totalAssets = assets.length;
        const activeAssets = assets.filter(a => a.status?.toLowerCase() === 'active').length;
        const brokenAssets = assets.filter(a => a.status?.toLowerCase() === 'broken').length;
        const inMaintenance = assets.filter(a => a.status?.toLowerCase().includes('maintenance')).length;
        const pendingMaint = maintenance.filter(m => m.status?.toLowerCase() === 'pending').length;
        const doneMaint = maintenance.filter(m => m.status?.toLowerCase() === 'done').length;

        const systemPrompt = `Kamu adalah asisten AI untuk dashboard manajemen aset perusahaan Raja.
Jawab pertanyaan user berdasarkan data berikut. Jawab dalam Bahasa Indonesia, ringkas dan akurat.

=== RINGKASAN ===
Total Aset: ${totalAssets} | Aktif: ${activeAssets} | Rusak: ${brokenAssets} | Dalam Maintenance: ${inMaintenance}
Total Maintenance: ${maintenance.length} | Pending: ${pendingMaint} | Selesai: ${doneMaint}

=== DATA ASET ===
${JSON.stringify(assets.map(a => ({
  no: a.asset_number, deskripsi: a.asset_description,
  kategori1: a.category_segment1, kategori2: a.category_segment2,
  subsidiary: a.subsidiary, status: a.status,
  biaya: a.asset_cost, unit: a.asset_units,
  tgl_pakai: a.date_place_in_service,
})))}

=== DATA MAINTENANCE ===
${JSON.stringify(maintenance.map(m => ({
  no: m.asset_number, deskripsi: m.asset_description,
  service: m.service_type, status: m.status,
  jadwal: m.scheduled_date, estimasi: m.estimate_cost, aktual: m.actual_cost,
})))}`;

        const mimoRes = await fetch(`${MIMO_BASE_URL}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': MIMO_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: MIMO_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [...history, { role: 'user', content: question }],
          }),
        });

        if (!mimoRes.ok) {
          const errText = await mimoRes.text();
          console.error('MiMo error:', errText);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `MiMo API error: ${errText}` }));
        }

        const data = await mimoRes.json();
        const answer = data.content[0].text;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ answer }));
      } catch (err) {
        console.error('Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = parseInt(process.env.PORT) || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Raja AI server running on port ${PORT}`);
});
