$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$galleryDir = Join-Path $root "assets\images\gallery"
$manifestPath = Join-Path $root "data\gallery.json"

$images = Get-ChildItem -LiteralPath $galleryDir -File |
  Sort-Object Name |
  ForEach-Object { $_.Name }

$manifest = [ordered]@{
  images = @($images)
}

$json = $manifest | ConvertTo-Json -Depth 3
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($manifestPath, "$json`n", $utf8NoBom)
