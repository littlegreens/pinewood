# Esegue deploy-hestia.sh sul VPS via SSH (dopo git push locale).
# Uso dalla root del repo:
#   git push
#   .\deploy\remote-deploy-hestia.ps1
#
# Variabili opzionali:
#   $env:PINWOOD_SSH = "root@217.154.8.51"

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$hestiaEnv = Join-Path $PSScriptRoot "hestia.env"

$sshTarget = $env:PINWOOD_SSH
if (-not $sshTarget -and (Test-Path $hestiaEnv)) {
  foreach ($line in Get-Content $hestiaEnv) {
    if ($line -match '^PINWOOD_SSH_TARGET="(.+)"') {
      $sshTarget = $Matches[1]
      break
    }
  }
}
if (-not $sshTarget) { $sshTarget = "root@217.154.8.51" }

$gitRoot = "/var/www/pinewood"
if (Test-Path $hestiaEnv) {
  foreach ($line in Get-Content $hestiaEnv) {
    if ($line -match '^PINWOOD_GIT_ROOT="(.+)"') {
      $gitRoot = $Matches[1]
      break
    }
  }
}

$remoteScript = "${gitRoot}/deploy/deploy-hestia.sh"
Write-Host "SSH $sshTarget -> bash $remoteScript"
ssh $sshTarget "bash $remoteScript"
