# Builds resources/softcam.dll (x64) from tshino/softcam (MIT), renamed to "cam-toys".
# Needs git + Visual Studio 2022 (or Build Tools) with the C++ v143 toolset.
# Usage: powershell -ExecutionPolicy Bypass -File native/build-softcam.ps1
$ErrorActionPreference = 'Stop'

$Tag  = 'v1.8.1'                                   # commit afb424c2415b04da627fa1a7b4706575c2ba3010
$Root = Split-Path -Parent $PSScriptRoot
$Work = Join-Path $env:TEMP "camtoys-softcam-$Tag"

if (-not (Test-Path $Work)) {
  git clone --quiet --depth 1 --branch $Tag https://github.com/tshino/softcam.git $Work
}

# Own friendly name + CLSID so we never collide with another Softcam-based app.
# Keep in sync with CLSID in src/preload/vcam.ts.
$cpp = Join-Path $Work 'src/softcam/softcam.cpp'
$src = Get-Content $cpp -Raw
$src = $src -replace 'L"DirectShow Softcam"', 'L"cam-toys"'
$src = $src -replace '0xaef3b972, 0x5fa5, 0x4647, 0x95, 0x71, 0x35, 0x8e, 0xb4, 0x72, 0xbc, 0x9e',
                     '0x1cab239f, 0xcb40, 0x4af9, 0xb9, 0x8c, 0x96, 0x23, 0xfa, 0x43, 0x82, 0xb0'
if ($src -notmatch 'L"cam-toys"' -or $src -notmatch '0x1cab239f') { throw 'softcam.cpp patch failed (upstream changed?)' }
Set-Content $cpp $src -NoNewline

# Static CRT (/MT): the DLL is loaded into Discord/Zoom/etc., which must not need the VC++ redist.
# Upstream links msvcrt.lib explicitly, so drop that too.
$proj = Join-Path $Work 'src/softcam/softcam.vcxproj'
(Get-Content $proj -Raw) -replace 'msvcrtd?\.lib;', '' | Set-Content $proj -NoNewline
Set-Content (Join-Path $Work 'Directory.Build.targets') @'
<Project>
  <ItemDefinitionGroup Condition="'$(Configuration)'=='Release'">
    <ClCompile><RuntimeLibrary>MultiThreaded</RuntimeLibrary></ClCompile>
  </ItemDefinitionGroup>
</Project>
'@

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$msbuild = & $vswhere -latest -version '[17.0,18.0)' -products * -requires Microsoft.Component.MSBuild -find 'MSBuild\**\Bin\MSBuild.exe' | Select-Object -First 1
if (-not $msbuild) { throw 'MSBuild for VS2022 not found' }

Get-ChildItem $Work -Recurse -Directory -Filter x64 | Remove-Item -Recurse -Force   # clean build (static libs too)
& $msbuild (Join-Path $Work 'softcam.sln') /t:softcam /p:Configuration=Release /p:Platform=x64 /m /nologo /v:minimal
if ($LASTEXITCODE) { throw "msbuild failed ($LASTEXITCODE)" }

$dll = Get-ChildItem $Work -Recurse -Filter softcam.dll | Where-Object FullName -match 'x64\\Release' | Select-Object -First 1
New-Item -ItemType Directory -Force (Join-Path $Root 'resources') | Out-Null
Copy-Item $dll.FullName (Join-Path $Root 'resources/softcam.dll') -Force
Write-Host "OK -> resources/softcam.dll"
