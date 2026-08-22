import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get('/health', (_req, res) => res.json({ ok: true, service: 'SUPERME AI' }));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [] } = req.body;
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      instructions: 'You are SUPERME AI. Be helpful, clear, creative, and respond in Uzbek when the user writes Uzbek. Follow applicable safety requirements.',
      input: messages
    });

    res.json({ id: response.id, text: response.output_text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || 'AI request failed' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SUPERME AI backend listening on ${port}`));
