@echo off
REM ===========================================================================
REM  Azven - launcher de duplo clique para Windows.
REM
REM  Sobe o painel a partir de uma maquina fria: instala dependencias se estiverem
REM  faltando, aplica migracoes, compila quando o codigo mudou, inicia o servidor
REM  e abre o navegador quando a porta realmente responde.
REM
REM  Fechar esta janela para o servidor. Isso e proposital: um servidor rodando
REM  escondido e um servidor que ninguem lembra de desligar.
REM ===========================================================================

setlocal
chcp 65001 >nul 2>nul
title Azven

REM Run from the folder this file lives in, whatever the current directory is.
cd /d "%~dp0"

set "PORT=3000"
set "URL=http://localhost:%PORT%"

echo.
echo   Azven
echo   =====
echo.

REM --- Already running? Just show it. ---------------------------------------
call :PortOpen
if not errorlevel 1 (
    echo   Ja esta rodando. Abrindo %URL%
    start "" "%URL%"
    timeout /t 2 >nul
    exit /b 0
)

REM --- Node ------------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo   O Node.js nao esta instalado, ou nao esta no PATH.
    echo.
    echo   Instale a versao LTS em https://nodejs.org, depois abra uma NOVA
    echo   janela de terminal e rode este arquivo de novo.
    echo.
    pause
    exit /b 1
)

REM --- Configuration ---------------------------------------------------------
if not exist ".env" (
    echo   Ainda nao existe o arquivo .env, entao o sistema nao sabe qual banco usar.
    echo.
    echo   Rode isto uma vez num terminal aqui:  npm run setup
    echo.
    pause
    exit /b 1
)

REM --- Dependencias, migracoes e build ---------------------------------------
REM Um script so, compartilhado com o start.sh, para os dois launchers nao
REM divergirem. Ele instala se precisar, aplica as migracoes pendentes e
REM recompila quando o codigo mudou desde o ultimo build -- que e o que faz um
REM git pull realmente aparecer em vez de servir o build anterior.
call node scripts\prepare.mjs
if errorlevel 1 goto :Failed

REM --- Open the browser once the port answers --------------------------------
REM Detached, so it can wait while the server takes over this window.
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "for($i=0; $i -lt 90; $i++){ try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', %PORT%); $c.Close(); Start-Process '%URL%'; break } catch { Start-Sleep -Seconds 1 } }"

echo   Iniciando o servidor. Esta janela e que o mantem no ar.
echo   Feche-a, ou aperte Ctrl+C, para desligar.
echo.
echo   %URL%
echo.

call npm start
if errorlevel 1 goto :Failed

exit /b 0

REM --- Helpers ---------------------------------------------------------------

:PortOpen
REM Sets errorlevel 0 when something is already listening on %PORT%.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', %PORT%); $c.Close(); exit 0 } catch { exit 1 }"
exit /b %errorlevel%

:Failed
echo.
echo   Algo falhou acima. A mensagem logo antes desta linha diz o que.
echo.
echo   Se o banco estiver inacessivel, confira se o PostgreSQL esta rodando:
echo       sc query postgresql-x64-16
echo.
pause
exit /b 1
