import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from '@google/genai';
import pg from 'pg';
import Redis from 'ioredis';
import { randomUUID, randomBytes } from 'node:crypto';

const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.APP_ORIGIN || false, credentials: true }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7' }));

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL,
    display_name text NOT NULL, role text NOT NULL DEFAULT 'creator', credits integer NOT NULL DEFAULT 20,
    consent_verified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS video_jobs (
    id uuid PRIMARY KEY, user_id uuid REFERENCES users(id), prompt text NOT NULL,
    aspect_ratio text NOT NULL, status text NOT NULL DEFAULT 'queued', provider_job text,
    file_path text, error text, rights_confirmed boolean NOT NULL DEFAULT false,
    provider_name text NOT NULL DEFAULT 'google-veo', created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS consent_records (
    id uuid PRIMARY KEY, user_id uuid REFERENCES users(id), subject_name text,
    consent_file_path text, consented_at timestamptz, expires_at timestamptz,
    purpose text NOT NULL, revoked boolean NOT NULL DEFAULT false
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS audit_events (
    id uuid PRIMARY KEY, user_id uuid, action text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
  );`);
}

function signUser(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'change-me-now', { expiresIn: '7d' });
}

async function auth(req, res, next) {
  try {
    const token = req.cookies?.session || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const data = jwt.verify(token, process.env.JWT_SECRET || 'change-me-now');
    const result = await pool.query('SELECT id,email,display_name,role,credits,consent_verified FROM users WHERE id=$1', [data.sub]);
    if (!result.rows.length) return res.status(401).json({ error: 'User not found.' });
    req.user = result.rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

async function audit(userId, action, metadata = {}) {
  await pool.query('INSERT INTO audit_events(id,user_id,action,metadata) VALUES($1,$2,$3,$4)', [randomUUID(), userId, action, JSON.stringify(metadata)]).catch(() => {});
}

app.get('/api/health', async (_, res) => {
  await pool.query('SELECT 1');
  await redis.ping();
  res.json({ ok: true, database: 'connected', queue: 'connected' });
});

app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || '').trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || !displayName) return res.status(400).json({ error: 'Use a valid email, 12+ character password, and display name.' });
  try {
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query('INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,$3,$4) RETURNING id,email,display_name,role,credits,consent_verified', [id, email, passwordHash, displayName]);
    await audit(id, 'account.registered', { email });
    const token = signUser(result.rows[0]);
    res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email is already registered.' });
    throw error;
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const result = await pool.query('SELECT id,email,password_hash,display_name,role,credits,consent_verified FROM users WHERE email=$1', [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
  await audit(user.id, 'account.login', {});
  const token = signUser(user);
  res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
  const { password_hash, ...safe } = user;
  res.json({ user: safe });
});

app.post('/api/auth/logout', (_, res) => { res.clearCookie('session'); res.json({ ok: true }); });
app.get('/api/me', auth, async (req, res) => res.json({ user: req.user }));

app.post('/api/consent', auth, async (req, res) => {
  const purpose = String(req.body?.purpose || '').trim().slice(0, 500);
  const subjectName = String(req.body?.subjectName || '').trim().slice(0, 100);
  if (purpose.length < 8) return res.status(400).json({ error: 'Describe the consent purpose.' });
  const id = randomUUID();
  await pool.query('INSERT INTO consent_records(id,user_id,subject_name,consented_at,purpose) VALUES($1,$2,$3,now(),$4)', [id, req.user.id, subjectName, purpose]);
  await pool.query('UPDATE users SET consent_verified=true WHERE id=$1', [req.user.id]);
  await audit(req.user.id, 'consent.recorded', { consentId: id, subjectName });
  res.status(201).json({ consentId: id, consentVerified: true });
});

app.post('/api/videos', auth, async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  const aspectRatio = ['16:9','9:16','1:1'].includes(req.body?.aspectRatio) ? req.body.aspectRatio : '16:9';
  if (prompt.length < 8 || prompt.length > 4000) return res.status(400).json({ error: 'Prompt must be 8–4,000 characters.' });
  if (req.body?.rightsConfirmed !== true) return res.status(400).json({ error: 'Rights and likeness consent confirmation required.' });
  if (req.user.credits < 1) return res.status(402).json({ error: 'No credits remaining.' });

  await pool.query('UPDATE users SET credits=credits-1 WHERE id=$1 AND credits>0', [req.user.id]);
  const id = randomUUID();
  await pool.query('INSERT INTO video_jobs(id,user_id,prompt,aspect_ratio,rights_confirmed) VALUES($1,$2,$3,$4,true)', [id, req.user.id, prompt, aspectRatio]);
  await redis.lpush('bigooay:video_jobs', JSON.stringify({ id, userId: req.user.id, prompt, aspectRatio }));
  await audit(req.user.id, 'video.requested', { jobId: id, aspectRatio });
  res.status(202).json({ id, status: 'queued' });
});

app.get('/api/videos', auth, async (req, res) => {
  const result = await pool.query('SELECT id,status,aspect_ratio,provider_name,error,created_at,updated_at FROM video_jobs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json({ jobs: result.rows });
});

app.get('/api/videos/:id', auth, async (req, res) => {
  const result = await pool.query('SELECT id,status,aspect_ratio,provider_name,error,file_path,created_at,updated_at FROM video_jobs WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Job not found.' });
  res.json({ job: result.rows[0] });
});

app.post('/api/account/delete', auth, async (req, res) => {
  await pool.query('UPDATE consent_records SET revoked=true WHERE user_id=$1', [req.user.id]);
  await pool.query('DELETE FROM users WHERE id=$1', [req.user.id]);
  await audit(req.user.id, 'account.deleted', {});
  res.clearCookie('session');
  res.json({ ok: true });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error.' });
});

initDb().then(() => app.listen(port, '0.0.0.0', () => console.log(`Bigooay API listening on ${port}`))).catch(error => { console.error(error); process.exit(1); });
