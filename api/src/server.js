import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { AccessToken } from 'livekit-server-sdk';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/auth/demo', (req, res) => {
  const name = String(req.body?.name || 'Guest').slice(0, 30);
  const token = jwt.sign({ sub: name, role: 'guest' }, process.env.JWT_SECRET || 'change-me-now', { expiresIn: '7d' });
  res.json({ token, user: { name } });
});

app.post('/api/livekit/token', (req, res) => {
  const identity = String(req.body?.identity || 'guest').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
  const room = String(req.body?.room || 'main').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
  const canPublish = req.body?.publish === true;
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity });
  at.addGrant({ roomJoin: true, room, canPublish, canSubscribe: true });
  res.json({ token: at.toJwt(), url: 'wss://m.bigooay.tv/livekit' });
});

app.listen(3000, '0.0.0.0', () => console.log('Bigooay API listening on port 3000'));
