$deadline = (Get-Date).AddMinutes(20)
while ((Get-Date) -lt $deadline) {
  $code = & curl.exe -s -o NUL -w '%{http_code}' --connect-timeout 10 --max-time 20 http://localhost:3001/api/health
  Write-Host "$(Get-Date -Format HH:mm:ss) health=$code"
  if ($code -eq '200') { Write-Host 'SERVER_UP'; exit 0 }
  Start-Sleep -Seconds 70
}
Write-Host 'TIMED_OUT'
exit 1
