# Run docker compose for the Infobhan app stack with the nginx edge profile
# derived from DOMAIN_CLIENT in .env.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$domainClient = ""
$envPath = Join-Path $Root ".env"
if (Test-Path $envPath) {
  $line = Get-Content $envPath |
    Where-Object { $_ -match '^\s*DOMAIN_CLIENT=' } |
    Select-Object -Last 1
  if ($line) {
    $domainClient = ($line -replace '^\s*DOMAIN_CLIENT=', '').Trim().Trim('"').Trim("'")
  }
}

$profile = "edge-local"
if ($domainClient -match '^https://') {
  $uriHost = $domainClient -replace '^https://', '' -replace '/.*$', '' -replace ':.*$', ''
  $hostLc = $uriHost.ToLowerInvariant()
  if ($hostLc -ne "localhost" -and $hostLc -ne "127.0.0.1") {
    $profile = "edge-tls"
  }
}

Write-Host "DOMAIN_CLIENT=$domainClient → --profile $profile"
$composeArgs = @(
  "-f", "docker-compose.yml",
  "-f", "docker-compose.infobhan.yml",
  "--profile", $profile
) + $args
# docker compose writes informational warnings to stderr; do not treat them as terminating errors.
$ErrorActionPreference = "Continue"
& docker compose @composeArgs
exit $LASTEXITCODE
