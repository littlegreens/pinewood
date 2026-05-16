# Deploy Pinewood su Hestia (produzione attuale)

Path canonici sul VPS (utente `gabverdini`, dominio legacy `pinewood.foundly.it`):

| Ruolo | Path |
|--------|------|
| Root sito Hestia | `/home/gabverdini/web/pinewood.foundly.it` |
| Frontend (PWA statica) | `/home/gabverdini/web/pinewood.foundly.it/public_html` |
| Backend Node/Express | `/home/gabverdini/web/pinewood.foundly.it/server` |
| Upload utenti | `/home/gabverdini/web/pinewood.foundly.it/server/uploads` |

Config centralizzata: [`deploy/hestia.env`](deploy/hestia.env)  
Script deploy: [`deploy/deploy-hestia.sh`](deploy/deploy-hestia.sh)  
SSH default: `root@217.154.8.51`

Sito pubblico: **https://pinewood.to** (imposta `CLIENT_URL=https://pinewood.to` in `server/.env`).

---

## Setup Git (una tantum sul server)

Oggi **non** c `.git` sotto Hestia. Il flusso consigliato:

1. Clone del repository in `/var/www/pinewood`
2. Sync build ? `public_html` e sorgenti API ? `server/`
3. PM2 punta a `server/` su Hestia

### 1) Backup

```bash
BACKUP=~/pinewood-backup-$(date +%Y%m%d)
mkdir -p "$BACKUP"
cp -a /home/gabverdini/web/pinewood.foundly.it/server/.env "$BACKUP/server.env"
cp -a /home/gabverdini/web/pinewood.foundly.it/server/uploads "$BACKUP/uploads" 2>/dev/null || true
```

### 2) Chiave SSH per GitHub (repo privato)

```bash
ssh-keygen -t ed25519 -C "pinewood-hestia" -f ~/.ssh/id_ed25519_pinewood -N ""
cat ~/.ssh/id_ed25519_pinewood.pub
```

Aggiungi la chiave su GitHub ? Repository ? Settings ? Deploy keys.

```bash
cat >> ~/.ssh/config <<'EOF'
Host github-pinewood
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_pinewood
EOF
```

### 3) Clone

```bash
mkdir -p /var/www
git clone git@github-pinewood:littlegreens/pinewood.git /var/www/pinewood
```

Repository: [github.com/littlegreens/pinewood](https://github.com/littlegreens/pinewood) (branch `main`).

### 4) Ripristina env e upload

```bash
cp ~/pinewood-backup-*/server.env /home/gabverdini/web/pinewood.foundly.it/server/.env
# Verifica CLIENT_URL
grep CLIENT_URL /home/gabverdini/web/pinewood.foundly.it/server/.env
```

### 5) Primo deploy

```bash
chmod +x /var/www/pinewood/deploy/deploy-hestia.sh
bash /var/www/pinewood/deploy/deploy-hestia.sh
```

### 6) PM2 persistente

```bash
pm2 save
pm2 startup
```

---

## Deploy aggiornamenti (routine)

Dal PC: `git push`

Sul server:

```bash
bash /var/www/pinewood/deploy/deploy-hestia.sh
```

Oppure da Windows (PowerShell, dalla root repo):

```powershell
.\deploy\remote-deploy-hestia.ps1
```

---

## Cosa non sovrascrivere

- `server/.env`  mai in git
- `server/uploads/`  avatar e GPX utenti

Lo script `deploy-hestia.sh` esclude esplicitamente `.env` e `uploads` dal rsync.

---

## Verifica

```bash
curl -s http://127.0.0.1:3001/api/health
curl -I https://pinewood.to
curl -I https://pinewood.to/manifest.webmanifest
```

---

## Note Nginx / Hestia

- Il vhost pu restare su `pinewood.foundly.it` con certificato LetsEncrypt esistente.
- `public_html` deve essere la root del dominio che serve la PWA.
- Le richieste `/api/` e `/uploads/` devono fare proxy a `127.0.0.1:3001` (vedi `deploy/nginx/pinewood.foundly.it.conf`).

Per timeout lunghi (AI/Gemini): `deploy/nginx/hestia-nginx.ssl.conf_api_timeouts.snippet`.

---

## Riferimento alternativo (/var/www)

Vedi anche [`DEPLOY_IONOS.md`](DEPLOY_IONOS.md) per layout monorepo sotto `/var/www/pinewood` senza sync Hestia (Nginx punta direttamente a `client/dist`).
