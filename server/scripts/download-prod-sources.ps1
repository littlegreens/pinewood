# Scarica dal server i sorgenti Pinewood da confrontare con il repo locale.
# Esegui da PowerShell dalla root del repo (o da qualsiasi cartella):
#   cd "C:\Users\g.verdini\OneDrive\Pinewood"
#   $env:PINWOOD_SSH = "root@217.154.8.51"
#   .\server\scripts\download-prod-sources.ps1
#
# Output: .prod-snapshot/ (non versionato)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$dest = Join-Path $repoRoot ".prod-snapshot"
$remoteBase = "/home/gabverdini/web/pinewood.foundly.it/server"
$target = $env:PINWOOD_SSH
if (-not $target) {
  $target = Read-Host "SSH target (Invio = root@217.154.8.51)"
  if (-not $target) { $target = "root@217.154.8.51" }
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
$files = @(
  "src/services/trailAiEnrichment.js",
  "src/config/env.js",
  "src/routes/trails.js",
  "src/db/migrations/002_superadmin_ai.sql"
)
foreach ($rel in $files) {
  $safe = $rel.Replace("/", "__")
  $out = Join-Path $dest $safe
  Write-Host "scp ${target}:${remoteBase}/$rel -> $out"
  scp "${target}:${remoteBase}/$rel" $out
}
Write-Host "`nFatto. Apri .prod-snapshot in Cursor e chiedi un diff con server/src."
