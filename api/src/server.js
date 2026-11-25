import express from 'express';
import helmet from 'helmet';
import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const app = express();
const port = Number(process.env.PORT || 3000);
const outputDir = process.env.VIDEO_OUTPUT_DIR || '/data/videos';
const jobs = new Map();
const requestTimes = new Map();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '32kb' }));

function rateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const recent = (requestTimes.get(key) || []).filter(time => now - time < 60_000);
  if (recent.length >= 5) return res.status(429).json({ error: 'Please wait a minute before starting another generation.' });
  recent.push(now);
  requestTimes.set(key, recent);
  next();
}

app.get('/api/health', (_, res) => res.json({ ok: true, videoProvider: 'google-veo' }));

app.post('/api/videos', rateLimit, async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  const aspectRatio = ['16:9', '9:16', '1:1'].includes(req.body?.aspectRatio) ? req.body.aspectRatio : '16:9';
  if (prompt.length < 8 || prompt.length > 2000) return res.status(400).json({ error: 'Prompt must be between 8 and 2,000 characters.' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Video generation is not configured yet. Add GEMINI_API_KEY to the VPS environment, then restart the app.' });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const operation = await ai.models.generateVideos({
      model: process.env.GEMINI_VIDEO_MODEL || 'veo-3.1-generate-001',
      prompt,
      config: { numberOfVideos: 1, aspectRatio, durationSeconds: 8 }
    });
    const id = randomUUID();
    jobs.set(id, { id, status: 'processing', operationName: operation.name, prompt, createdAt: new Date().toISOString() });
    res.status(202).json({ id, status: 'processing', message: 'Video generation started.' });
  } catch (error) {
    console.error('Video generation request failed:', error.message);
    res.status(502).json({ error: 'The video provider could not start this generation. Check provider access, billing, and model availability.' });
  }
});

app.get('/api/videos/:id', async (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Generation not found. Jobs are held in memory until the API restarts.' });
  if (job.status === 'processing' && !job.checking) {
    job.checking = true;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const operation = await ai.operations.get({ operation: { name: job.operationName } });
      if (operation.done) {
        const response = operation.response || {};
        const generated = response.generatedVideos?.[0] || response.generated_videos?.[0];
        const video = generated?.video;
        if (!video) throw new Error('Provider completed without a video file.');
        await mkdir(outputDir, { recursive: true });
        job.filePath = path.join(outputDir, `${job.id}.mp4`);
        await ai.files.download({ file: video, downloadPath: job.filePath });
        job.status = 'completed';
      }
    } catch (error) {
      console.error('Video status/download failed:', error.message);
      job.status = 'failed';
      job.error = 'Could not retrieve the generated video. Check API access and server storage.';
    } finally {
      job.checking = false;
    }
  }
  res.json({ id: job.id, status: job.status, error: job.error, createdAt: job.createdAt });
});

app.get('/api/videos/:id/file', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== 'completed' || !job.filePath) return res.status(404).json({ error: 'Video is not ready.' });
  res.type('video/mp4').sendFile(job.filePath);
});

app.listen(port, '0.0.0.0', () => console.log(`Bigooay video API listening on ${port}`));
