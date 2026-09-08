# Runbook — opérations courantes

## Démarrage local

```bash
cp .env.example .env
# Éditer SECRET_KEY (>= 32 chars)
docker compose up --build -d
curl http://localhost:8000/health
alembic upgrade head   # déjà lancé par entrypoint Docker
py -3 scripts/e2e_smoke.py
```

## Parcours de validation

1. Health API + DB
2. Register admin (ALLOW_OPEN_REGISTRATION=true en dev)
3. Login → JWT
4. Créer citoyen → validate → NIC
5. Issue carte → verify QR/online
6. Refresh token (rotation) → logout

## Incidents

| Symptôme | Action |
|----------|--------|
| database down | `docker compose ps` / logs postgres |
| 429 login | lockout temporaire (REDIS / mémoire) — attendre fenêtre ou clear clé `login_fail:*` |
| refresh 401 reused | famille de sessions révoquée (suspicion vol) — user doit re-login |
| audit cannot UPDATE | normal — append-only triggers |

## Production checklist

- [ ] APP_ENV=production
- [ ] ALLOW_DEV_AUTH_HEADERS=false
- [ ] ALLOW_OPEN_REGISTRATION=false
- [ ] SECRET_KEY / JWT / MFA / QR keys distincts + KMS
- [ ] REDIS_URL obligatoire multi-instance
- [ ] TLS terminé au reverse-proxy
- [ ] Backups PostgreSQL + tests restore
