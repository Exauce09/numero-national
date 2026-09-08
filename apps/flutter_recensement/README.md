# Flutter Recensement — Offline-first (Phase 3)

Application terrain pour agents de recensement. Conçue pour fonctionner **sans
connexion permanente**, avec synchronisation différée vers l’API nationale.

## Architecture offline-first

```text
┌─────────────────────────────────────────────────────────┐
│  UI (campaigns / households / citizens / stats)         │
├─────────────────────────────────────────────────────────┤
│  Auth JWT (login API) + offline grace 72h               │
├─────────────────────────────────────────────────────────┤
│  Sync engine                                            │
│   ├─ local SQLite (sqflite)                             │
│   ├─ sync queue (outbox)                                │
│   └─ conflict manager (version / last-write rules)      │
├─────────────────────────────────────────────────────────┤
│  Bearer HTTP → `/api/v1/auth/*` + `/api/v1/census/*`    │
└─────────────────────────────────────────────────────────┘
```

### Identifiants démo (après seed)

```powershell
py -3 scripts/seed_census_agent.py
```

| Champ | Valeur |
|-------|--------|
| Email | `agent.recensement@example.gov` |
| Mot de passe | `CensusAgent123!` |

### Lancer sur téléphone

```powershell
# API Docker + seed
docker compose up -d
py -3 scripts/seed_census_agent.py

# Debug (hot reload)
.\scripts\run-android-device.ps1

# APK release signé + install
.\scripts\build-android-apk.ps1 -Install
```

Signature locale : copier `android/key.properties.example` → `android/key.properties`
(ne pas committer le `.jks` ni `key.properties`).

L’app pointe vers `API_BASE_URL` (IP LAN du PC + `:8000/api/v1`).  
**iOS** : build uniquement sur macOS (Xcode).

### API backend

| Endpoint | Rôle |
|----------|------|
| `POST /api/v1/auth/login` | JWT agent |
| `GET /api/v1/census/campaigns` | Campagnes |
| `POST /api/v1/census/sync/push` | Envoi outbox |
| `POST /api/v1/census/sync/pull` | Téléchargement deltas |
| `GET /api/v1/census/agents/{id}/stats` | Stats agent |
| `POST /api/v1/census/devices/register` | Device UID |
