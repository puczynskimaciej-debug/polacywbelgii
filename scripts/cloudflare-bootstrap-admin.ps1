$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$email = Read-Host 'Adres e-mail pierwszego administratora CMS'
$displayName = Read-Host 'Imie i nazwisko administratora'
$secret = Read-Host 'Haslo tymczasowe CMS (minimum 15 znakow; po logowaniu ustawisz inne)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
  $env:CMS_BOOTSTRAP_EMAIL = $email
  $env:CMS_BOOTSTRAP_NAME = $displayName
  $env:CMS_BOOTSTRAP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  Push-Location $project
  try {
    node scripts/cloudflare-bootstrap-admin.mjs
    if ($LASTEXITCODE -ne 0) { throw "Nie udalo sie przygotowac pliku SQL (kod $LASTEXITCODE)." }
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item Env:CMS_BOOTSTRAP_EMAIL, Env:CMS_BOOTSTRAP_NAME, Env:CMS_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $secret.Dispose()
}
