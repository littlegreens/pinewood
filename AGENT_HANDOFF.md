# Pinewood — handoff per agent / nuova sessione Cursor

**Leggi questo file all’inizio** se apri il progetto da un path nuovo o senza cronologia chat.

- Repo: https://github.com/littlegreens/pinewood (branch `main`)
- Utente: comunica in **italiano**
- Sito produzione: **https://pinewood.to**
- API produzione: **https://pinewood.to/api** (Nginx ? `127.0.0.1:3001`)
- Documentazione tecnica ampia: `BRAIN_PINEWOOD.md`
- Deploy Hestia: `DEPLOY_HESTIA.md` + `deploy/hestia.env`

---

## Struttura monorepo

| Cartella | Ruolo |
|----------|--------|
| `client/` | PWA React + Vite + MUI + Leaflet |
| `server/` | Node Express + Postgres (Supabase) + Redis/BullMQ |
| `mobile/` | App React Native / Expo SDK 54 |
| `deploy/` | Script deploy Hestia, nginx, PM2 |

---

## Produzione VPS (Hestia)

| Cosa | Path |
|------|------|
| Frontend statico | `/home/gabverdini/web/pinewood.foundly.it/public_html` |
| Backend Node | `/home/gabverdini/web/pinewood.foundly.it/server` |
| Upload utenti | `.../server/uploads` (avatar, GPX) |
| Clone Git sul server | `/var/www/pinewood` |
| SSH | `root@217.154.8.51` |
| PM2 app | `pinewood-api` |

**Deploy routine (sul server):**
```bash
bash /var/www/pinewood/deploy/deploy-hestia.sh
```

**Da Windows (dopo `git push`):**
```powershell
.\deploy\remote-deploy-hestia.ps1
```

**Importante:** `deploy-hestia.sh` **non sovrascrive** `server/.env` né `server/uploads/`.

**`server/.env` produzione** (utente gestisce sul server):
- `CLIENT_URL=https://pinewood.to` (link email verifica/reset)
- `NODE_ENV=production`
- DB Supabase, JWT, SMTP Gmail, Redis locale

Stato deploy (maggio 2026): clone Git OK, health `{"ok":true,"db":true,"redis":true}`, PM2 online.

---

## Account / servizi

| Servizio | Dettaglio |
|----------|-----------|
| GitHub | `littlegreens/pinewood` |
| Expo / EAS | account **g.verdini** — progetto `@g.verdini/pinewood` |
| EAS projectId | `80535674-4de0-4397-a2b2-b8c8e698b4cc` (in `mobile/app.json`) |

---

## Mobile — Expo / APK (TODO attivo)

### Già fatto
- App in `mobile/` allineata a PWA (mappe, navigazione, My Trails, offline, auth, TrailEdit, ecc.)
- `eas.json` profilo **`preview`** ? build **APK** (`buildType: apk`)
- `eas build:configure` eseguito, progetto collegato a EAS
- Keystore Android: generato su Expo al primo build (rispondere **Y**)
- API mobile default: `https://pinewood.to` (`mobile/src/services/api.js`)

### Problema build EAS su Windows
- Errore upload: `EPERM: operation not permitted, rmdir ...\client\scripts`
- Causa probabile: monorepo + cartella sotto **OneDrive** + EAS che impacchetta tutto il repo
- Fix aggiunto in repo: **`.easignore`** alla root (esclude `client/`, `server/`, ecc.)

### Cosa fare per ottenere l’APK
1. Pulire cache (PowerShell):
   ```powershell
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Temp\eas-cli-nodejs" -ErrorAction SilentlyContinue
   ```
2. Pausa OneDrive sync (opzionale ma utile)
3. **Opzione A** — dalla cartella attuale:
   ```powershell
   cd mobile
   eas build -p android --profile preview
   ```
4. **Opzione B** — clone fuori OneDrive (più affidabile):
   ```powershell
   git clone https://github.com/littlegreens/pinewood.git C:\pinewood-build
   cd C:\pinewood-build\mobile
   eas login
   eas build -p android --profile preview
   ```
5. Scaricare APK da https://expo.dev/accounts/g.verdini/projects/pinewood/builds
6. Installare su Android (origini sconosciute)

**Prossime build:** stesso comando `eas build -p android --profile preview`.

**Play Store (futuro):** `eas build -p android --profile production` (AAB).

### File da committare se non ancora su GitHub
- `.easignore` (root)
- `mobile/app.json` (projectId EAS)
- `mobile/eas.json` (`appVersionSource: local`)

---

## Auth / verifica email (fatto)

- Server: login email non verificata ? `403` + `code: EMAIL_NOT_VERIFIED`
- PWA: `Landing.jsx`, `Home.jsx` — campo **codice 6 cifre** anche al login (non solo registrazione)
- Mobile: `AuthPanel.js` — stesso flusso
- Messaggi unificati: `client/src/services/authMessages.js`, `mobile/src/services/authMessages.js`
- Colori messaggi: `success` verde, `error` rosso, `info` grigio (niente regex invertita)
- Email: testo che spiega dove inserire il codice + link `CLIENT_URL`

---

## PWA / client (recente)

- Desktop layout, Trails, MapDiscover, Navigation, TrailDetail (mappa espandibile, icone zoom PWA)
- `client/.env.production`: `VITE_API_URL=` vuoto ? same-origin in produzione

---

## Git — regole per l’agent

- **Non committare** senza richiesta esplicita utente
- **Non committare** `.env`, segreti, `node_modules`
- Evitare di aggiungere di nuovo `server/node_modules.zip` (file pesante committato per errore)
- Commit message in italiano o inglese, frasi complete

---

## Workspace Cursor

- Path storico sviluppo: `C:\Users\g.verdini\OneDrive\Pinewood`
- Se si apre un path nuovo (es. `C:\pinewood-build`), le **chat vecchie** restano sul workspace OneDrive; usare questo file + `BRAIN_PINEWOOD.md` per contesto.

---

## Checklist TODO prodotto (priorità)

- [ ] **APK EAS** — completare build e test su telefono reale (GPS background, login, mappe, offline)
- [ ] Committare `.easignore` + aggiornamenti `mobile/app.json` / `eas.json` se mancanti su `main`
- [ ] Verificare `CLIENT_URL=https://pinewood.to` sul server dopo deploy auth
- [ ] (Opzionale) Rimuovere `server/node_modules.zip` dal repo git
- [ ] (Opzionale) Deploy key GitHub sul VPS per `git pull` via SSH invece di HTTPS
- [ ] (Futuro) Submit Play Store / TestFlight

---

## Comandi rapidi

```powershell
# Dev PWA
cd client && npm run dev

# Dev mobile
cd mobile && npx expo start --clear

# Push + deploy server
git push
.\deploy\remote-deploy-hestia.ps1
```

```bash
# Server health
curl -s http://127.0.0.1:3001/api/health
```

---

*Ultimo aggiornamento handoff: maggio 2026 — sessione deploy Hestia, auth verifica, EAS APK in corso.*
