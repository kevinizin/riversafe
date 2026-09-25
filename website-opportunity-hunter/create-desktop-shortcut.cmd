@echo off
REM ===========================================================================
REM  Coloca um atalho "Azven" na area de trabalho.
REM
REM  Rode uma vez. O atalho aponta para o start.cmd desta pasta, entao mover ou
REM  renomear a pasta do projeto significa rodar isto de novo.
REM
REM  So existe no Windows por natureza: macOS e Linux nao tem um equivalente
REM  unico ao arquivo .lnk, entao nao ha gemeo deste script.
REM ===========================================================================

setlocal
chcp 65001 >nul 2>nul
title Azven - atalho na area de trabalho

cd /d "%~dp0"

if not exist "start.cmd" (
    echo.
    echo   O start.cmd nao esta ao lado deste arquivo, entao nao ha para onde apontar.
    echo   Mantenha os dois arquivos juntos na pasta do projeto.
    echo.
    pause
    exit /b 1
)

echo.
echo   Criando o atalho na area de trabalho...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$target = Join-Path '%~dp0' 'start.cmd'; $desktop = [Environment]::GetFolderPath('Desktop'); $link = Join-Path $desktop 'Azven.lnk'; $shell = New-Object -ComObject WScript.Shell; $s = $shell.CreateShortcut($link); $s.TargetPath = $target; $s.WorkingDirectory = '%~dp0'.TrimEnd('\'); $s.Description = 'Abrir o painel da Azven'; $s.Save(); Write-Host ('  Criado: ' + $link)"

if errorlevel 1 (
    echo.
    echo   Nao foi possivel criar o atalho.
    echo.
    echo   Voce sempre pode fazer a mao: clique com o botao direito no start.cmd,
    echo   depois Mostrar mais opcoes -^> Enviar para -^> Area de trabalho.
    echo.
    pause
    exit /b 1
)

echo.
echo   Pronto. De dois cliques nele na area de trabalho para abrir o painel.
echo.
pause
exit /b 0
