# Pinewood Brain (stato aggiornato)

Documento di riferimento tecnico-funzionale del progetto Pinewood.
Obiettivo: avere in un unico posto lo stato reale di stack, UX/UI, flussi, interazioni, AI, deploy e punti aperti.

## 1) Stack e architettura

- **Monorepo** con:
  - `client/` (React + Vite + MUI + Leaflet)
  - `server/` (Node.js + Express + PostgreSQL + BullMQ + Redis)
- **Client**
  - React 18
  - Router: `react-router-dom`
  - UI kit: `@mui/material`, `@mui/icons-material`
  - Editor rich text: `react-quill`
  - Mappe: `leaflet`, `react-leaflet`
  - PWA: `vite-plugin-pwa`
- **Server**
  - Express (ESM)
  - DB Postgres (Supabase) + PostGIS
  - Queue/worker: BullMQ + Redis
  - Parsing GPX: custom service
- **Deploy**
  - Ambiente con Nginx + PM2
  - Frontend statico in `public_html`
  - Backend in `/server`
  - Aggiornamento da GitHub via clone temporanea + rsync

## 2) Modello dati (focus trail)

Tabella `trails` (campi principali in uso):
- Identità: `id`, `user_id`, `name`, `source`, `created_at`
- Geo: `geom`, `start_point`, `end_point`
- Metriche: `distance_km`, `elevation_gain_m`, `elevation_loss_m`, `max_elevation_m`, `min_elevation_m`, `estimated_time_minutes`, `elevation_profile`
- Contenuti: `description`, `difficulty`, `start_location_text`, `start_location_lat`, `start_location_lon`
- File/visibilità: `gpx_file_path`, `is_public`, `parse_status`
- AI: `ai_enriched_at`, `ai_enrichment_version`
- Fonte: `source_website_url`
- Tipo percorso (manual override): `route_type` (migration `004_trail_route_type.sql`)

## 3) Flussi principali prodotto

### 3.1 Upload trail
- Upload GPX da `MyTrails`.
- Server:
  - parse GPX
  - inserisce trail (`parse_status = processing_elevation`)
  - mette job in `elevationQueue`
- Worker elevation:
  - chiama OpenTopoData a batch
  - aggiorna metriche + profilo + `parse_status=ready`

### 3.2 Descrizione trail
- Solo testo libero in app (editor in modifica trail). Nessuna generazione automatica lato server.

### 3.3 Discover/Home/Map
- Home:
  - Hero “Keep the way”
  - Manifesto testuale (font custom richiesto)
  - Sezione “I più vicini” (slider touch 1-card-step con indicatori)
  - Sezione “Tutti i trail” (ricerca + ordine popolarità + “Carica altri” a step)
- Map Discover:
  - Cluster marker sotto soglia zoom
  - click marker: selezione trail + render path
  - fit traccia nel viewport con padding card-aware
  - card mappa: titolo, riga metriche compatta, uploader, CTA “Apri scheda”

### 3.4 Navigation (Play)
- Start gate: consente avvio solo entro 300m dal tracciato (o blocco).
- Se pronto:
  - tracking GPS attivo
  - calcolo progressione, off-route detection, alert audio/vibrazione
  - salvataggio runtime in sessionStorage
- Pocket mode disponibile.
- Mappa navigation migliorata:
  - camera più fluida
  - click mappa zoom meno aggressivo
  - center-on-user con `flyTo` + posizione warm cache
  - traccia mostrata dopo movimento iniziale (evita scatti)
- Warmup GPS globale all’avvio app:
  - `warmupLocationFix()` + background tracking
  - riduce latenza su Home/Map/Navigation

## 4) UX/UI: scelte e comportamenti implementati

### 4.1 Card (pattern generale)
- Titolo in alto
- Statistiche/engagement
- Riga metriche compatta:
  - distanza
  - tempo
  - dislivelli (icone frecce)
  - difficoltà
- Uploader/avatar
- CTA/azioni contestuali

