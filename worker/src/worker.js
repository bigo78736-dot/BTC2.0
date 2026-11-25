import pg from 'pg';
import Redis from 'ioredis';
import { GoogleGenAI } from '@google/genai';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
const outputDir = process.env.VIDEO_OUTPUT_DIR || '/data/videos';

async function processJob(job) {
  await pool.query("UPDATE video_jobs SET status='processing', updated_at=now() WHERE id=$1", [job.id]);
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const operation = await ai.models.generateVideos({
      model: process.env.GEMINI_VIDEO_MODEL || 'veo-3.1-generate-001',
      prompt: job.prompt,
      config: { numberOfVideos: 1, aspectRatio: job.aspectRatio, durationSeconds: 8 }
    });
    await pool.query('UPDATE video_jobs SET provider_job=$1, updated_at=now() WHERE id=$2', [operation.name, job.id]);

    let current = operation;
    while (!current.done) {
      await new Promise(resolve => setTimeout(resolve, 8000));
      current = await ai.operations.get({ operation: { name: operation.name } });
    }

    const response = current.response || {};
    const generated = response.generatedVideos?.[0] || response.generated_videos?.[0];
    const video = generated?.video;
    if (!video) throw new Error('Provider returned no video');
    await mkdir(outputDir, { recursive: true });
    const filePath = path.join(outputDir, `${job.id}.mp4`);
    await ai.files.download({ file: video, downloadPath: filePath });
    await pool.query("UPDATE video_jobs SET status='completed',file_path=$1,updated_at=now() WHERE id=$2", [filePath, job.id]);
  } catch (error) {
    await pool.query("UPDATE video_jobs SET status='failed',error=$1,updated_at=now() WHERE id=$2", [error.message.slice(0, 500), job.id]);
  }
}

async function loop() {
  while (true) {
    const result = await redis.brpop('bigooay:video_jobs', 5);
    if (!result) continue;
    await processJob(JSON.parse(result[1])).catch(console.error);
  }
}

loop().catch(error => { console.error(error); process.exit(1); });
