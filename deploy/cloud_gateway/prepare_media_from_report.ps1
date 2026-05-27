param(
    [string]$Source = "report",
    [string]$Destination = "deploy/cloud_gateway/media"
)

# STEP 1. Resolve paths from the repository root.
$repoRoot = Resolve-Path "."
$sourcePath = Join-Path $repoRoot $Source
$destinationPath = Join-Path $repoRoot $Destination

if (-not (Test-Path $sourcePath)) {
    throw "Source folder not found: $sourcePath"
}

# STEP 2. Create a clean deployment media folder.
New-Item -ItemType Directory -Force $destinationPath | Out-Null

# STEP 3. Copy top-level preview assets.
$extensions = @("*.mp4", "*.wav", "*.mp3", "*.json", "*.ipynb")
foreach ($extension in $extensions) {
    Get-ChildItem -Path $sourcePath -Filter $extension -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $destinationPath -Force
        Write-Host "copied:" $_.Name
    }
}

# STEP 4. Copy known generated branch folders if they exist in report.
$branchFolders = @(
    "3d_photo_light_final",
    "3d_photo_light_outputs",
    "3d_photo_light_tts",
    "cogvideo_photo_final",
    "cogvideo_photo_outputs",
    "cogvideo_photo_tts"
)

foreach ($folder in $branchFolders) {
    $src = Join-Path $sourcePath $folder
    $dst = Join-Path $destinationPath $folder
    if (Test-Path $src) {
        Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
        Write-Host "copied folder:" $folder
    }
}

# STEP 5. Print the final folder summary for deployment verification.
Write-Host ""
Write-Host "Media folder ready:" $destinationPath
Get-ChildItem -Path $destinationPath -Recurse -File |
    Select-Object FullName, Length |
    Format-Table -AutoSize

