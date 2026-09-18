const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
let port = Number(process.env.PORT || 8787);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20000) req.destroy(new Error('Request too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handleChat(req, res) {
  if (!process.env.GROQ_API_KEY) return send(res, 503, JSON.stringify({ error: 'GROQ_API_KEY is not configured on the server.' }));
  try {
    const payload = JSON.parse(await readBody(req));
    const messages = Array.isArray(payload.messages) ? payload.messages.slice(-12) : [];
    const safeMessages = messages.filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string').map(item => ({ role: item.role, content: item.content.slice(0, 2500) }));
    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== 'user') return send(res, 400, JSON.stringify({ error: 'Send a user message.' }));
    let model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    let available = [];
    try {
      const modelsResponse = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } });
      const modelsData = await modelsResponse.json();
      available = Array.isArray(modelsData.data) ? modelsData.data.map(item => item.id) : [];
    } catch (_) {
      // Use the fallback list if the model-list request is unavailable.
    }
    const candidates = [model, 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'groq/compound-mini', 'llama-3.3-70b-versatile'];
    const matching = available.length ? candidates.filter(candidate => available.includes(candidate)) : [];
    const modelsToTry = [...new Set(matching.length ? matching : (available.length ? available.slice(0, 5) : candidates))];
    let response;
    let data;
    for (const candidate of modelsToTry) {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: candidate,
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'You are Core, the PC parts assistant for Render Shop. Give practical, concise advice for beginners. Use the selected build context when provided. Do not invent stock, prices, compatibility, or product availability. If information is missing, say so. Recommend checking motherboard socket, RAM type, PSU wattage, case clearance, and cooling before buying.' },
            ...safeMessages
          ]
        })
      });
      data = await response.json();
      if (response.ok) break;
    }
    if (!response.ok) return send(res, response.status, JSON.stringify({ error: data.error?.message || 'No available Groq model accepted the request.' }));
    const text = data.choices?.[0]?.message?.content || 'I could not produce a response.';
    send(res, 200, JSON.stringify({ text }));
  } catch (error) {
    send(res, 500, JSON.stringify({ error: 'The assistant could not process that request.' }));
  }
}

const server = http.createServer(async (req, res) => {
  const requestURL = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const requestPath = requestURL.pathname.replace(/\/+$/, '') || '/';
  if (req.method === 'OPTIONS' && requestPath === '/api/chat') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' });
    return res.end();
  }
  if (req.method === 'POST' && requestPath === '/api/chat') return handleChat(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, JSON.stringify({ error: 'Method not allowed.' }));
  const requested = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const target = path.resolve(root, file);
  if (!target.startsWith(root) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(target).pipe(res);
});

function startServer() {
  const onListening = () => console.log(`Render Shop running at http://localhost:${port}`);
  const handleError = error => {
    if (error.code !== 'EADDRINUSE') throw error;
    server.removeListener('listening', onListening);
    port += 1;
    console.log(`Port ${port - 1} is busy; trying port ${port}.`);
    startServer();
  };
  server.once('error', handleError);
  server.once('listening', onListening);
  server.listen(port, '0.0.0.0');
}

startServer();
