# 本地定时采集（配合 Windows 任务计划程序使用）
# 用法：pwsh -File scripts\update-local.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'collect.log'

"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 开始采集" | Out-File -FilePath $logFile -Append -Encoding utf8
try {
    # --use-system-ca：本机装了代理/抓包根证书时必须带，否则 Node 报证书错误
    node --use-system-ca scripts/collect.mjs *>> $logFile
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 采集完成" | Out-File -FilePath $logFile -Append -Encoding utf8
} catch {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 采集失败：$_" | Out-File -FilePath $logFile -Append -Encoding utf8
    exit 1
}
