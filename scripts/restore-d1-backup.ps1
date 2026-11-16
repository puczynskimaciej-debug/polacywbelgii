param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$source = (Resolve-Path -LiteralPath $InputPath).Path
$target = [System.IO.Path]::GetFullPath($OutputPath)
if (-not $source.EndsWith('.dpapi') -or -not [System.IO.File]::Exists($source + '.json')) { throw 'Encrypted backup and manifest are required' }
if ([System.IO.File]::Exists($target)) { throw 'Restore target already exists' }
$manifest = Get-Content -LiteralPath ($source + '.json') -Raw | ConvertFrom-Json
$bytes = [System.Security.Cryptography.ProtectedData]::Unprotect([System.IO.File]::ReadAllBytes($source), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
try {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { $hash = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant() }
  finally { $sha.Dispose() }
  if ($hash -ne $manifest.sha256 -or $bytes.Length -ne $manifest.originalBytes) { throw 'Backup hash or length mismatch' }
  [System.IO.File]::WriteAllBytes($target,$bytes)
  $acl = Get-Acl -LiteralPath $target
  $acl.SetAccessRuleProtection($true,$false)
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity,'FullControl','Allow')
  $acl.AddAccessRule($rule)
  Set-Acl -LiteralPath $target -AclObject $acl
  Write-Output "Restored and verified: $target"
} finally { [Array]::Clear($bytes,0,$bytes.Length) }
