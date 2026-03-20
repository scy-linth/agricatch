param(
  [string]$SupabaseDbPassword = $env:SUPABASE_DB_PASSWORD,
  [string]$SupabaseDbHost = $env:SUPABASE_DB_HOST,
  [string]$SupabaseDbUser = 'postgres',
  [string]$SupabaseDbName = 'postgres',
  [int]$SupabaseDbPort = 5432
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir '..')
$backendEnv = Join-Path $projectRoot 'backend/.env'

if (-not (Test-Path $backendEnv)) {
  throw "Missing backend/.env at $backendEnv"
}

# Load backend/.env into process environment for this script session.
Get-Content $backendEnv | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $parts = $_ -split '=', 2
  if ($parts.Count -eq 2) {
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

if ([string]::IsNullOrWhiteSpace($SupabaseDbPassword)) {
  throw 'SUPABASE_DB_PASSWORD is required. Pass -SupabaseDbPassword or set env var.'
}

$serviceRole = [System.Environment]::GetEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY', 'Process')
if ([string]::IsNullOrWhiteSpace($serviceRole)) {
  throw 'SUPABASE_SERVICE_ROLE_KEY is missing in backend/.env'
}

# Decode JWT payload to extract project ref if user did not set host.
$projectRef = $null
try {
  $payload = $serviceRole.Split('.')[1].Replace('-', '+').Replace('_', '/')
  while ($payload.Length % 4 -ne 0) { $payload += '=' }
  $json = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payload))
  $obj = $json | ConvertFrom-Json
  $projectRef = $obj.ref
} catch {
  throw 'Could not decode SUPABASE_SERVICE_ROLE_KEY to determine project ref.'
}

if ([string]::IsNullOrWhiteSpace($SupabaseDbHost)) {
  $SupabaseDbHost = "db.$projectRef.supabase.co"
}

$env:SUPABASE_DB_PASSWORD = $SupabaseDbPassword
$env:SUPABASE_DB_HOST = $SupabaseDbHost
$env:SUPABASE_DB_USER = $SupabaseDbUser
$env:SUPABASE_DB_NAME = $SupabaseDbName
$env:SUPABASE_DB_PORT = [string]$SupabaseDbPort

Set-Location $scriptDir

Write-Output "Running automated import to Supabase host: $SupabaseDbHost"
node .\import_to_supabase.js
