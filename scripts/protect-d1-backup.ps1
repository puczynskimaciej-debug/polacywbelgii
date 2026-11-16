param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][string]$Purpose,
  [switch]$RemovePlaintextAfterVerification
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$source = (Resolve-Path -LiteralPath $InputPath).Path
$target = [System.IO.Path]::GetFullPath($OutputPath)
if (-not [System.IO.File]::Exists($source)) { throw 'Backup source is missing' }
if ([System.IO.File]::Exists($target) -or [System.IO.File]::Exists($target + '.json')) { throw 'Encrypted target already exists' }
if (-not $target.EndsWith('.dpapi')) { throw 'Encrypted output must use .dpapi extension' }
if ([string]::IsNullOrWhiteSpace($Purpose) -or $Purpose.Length -gt 120) { throw 'Purpose is required' }
$bytes = [System.IO.File]::ReadAllBytes($source)
if ($bytes.Length -lt 100) { throw 'Backup is unexpectedly small' }
$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
try {
  [System.IO.File]::WriteAllBytes($target, $protected)
  $acl = Get-Acl -LiteralPath $target
  $acl.SetAccessRuleProtection($true, $false)
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'Allow')
  $acl.AddAccessRule($rule)
  Set-Acl -LiteralPath $target -AclObject $acl
  $recovered = [System.Security.Cryptography.ProtectedData]::Unprotect([System.IO.File]::ReadAllBytes($target), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $originalHash = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant()
    $recoveredHash = [BitConverter]::ToString($sha.ComputeHash($recovered)).Replace('-', '').ToLowerInvariant()
  } finally { $sha.Dispose() }
  if ($originalHash -ne $recoveredHash) { throw 'Encrypted backup verification failed' }
  $createdAt = [DateTimeOffset]::UtcNow
  $manifest = [ordered]@{
    purpose = $Purpose
    createdAtUtc = $createdAt.ToString('o')
    deleteOrReviewAfterUtc = $createdAt.AddDays(30).ToString('o')
    encryption = 'Windows DPAPI CurrentUser'
    originalBytes = $bytes.Length
    sha256 = $originalHash
  }
  [System.IO.File]::WriteAllText($target + '.json', ($manifest | ConvertTo-Json -Compress), [System.Text.Encoding]::UTF8)
  Set-Acl -LiteralPath ($target + '.json') -AclObject $acl
  if ($RemovePlaintextAfterVerification) { Remove-Item -LiteralPath $source -Force }
  Write-Output "Encrypted and verified: $target"
  Write-Output "Review or delete after: $($manifest.deleteOrReviewAfterUtc)"
} catch {
  if ([System.IO.File]::Exists($target)) { Remove-Item -LiteralPath $target -Force }
  if ([System.IO.File]::Exists($target + '.json')) { Remove-Item -LiteralPath ($target + '.json') -Force }
  throw
} finally {
  [Array]::Clear($bytes,0,$bytes.Length)
  if ($null -ne $recovered) { [Array]::Clear($recovered,0,$recovered.Length) }
}
