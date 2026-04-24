# Deploy Pinewood su IONOS + Supabase (senza Docker)

Questa guida usa:
- frontend statico Vite (`client/dist`)
- backend Node/Express con PM2 (`server`)
- database Supabase (gia migrato)
- Nginx reverse proxy + SSL LetsEncrypt gia attivo

## 1) Prerequisiti VPS (una volta sola)

```bash
sudo apt update
sudo apt install -y nginx
sudo npm install -g pm2
node -v
npm -v
```

Node consigliato: 20.x LTS.

## 2) Codice sul server

```bash
cd /var/www
sudo mkdir -p /var/www/pinewood
sudo chown -R $USER:$USER /var/www/pinewood
git clone <URL-REPO> /var/www/pinewood
cd /var/www/pinewood
```

Se il repo esiste gia:

```bash
cd /var/www/pinewood
git pull
```

## 3) Config backend (Supabase)

Crea `server/.env`:

```bash
cat > /var/www/pinewood/server/.env <<'EOF'
NODE_ENV=production
PORT=3001
CLIENT_URL=https://pinewood.foundly.it
DATABASE_URL=postgresql://postgres.zgfmxndqmjpvlveqksht:P1n3w00d2026%24%21@aws-1-eu-west-3.pooler.supabase.com:6543/postgres
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=CAMBIA_CON_UN_RANDOM_LUNGO
REFRESH_SECRET=CAMBIA_CON_UN_RANDOM_LUNGO_DIVERSO
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=pinewood.keeptheway@gmail.com
SMTP_PASS=APP_PASSWORD_GOOGLE
SMTP_FROM=pinewood.keeptheway@gmail.com
EOF
```

> `DATABASE_URL` e gia pronta con password URL-encoded.

## 4) Cartelle upload persistenti

Il progetto salva i file in:
- `server/uploads/avatars`
- `server/uploads/gpx/<userId>/...`

Comandi:

```bash
mkdir -p /var/www/pinewood/server/uploads/avatars
mkdir -p /var/www/pinewood/server/uploads/gpx
touch /var/www/pinewood/server/uploads/.gitkeep
```

## 5) Avvio backend con PM2

```bash
cd /var/www/pinewood/server
npm ci
cd /var/www/pinewood
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
pm2 startup
```

Verifica:

```bash
curl -s http://127.0.0.1:3001/api/health
```

Deve rispondere `ok: true`.

## 6) Build frontend (PWA inclusa)

```bash
cd /var/www/pinewood/client
npm ci
npm run build
```

Questo genera:
- `client/dist/index.html`
- `client/dist/manifest.webmanifest`
- `client/dist/sw.js`

Quindi la PWA funziona da dominio HTTPS reale.

## 7) Nginx

Installa il file config pronto:

```bash
sudo cp /var/www/pinewood/deploy/nginx/pinewood.foundly.it.conf /etc/nginx/sites-available/pinewood.foundly.it.conf
sudo ln -sfn /etc/nginx/sites-available/pinewood.foundly.it.conf /etc/nginx/sites-enabled/pinewood.foundly.it.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 8) Redis (se non gia presente)

Se su VPS non hai Redis globale:

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping
```

## 9) Check finale produzione

```bash
curl -I https://pinewood.foundly.it
curl -I https://pinewood.foundly.it/manifest.webmanifest
curl -I https://pinewood.foundly.it/sw.js
curl -s https://pinewood.foundly.it/api/health
```

## 10) Deploy aggiornamenti (routine)

```bash
cd /var/www/pinewood
git pull
cd /var/www/pinewood/server && npm ci
cd /var/www/pinewood/client && npm ci && npm run build
pm2 restart pinewood-api
sudo systemctl reload nginx
```

## Note importanti

- Niente Next.js richiesto per Pinewood.
- Cookie refresh in produzione ora usa `secure=true` (HTTPS only).
- Il backend e raggiungibile solo da Nginx su `127.0.0.1:3001`.
- Se hai gia altri progetti su Nginx, usa solo il nuovo server block per `pinewood.foundly.it`.
