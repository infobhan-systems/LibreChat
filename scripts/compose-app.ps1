# Run docker compose for the Infobhan app stack with the nginx edge profile
# derived from DOMAIN_CLIENT in .env.
# edge-local: docker-compose.yml only (laptop-safe, no Ollama).
# edge-tls: also merges docker-compose.infobhan.yml (GPU host).
# Pass -WithGpu to merge the Infobhan overlay even for edge-local.
# Compose flags such as -d must not use a PowerShell param() block (it swallows -d).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$withGpu = $false
$composeArgs = [System.Collections.Generic.List[string]]::new()
foreach ($a in $args) {
  if ($a -eq "-WithGpu" -or $a -eq "-withgpu" -or $a -eq "--with-gpu") {
    $withGpu = $true
    continue
  }
  [void]$composeArgs.Add([string]$a)
}

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

$dockerArgs = [System.Collections.Generic.List[string]]::new()
[void]$dockerArgs.Add("-f")
[void]$dockerArgs.Add("docker-compose.yml")
$mergeGpu = $withGpu -or ($profile -eq "edge-tls")
if ($mergeGpu) {
  [void]$dockerArgs.Add("-f")
  [void]$dockerArgs.Add("docker-compose.infobhan.yml")
}

Write-Host "DOMAIN_CLIENT=$domainClient → --profile $profile$(if ($mergeGpu) { ' (+infobhan GPU overlay)' } else { '' })"
[void]$dockerArgs.Add("--profile")
[void]$dockerArgs.Add($profile)
foreach ($a in $composeArgs) {
  [void]$dockerArgs.Add($a)
}

# docker compose writes informational warnings to stderr; do not treat them as terminating errors.
$ErrorActionPreference = "Continue"
& docker compose @($dockerArgs.ToArray())
exit $LASTEXITCODE
