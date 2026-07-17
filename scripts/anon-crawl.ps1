# Anonymous (unauthenticated) crawl of the public site on http://localhost:3001
# Usage: powershell -ExecutionPolicy Bypass -File scripts/anon-crawl.ps1
# Does not follow redirects; uses curl.exe with a 120s per-route timeout and one retry per route.

$ErrorActionPreference = 'Continue'
$Base = 'http://localhost:3001'

$PublicPages = @(
  '/', '/books', '/comics', '/papers', '/audio', '/authors',
  '/discover', '/discover/book-clubs', '/discover/recommendations',
  '/genres', '/blog', '/about', '/contact', '/careers', '/press',
  '/privacy', '/terms', '/cookies', '/faqs', '/help',
  '/book-clubs', '/recommendations', '/readers-hub'
)
$Assets = @('/site.webmanifest', '/favicon.ico', '/opengraph-image', '/twitter-image')
$Protected = @('/library', '/reading/test-book', '/author', '/partner', '/admin', '/dashboard')

$ErrorMarkers = @(
  'Unknown Author',
  '__next_error__',
  'Internal Server Error',
  'Application error',
  'This page could not be found'
)

# Zero-state text actually rendered by each catalog page (from app/(consumer)/*)
$EmptyMarkers = @{
  '/books'   = 'No books found'
  '/comics'  = 'No comics found'
  '/papers'  = 'No papers found'
  '/audio'   = 'No audiobooks available'
  '/authors' = 'No authors to show yet'
}

function Invoke-Route {
  param([string]$Route)
  $bodyFile = [System.IO.Path]::GetTempFileName()
  $hdrFile  = [System.IO.Path]::GetTempFileName()
  $code = (& curl.exe -sS -D $hdrFile -o $bodyFile -w '%{http_code}' --max-time 120 "$Base$Route" 2>$null)
  if (-not $code) { $code = '000' }
  $location = ''
  if (Test-Path $hdrFile) {
    $locLine = Select-String -Path $hdrFile -Pattern '^location:\s*(.+)$' -CaseSensitive:$false | Select-Object -First 1
    if ($locLine) { $location = $locLine.Matches[0].Groups[1].Value.Trim() }
  }
  $body = ''
  if (Test-Path $bodyFile) { $body = [System.IO.File]::ReadAllText($bodyFile) }
  Remove-Item $bodyFile, $hdrFile -ErrorAction SilentlyContinue
  return [pscustomobject]@{ Code = $code; Location = $location; Body = $body }
}

function Test-Route {
  param([string]$Route, [string]$Kind)  # Kind: 'page' | 'asset' | 'protected'
  foreach ($attempt in 1..2) {
    $r = Invoke-Route -Route $Route
    $markers = @()
    $pass = $false
    switch ($Kind) {
      'protected' {
        $pass = ($r.Code -in @('307', '302')) -and ($r.Location -match '/login')
      }
      default {
        $pass = ($r.Code -eq '200')
        if ($pass -and $Kind -eq 'page') {
          foreach ($m in $ErrorMarkers) {
            if ($r.Body -like "*$m*") { $markers += $m }
          }
          if ($EmptyMarkers.ContainsKey($Route) -and $r.Body -like "*$($EmptyMarkers[$Route])*") {
            $markers += "EMPTY CATALOG: '$($EmptyMarkers[$Route])'"
          }
          if ($markers.Count -gt 0) { $pass = $false }
        }
      }
    }
    if ($pass -or $attempt -eq 2) {
      return [pscustomobject]@{
        Route    = $Route
        Kind     = $Kind
        Status   = $r.Code
        Redirect = $r.Location
        Markers  = ($markers -join '; ')
        Result   = if ($pass) { 'PASS' } else { 'FAIL' }
        Attempts = $attempt
      }
    }
    Write-Host "  retrying $Route (attempt 1 gave $($r.Code))"
  }
}

$results = @()
Write-Host "== Public pages (expect 200) =="
foreach ($p in $PublicPages)  { Write-Host "checking $p"; $results += Test-Route -Route $p -Kind 'page' }
Write-Host "== Assets (expect 200) =="
foreach ($a in $Assets)       { Write-Host "checking $a"; $results += Test-Route -Route $a -Kind 'asset' }
Write-Host "== Protected (expect 307/302 -> /login) =="
foreach ($pr in $Protected)   { Write-Host "checking $pr"; $results += Test-Route -Route $pr -Kind 'protected' }

Write-Host ''
$results | Format-Table -AutoSize Route, Kind, Status, Redirect, Markers, Result, Attempts | Out-String -Width 300 | Write-Host

$failures = $results | Where-Object { $_.Result -eq 'FAIL' }
Write-Host ("SUMMARY: {0}/{1} passed, {2} failed" -f ($results.Count - $failures.Count), $results.Count, $failures.Count)
if ($failures) {
  Write-Host 'FAILED ROUTES:'
  $failures | ForEach-Object { Write-Host ("  {0} [{1}] status={2} redirect={3} markers={4}" -f $_.Route, $_.Kind, $_.Status, $_.Redirect, $_.Markers) }
  exit 1
}
exit 0
