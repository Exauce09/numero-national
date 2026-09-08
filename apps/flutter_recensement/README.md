# Flutter Recensement — Offline-first (Phase 3)

Application terrain pour agents de recensement. Conçue pour fonctionner **sans
connexion permanente**, avec synchronisation différée vers l’API nationale.

## Architecture offline-first

```text
┌─────────────────────────────────────────────────────────┐
│  UI (campaigns / households / citizens / stats)         │
├─────────────────────────────────────────────────────────┤
│  Auth policy (offline login window + secure storage)    │
├─────────────────────────────────────────────────────────┤
│  Sync engine                                            │
│   ├─ local SQLite (sqflite)                             │
│   ├─ sync queue (outbox)                                │
│   └─ conflict manager (version / last-write rules)      │
├─────────────────────────────────────────────────────────┤
│  connectivity_plus → HTTP push/pull `/api/v1/census`    │
└─────────────────────────────────────────────────────────┘
```

### Principes

1. **Écriture locale d’abord** — ménages et fiches citoyens sont persistés dans
   SQLite immédiatement, même hors ligne.
2. **File d’attente (outbox)** — chaque mutation produit un item de sync avec
   `local_id` + `version`.
3. **Push / Pull** — dès que `connectivity_plus` signale une connexion, le
   `SyncEngine` appelle `POST /api/v1/census/sync/push` puis `sync/pull`.
4. **Conflits** — si le serveur a une version supérieure, le `ConflictManager`
   marque l’enregistrement `CONFLICT` pour revue agent / superviseur.
5. **Secrets** — jetons et device credentials dans `flutter_secure_storage`,
   jamais en clair dans SQLite.
6. **Device ID** — enregistrement unique via `/api/v1/census/devices/register`.

### Lancer (avec Flutter SDK)

```bash
cd apps/flutter_recensement
flutter pub get
flutter run
```

**Téléphone Android branché (Windows) :**

```powershell
# Débogage USB activé — API Docker sur le PC
.\scripts\run-android-device.ps1
# ou APK seul :
.\scripts\build-android-apk.ps1 -ApiHost 192.168.x.x
```

L’app pointe vers `API_BASE_URL` (IP LAN du PC + `:8000/api/v1`).  
**iOS** : build uniquement sur macOS (Xcode) — pas possible depuis Windows.

Sans SDK Flutter, ce dépôt fournit le scaffold sous `lib/` + `android/`.

### API backend

| Endpoint | Rôle |
|----------|------|
| `GET/POST /api/v1/census/campaigns` | CRUD campagnes |
| `POST /api/v1/census/sync/push` | Envoi outbox |
| `POST /api/v1/census/sync/pull` | Téléchargement deltas |
| `GET /api/v1/census/agents/{id}/stats` | Stats agent |
| `POST /api/v1/census/devices/register` | Device UID |

Configurer `lib/core/config.dart` (`apiBaseUrl`) selon l’environnement.
