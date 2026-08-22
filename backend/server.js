import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json({ limit: process.env.JSON_LIMIT || '250mb' }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_MEDIA = Number(process.env.MAX_MEDIA_PER_REQUEST || 300);

app.get('/health', (_req, res) => res.json({ ok: true, service: 'SUPERME AI' }));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], images = [], videos = [] } = req.body;
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    if (images.length + videos.length > MAX_MEDIA) return res.status(400).json({ error: `Too many media items. Maximum is ${MAX_MEDIA} per request.` });

    // Images are sent as multimodal Responses API input parts.
    const latest = messages.at(-1) || { role: 'user', content: '' };
    const content = [{ type: 'input_text', text: String(latest.content || '') }];
    for (const image of images) {
      if (typeof image === 'string' && /^data:image\//.test(image)) content.push({ type: 'input_image', image_url: image });
    }

    // Video is handled through a frame/sample pipeline rather than pretending that
    // a raw video URL is an image input. The client may provide extracted frames.
    for (const video of videos) {
      if (Array.isArray(video?.frames)) {
        for (const frame of video.frames) {
          if (typeof frame === 'string' && /^data:image\//.test(frame)) content.push({ type: 'input_image', image_url: frame });
        }
      }
    }

    const prior = messages.slice(0, -1);
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      instructions: 'You are SUPERME AI. Be helpful, clear, creative, and respond in Uzbek when the user writes Uzbek. Analyze supplied images carefully. For videos, reason from the supplied representative frames and metadata. Follow applicable safety requirements.',
      input: [...prior, { role: 'user', content }]
    });

    res.json({ id: response.id, text: response.output_text, media_received: { images: images.length, videos: videos.length } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || 'AI request failed' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SUPERME AI backend listening on ${port}`));
