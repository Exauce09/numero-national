# Parcours MVP recensement (cible opérationnelle)

## Chaîne

1. **Admin / superviseur (ONIP)** crée une campagne → ACTIVE  
2. Crée **zone(s)** + **équipe(s)** + **affecte** l’agent (`UUID` user)  
3. **Agent** se connecte sur Flutter (`agent.recensement@example.gov`)  
4. Sync affectations → travaille **hors ligne** (ménages + membres + GPS)  
5. Sync push/pull ; résout les **CONFLICT** si besoin  
6. Superviseur ouvre **Contrôle fiches** (ONIP → Campagnes)  
7. **Approuve** ou **rejette** (+ motif) ; agent corrige les rejets et renvoie  
8. Sur APPROVED → **Promouvoir NIC** (citoyen `core_registry`)  
9. **Stats / CSV** pour piloter la campagne  

## Comptes seed

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | `admin.recensement@example.gov` | `CensusAdmin123!` |
| Superviseur | `supervisor.recensement@example.gov` | `CensusSupervisor123!` |
| Agent | `agent.recensement@example.gov` | `CensusAgent123!` |

Seed : `py -3 scripts/seed_census_agent.py` (API up).

## UI

- Mobile : `apps/flutter_recensement`
- Superviseur / affectations / stats : `frontends/onip-dashboard` → **Campagnes** (JWT requis)
