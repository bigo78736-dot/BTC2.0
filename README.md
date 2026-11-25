# Bigooay Studio — AI video creator

Responsive text-to-video web app with a Node API and Google Gemini/Veo provider integration. The API key stays on the server; never put it in frontend code or commit it.

## Run on a VPS

1. Install Docker Engine and the Docker Compose plugin.
2. Point the DNS `A` record for `m.bigooay.tv` to your VPS public IPv4 address.
3. Copy `.env.example` to `.env`; set a strong random `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, and your `GEMINI_API_KEY` from Google AI Studio. Keep `.env` private.
4. From the project root run `docker compose up -d --build`.
5. Open `https://m.bigooay.tv` after DNS has propagated and Caddy has issued a TLS certificate.

The Gemini API key needs access to a video-generation model and billing/quota as required by Google. The default model is configurable with `GEMINI_VIDEO_MODEL`. If the model is unavailable to your account, set it to a model ID currently enabled for your Gemini API project.

## Current scope and production notes

- Text prompt → asynchronous video generation → status polling → MP4 playback/download.
- Prompt validation and a basic per-IP generation rate limit are included.
- Generated files are stored in a Docker volume.
- Jobs are currently kept in memory, so a restart loses job status; add a persistent queue/database before public launch.
- This is not yet a complete social live-streaming application: accounts, live creator broadcasts, durable chat, gifts, payments, and moderation workflows still need implementation and security review.
- AI output can take time and may incur provider charges. Add quotas, user authentication, billing controls, abuse moderation, and retention policies before opening generation publicly.
