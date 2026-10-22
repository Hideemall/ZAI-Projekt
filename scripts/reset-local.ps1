$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Step([string]$label, [scriptblock]$cmd) {
  Write-Host "==> $label"
  & $cmd
  if ($LASTEXITCODE -ne 0) { throw "Step failed: $label" }
}

Step "Drop database volume"  { docker compose down -v }
Step "Start postgres"        { docker compose up -d --wait }
Push-Location apps\api
Step "Run migrations"        { npm run migrate }
Step "Seed admin account"    { npm run seed:admin }
Pop-Location
Write-Host "Done. Start the API (apps\api: npm run dev), then run 'npm run seed' in apps\generator."