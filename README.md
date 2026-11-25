# Bigooay Platform

Production-oriented scaffold with accounts, consent records, audit events, persistent PostgreSQL job records, Redis worker queue, Gemini/Veo integration, LiveKit, MinIO, and Caddy.

## Required secrets

Copy `.env.example` to `.env`, then set strong random values and add provider credentials. Never commit `.env`.

## Start

```bash
docker compose up -d --build
docker compose logs -f api worker
```

Configure DNS for `m.bigooay.tv`, open HTTP/HTTPS ports, and configure LiveKit TLS/firewall rules.

## Security boundary

Accounts, password hashing, cookie sessions, consent records, credits, audit events, Redis queue, and PostgreSQL persistence are scaffold implementations. Before public launch: enable MFA, email verification, KYC for consent-based likeness work, provider moderation, object storage serving, malware scanning, data retention, privacy deletion, payments, CSRF protection, RBAC, and independent security review.
