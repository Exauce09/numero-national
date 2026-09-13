# Référence ZKTeco ZK9500 — reprise du projet
# `C:\Users\hp\Desktop\examen biometrie_systeme frontiere`
#
# Comment ça marche là-bas (WinForms + libzkfpcsharp / AcquireFingerprint) :
# 1. Init SDK → GetDeviceCount → OpenDevice → DBInit
# 2. AcquireFingerprint en boucle (timeout ~8s, retry ~180ms)
# 3. Vérifier qu’un doigt est bien présent (contraste image)
# 4. Optionnel : 3 prises du MÊME doigt puis DBMerge
# 5. Enrôlement personne : exactement 3 DOIGTS DISTINCTS (templates hex)
# 6. Matching : DBMatch / score — refus si même doigt déjà capturé
#
# Dans NUMERO NATIONAL (site web état civil) :
# - Pont EngX : scripts/start-zkteco-bridge.ps1 → http://127.0.0.1:18765
# - Capture : frontends/civil-officer/src/zkBridge.ts
# - Recensement : 3 doigts (pouce D, index D, index G) puis enrôlement coffre API
# - Identification 1:N : Biométrie → Identification
#
# Consignes opérateur :
# - Brancher le ZK9500 USB
# - Lancer le pont EngX (fenêtre ouverte)
# - Doigt à plat, 1–2 secondes, ne pas bouger
# - 3 doigts différents pour l’enrôlement
