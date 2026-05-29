import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { PORT, WEBHOOK_URL, TIMEZONE } from './config.js';
import { createBot, getChatId } from './bot.js';
import { initState, getState, saveState, applyPatch } from './db.js';
import { addClient, removeClient, broadcast } from './sse.js';

const app = express();
app.use(express.json());

// CORS — allow dashboard from any origin (file:// or deployed)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── SSE: real-time stream to dashboard ──────────────────────────────────────
app.get('/api/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send full state immediately on connect
  const state = await getState();
  res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);

  addClient(res);
  req.on('close', () => removeClient(res));
});

// ── REST: state read / write ─────────────────────────────────────────────────
app.get('/api/state', async (req, res) => {
  try { res.json(await getState()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Full state replacement (sent by dashboard)
app.post('/api/state', async (req, res) => {
  try {
    const newState = await saveState(req.body);
    broadcast('state', newState);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Incremental patch (sent by dashboard for individual actions)
app.post('/api/patch', async (req, res) => {
  try {
    const newState = await applyPatch(req.body);
    broadcast('state', newState);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/health', (_, res) => res.send('ok'));

// ── Telegram webhook ─────────────────────────────────────────────────────────
const bot = createBot();

app.post('/webhook', async (req, res) => {
  try { await bot.processUpdate(req.body); res.sendStatus(200); }
  catch (err) { console.error('Webhook error:', err); res.sendStatus(500); }
});

// ── Midnight habit reset (São Paulo time) ────────────────────────────────────
cron.schedule('0 0 * * *', async () => {
  try {
    const state = await applyPatch({ reset_habits: true });
    broadcast('state', state);
    const chatId = getChatId();
    if (chatId) await bot.sendMessage(chatId, '🌙 New day. Habits reset. Bora!');
  } catch (err) { console.error('Midnight reset error:', err); }
}, { timezone: TIMEZONE });

// ── Boot ─────────────────────────────────────────────────────────────────────
const main = async () => {
  await initState();

  if (WEBHOOK_URL) {
    const url = WEBHOOK_URL.replace(/\/$/, '') + '/webhook';
    await bot.setWebHook(url);
    console.log(`Telegram webhook → ${url}`);
  } else {
    console.log('Telegram polling mode (local dev — no WEBHOOK_URL set)');
  }

  app.listen(PORT, () => console.log(`Felipe OS Bot running on port ${PORT}`));
};

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
