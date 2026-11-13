$ErrorActionPreference = 'Stop'
$address = Read-Host 'Adres e-mail lokalnego administratora'
$secure = Read-Host 'Hasło (15–128 znaków)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  @{ email = $address; password = $plain } | ConvertTo-Json -Compress | node scripts/local-cms-admin.mjs
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Variable plain -ErrorAction SilentlyContinue
}
