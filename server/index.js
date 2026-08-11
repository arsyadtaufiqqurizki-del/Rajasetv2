const MIMO_BASE_URL = 'https://api.xiaomimimo.com/anthropic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function fetchFromSupabase(env, table) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase error on ${table}: ${await res.text()}`);
  return res.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ status: 'ok' });
    }

    if (request.method === 'POST' && url.pathname === '/chat') {
      try {
        const { question, history = [] } = await request.json();

        if (!question) {
          return json({ error: 'question is required' }, 400);
        }

        const [assets, maintenance] = await Promise.all([
          fetchFromSupabase(env, 'assets'),
          fetchFromSupabase(env, 'maintenance_records'),
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
            'x-api-key': env.MIMO_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: env.MIMO_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [...history, { role: 'user', content: question }],
          }),
        });

        if (!mimoRes.ok) {
          const errText = await mimoRes.text();
          console.error('MiMo error:', errText);
          return json({ error: `MiMo API error: ${errText}` }, 502);
        }

        const data = await mimoRes.json();
        const answer = data.content[0].text;

        return json({ answer });
      } catch (err) {
        console.error('Error:', err);
        return json({ error: err.message }, 500);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
