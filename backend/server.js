import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json({ limit: process.env.JSON_LIMIT || '250mb' }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_MEDIA = Number(process.env.MAX_MEDIA_PER_REQUEST || 20);
const REPO = process.env.GITHUB_REPO || 'izzatqalandarov169-sys/Superme_ai_chatgpt_model';
const WORKFLOW = process.env.GITHUB_WORKFLOW || 'superme-build.yml';

app.get('/health', (_req, res) => res.json({ ok: true, service: 'SUPERME AI' }));

app.get('/api/config/status', (_req, res) => {
  res.json({
    openai: Boolean(process.env.OPENAI_API_KEY),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    githubBuild: Boolean(process.env.GITHUB_TOKEN),
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna'
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], images = [], videos = [] } = req.body;
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    if (!Array.isArray(messages) || !Array.isArray(images) || !Array.isArray(videos)) {
      return res.status(400).json({ error: 'messages, images and videos must be arrays' });
    }
    if (images.length + videos.length > MAX_MEDIA) {
      return res.status(400).json({ error: `Too many media items. Maximum is ${MAX_MEDIA} per request.` });
    }

    const latest = messages.at(-1) || { role: 'user', content: '' };
    const content = [{ type: 'input_text', text: String(latest.content || '') }];
    for (const image of images) {
      if (typeof image === 'string' && /^data:image\//.test(image)) {
        content.push({ type: 'input_image', image_url: image });
      }
    }
    for (const video of videos) {
      if (Array.isArray(video?.frames)) {
        for (const frame of video.frames) {
          if (typeof frame === 'string' && /^data:image\//.test(frame)) {
            content.push({ type: 'input_image', image_url: frame });
          }
        }
      }
    }

    const prior = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '')
    }));

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      instructions: 'You are SUPERME AI. Be helpful, clear, creative, and respond in Uzbek when the user writes Uzbek. You are also a coding and project-building assistant. When asked to build a project, explain the required files, commands and build target. Analyze supplied images carefully. For videos, reason only from supplied representative frames. Never expose API keys or other secrets.',
      input: [...prior, { role: 'user', content }]
    });

    res.json({ id: response.id, text: response.output_text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || 'AI request failed' });
  }
});

app.post('/api/build', async (req, res) => {
  try {
    if (!process.env.GITHUB_TOKEN) return res.status(503).json({ error: 'GITHUB_TOKEN is not configured for build control' });
    const target = req.body?.target === 'zip' ? 'zip' : 'web';
    const artifactName = String(req.body?.artifact_name || `superme-ai-${target}`).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
    const response = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${encodeURIComponent(WORKFLOW)}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: process.env.GITHUB_REF || 'main', inputs: { target, artifact_name: artifactName } })
    });
    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({ error: `GitHub build dispatch failed: ${body.slice(0, 500)}` });
    }
    res.json({ ok: true, target, artifact_name: artifactName, message: 'Build workflow started' });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Build request failed' });
  }
});

app.post('/api/telegram/test', async (_req, res) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      return res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured' });
    }
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: '🤖 SUPERME AI Telegram bot connection test: OK' })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return res.status(502).json({ error: data.description || 'Telegram request failed' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Telegram request failed' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SUPERME AI backend listening on ${port}`));
