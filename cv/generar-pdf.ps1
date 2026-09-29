# Regenera assets/cv/CV_Santiago_Passerini.pdf a partir de cv/index.html,
# imprimiendo la página con Microsoft Edge en modo headless.
# Uso (desde la raíz del proyecto):  powershell -ExecutionPolicy Bypass -File cv/generar-pdf.ps1

$html = (Resolve-Path (Join-Path $PSScriptRoot 'index.html')).Path
$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets\cv\CV_Santiago_Passerini.pdf'
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }

$edgeArgs = @(
  '--headless=new',
  "--user-data-dir=$env:TEMP\cv-edge-profile",
  '--no-first-run',
  '--disable-extensions',
  '--enable-unsafe-swiftshader',  # WebGL sin GPU, para la banda dither
  '--use-angle=swiftshader',
  '--no-pdf-header-footer',
  '--virtual-time-budget=8000',   # da tiempo a cargar las fuentes y dibujar el dither
  "--print-to-pdf=`"$out`"",
  ('file:///' + $html.Replace('\', '/'))
)
Start-Process -FilePath $edge -ArgumentList $edgeArgs -Wait -WindowStyle Hidden
Write-Host "PDF generado: $out"
