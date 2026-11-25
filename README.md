# Bigooay Live

Production-oriented LiveKit streaming scaffold.

## VPS setup

1. Install Docker and Docker Compose.
2. Copy this project to the VPS.
3. Replace every `change-me` secret in `.env`.
4. Point `m.bigooay.tv` to the VPS public IPv4 address.
5. Run `docker compose up -d --build`.

## Security

- Never commit real credentials.
- Use strong random secrets.
- Configure a firewall for ports 80, 443, 7881, 3478, and 50000-50100.
- Keep PostgreSQL and Redis private.

## Next production features

Add persistent users, follows, gifts, payments, moderation, recording, and analytics after secret provisioning.
