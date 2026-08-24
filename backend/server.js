import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: process.env.JSON_LIMIT || '250mb' }));

const MAX_MEDIA = Number(process.env.MAX_MEDIA_PER_REQUEST || 20);
const REPO = process.env.GITHUB_REPO || 'izzatqalandarov169-sys/Superme_ai_chatgpt_model';
const WORKFLOW = process.env.GITHUB_WORKFLOW || 'superme-build.yml';
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

const SYSTEM_PROMPT = `You are SUPERME AI, a general-purpose AI assistant.
- Be accurate, direct and useful. Do not invent facts when you are uncertain.
- Reply in the user's language; if the user writes Uzbek, answer in natural Uzbek.
- For coding tasks, give production-minded solutions and explain important trade-offs briefly.
- Use clear Markdown when it improves readability.
- Never reveal, reproduce, or guess API keys, tokens, passwords, environment variables, or other secrets.
- You are not ChatGPT and must not falsely claim to be OpenAI or ChatGPT.`;

function openaiClient() {
  return import('openai').then(({ default: OpenAI }) => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}

function buildInput(messages, images = [], videos = []) {
  const normalized = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({ role: m.role, content: String(m.content || '') }));

  const last = normalized.pop() || { role: 'user', content: '' };
  const content = [{ type: 'input_text', text: last.content }];
  for (const image of images) {
    if (typeof image === 'string' && /^data:image\//.test(image)) content.push({ type: 'input_image', image_url: image });
  }
  for (const video of videos) {
    for (const frame of Array.isArray(video?.frames) ? video.frames : []) {
      if (typeof frame === 'string' && /^data:image\//.test(frame)) content.push({ type: 'input_image', image_url: frame });
    }
  }
  return [...normalized, { role: 'user', content }];
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'SUPERME AI', model: MODEL }));

app.get('/api/config/status', (_req, res) => res.json({
  openai: Boolean(process.env.OPENAI_API_KEY),
  githubBuild: Boolean(process.env.GITHUB_TOKEN),
  telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  model: MODEL
}));

app.post('/api/chat', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    const { messages = [], images = [], videos = [] } = req.body;
    if (!Array.isArray(messages) || !Array.isArray(images) || !Array.isArray(videos)) return res.status(400).json({ error: 'messages, images and videos must be arrays' });
    if (images.length + videos.length > MAX_MEDIA) return res.status(400).json({ error: `Too many media items. Maximum is ${MAX_MEDIA} per request.` });

    const client = await openaiClient();
    const response = await client.responses.create({ model: MODEL, instructions: SYSTEM_PROMPT, input: buildInput(messages, images, videos) });
    res.json({ id: response.id, text: response.output_text, model: MODEL });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || 'AI request failed' });
  }
});

app.post('/api/chat/stream', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    const { messages = [], images = [], videos = [] } = req.body;
    if (!Array.isArray(messages) || !Array.isArray(images) || !Array.isArray(videos)) return res.status(400).json({ error: 'messages, images and videos must be arrays' });
    if (images.length + videos.length > MAX_MEDIA) return res.status(400).json({ error: `Too many media items. Maximum is ${MAX_MEDIA} per request.` });

    const client = await openaiClient();
    const stream = await client.responses.create({ model: MODEL, instructions: SYSTEM_PROMPT, input: buildInput(messages, images, videos), stream: true });
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    for await (const event of stream) {
      if (event.type === 'response.output_text.delta' && event.delta) res.write(`data: ${JSON.stringify({ type: 'delta', text: event.delta })}\n\n`);
      if (event.type === 'response.completed') res.write(`data: ${JSON.stringify({ type: 'done', id: event.response?.id || null, model: MODEL })}\n\n`);
    }
    res.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) return res.status(500).json({ error: error?.message || 'AI streaming request failed' });
    res.write(`data: ${JSON.stringify({ type: 'error', error: error?.message || 'AI streaming request failed' })}\n\n`);
    res.end();
  }
});

app.post('/api/build', async (req, res) => {
  try {
    if (!process.env.GITHUB_TOKEN) return res.status(503).json({ error: 'GITHUB_TOKEN is not configured for build control' });
    const target = req.body?.target === 'zip' ? 'zip' : 'web';
    const artifactName = String(req.body?.artifact_name || `superme-ai-${target}`).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
    const response = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${encodeURIComponent(WORKFLOW)}/dispatches`, {
      method: 'POST',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: process.env.GITHUB_REF || 'main', inputs: { target, artifact_name: artifactName } })
    });
    if (!response.ok) return res.status(response.status).json({ error: `GitHub build dispatch failed: ${(await response.text()).slice(0, 500)}` });
    res.json({ ok: true, target, artifact_name: artifactName, message: 'Build workflow started' });
  } catch (error) { res.status(500).json({ error: error?.message || 'Build request failed' }); }
});

app.post('/api/telegram/test', async (_req, res) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return res.status(503).json({ error: 'Telegram secrets are not configured' });
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: 'SUPERME AI: Telegram test OK ✅' })
    });
    const data = await r.json();
    if (!r.ok || !data.ok) return res.status(r.status || 500).json({ error: data.description || 'Telegram test failed' });
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: error?.message || 'Telegram test failed' }); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SUPERME AI backend listening on ${port} using ${MODEL}`));