### 4.2 TrailDetail
- Header owner + chips stato/source.
- Mappa con traccia principale.
- Blocco metriche dark:
  - distanza, dislivelli, min/max, tempo, tipo
- **Tipo percorso**:
  - fallback automatico (anello/lineare)
  - sovrascrivibile manualmente in edit (`route_type`)
- Edit dialog:
  - campi trail completi
  - `source_website_url`
  - `route_type`

### 4.3 MyTrails
- Lista mine/saved con menu contestuale.
- Edit dialog allineato a TrailDetail:
  - include `source_website_url`, `route_type`

### 4.4 Home
- Testo manifesto ridotto e styling personalizzato.
- “I più vicini” con swipe touch + indicatori.
- “Tutti i trail” con search + count (`X tracciati disponibili`) + load more.

### 4.5 Map Discover
- Rimozione preview SVG nella card mappa.
- Card mappa compatta e leggibile:
  - titolo
  - riga `km | tempo | ↑/↓ | difficoltà`
  - uploader + pulsante a destra.
- Padding card impostato a 18px.

## 5) Interazioni click/tap (mappa e card)

### Map Discover
- Tap cluster: zoom-in cluster.
- Tap marker:
  - seleziona trail
  - carica geom completa
  - mostra polyline
  - camera fit su tutta traccia nel viewport (padding top/bottom dinamico).
- Tap “centra su di me”: geolocazione e `setView`.

### Navigation map
- Tap mappa: zoom incrementale soft con `flyTo`.
- Tap “centra su di me”: se manca posizione prova quick location, poi `flyTo`.
- Traccia non appare immediatamente durante il primo movimento camera per evitare “jank”.

## 6) API e route toccate

`server/src/routes/trails.js`:
- `GET /api/trails/:id` include:
  - `source_website_url`
  - `route_type`
- `PATCH /api/trails/:id` accetta/salva:
  - `source_website_url`
  - `route_type`

## 7) Migrazioni

- `002_superadmin_ai.sql`
  - introduce colonne AI (`ai_enriched_at`, `ai_enrichment_version`) + ruolo user
- `003_trail_source_website.sql`
  - aggiunge `source_website_url`
- `004_trail_route_type.sql`
  - aggiunge `route_type`

## 8) Configurazione env rilevante

Server `.env`: vedi `server/.env.example` (DB, JWT, SMTP, OpenTopo, ecc.). Nessuna chiave AI integrata.

## 9) Docker/dev note

- Errore tipico `react-quill` “Failed to resolve import” in Docker:
  - causa: volume `client_node_modules` stale
  - fix: ricreare container client + volume node_modules

## 10) Stato deploy (Hestia produzione)

Path VPS (canonici in `deploy/hestia.env`):

- Frontend: `/home/gabverdini/web/pinewood.foundly.it/public_html`
- Backend: `/home/gabverdini/web/pinewood.foundly.it/server`
- Git clone target: `/var/www/pinewood` (da configurare — oggi senza `.git` su Hestia)
- SSH: `root@217.154.8.51`
- URL pubblico: `https://pinewood.to`

Automazione: `deploy/deploy-hestia.sh` (sul server) · `deploy/remote-deploy-hestia.ps1` (da PC). Guida: `DEPLOY_HESTIA.md`.

## 11) Problemi noti / attenzione

- Log storici di FK su `saved_trails` in delete possono comparire su versioni non allineate.
- Bundle frontend alto (~>500k warning Vite): non bloccante, ma ottimizzabile con code-splitting.
- Se AI sembra troncare:
  - abilitare `TRAIL_AI_DEBUG`
  - confrontare `attempt_output` vs `saved_description`
  - il service ora evita salvataggi palesemente troncati.

## 12) Prossimi miglioramenti suggeriti

- Profilare e ridurre bundle JS (lazy loading pagine pesanti).
- Centralizzare component card (evitare divergenze Home/Map/MyTrails).
- Aggiungere test e2e su flussi:
  - upload -> AI -> render description
  - map marker -> fit bounds corretto
  - route_type manual override persistente.

