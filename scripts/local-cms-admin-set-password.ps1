$ErrorActionPreference = 'Stop'
$first = Read-Host 'Nowe haslo lokalnego administratora (15-128 znakow)' -AsSecureString
$second = Read-Host 'Powtorz nowe haslo' -AsSecureString
$p1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
$p2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
try {
  $value1 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p1)
  $value2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p2)
  if ($value1 -cne $value2) { throw 'Hasla nie sa identyczne.' }
  if ($value1.Length -lt 15 -or $value1.Length -gt 128) { throw 'Haslo musi miec 15-128 znakow.' }
  @{ email = 'kontakt@polacywbelgii.eu'; password = $value1 } | ConvertTo-Json -Compress | node scripts/local-cms-admin-set-password.mjs
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p1)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p2)
  Remove-Variable value1,value2 -ErrorAction SilentlyContinue
}
