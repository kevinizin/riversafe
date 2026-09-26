@echo off
REM ===========================================================================
REM  Azven - baixa os dados abertos do CNPJ da Receita Federal.
REM
REM  De dois cliques. Sao cerca de 6 GB em 21 arquivos, entao va fazer outra
REM  coisa. Pode fechar no meio: cada arquivo continua de onde parou na proxima
REM  vez, e os que ja estao completos sao pulados sem baixar de novo.
REM
REM  Existe como .cmd, e nao so como comando de terminal, porque o PowerShell
REM  bloqueia scripts por padrao (npm.ps1 nao carrega) e um arquivo .cmd nao
REM  passa por essa politica.
REM ===========================================================================

setlocal
chcp 65001 >nul 2>nul
title Azven - baixar dados do CNPJ

cd /d "%~dp0"

echo.
echo   Azven - dados abertos do CNPJ
echo   =============================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo   O Node.js nao esta instalado, ou nao esta no PATH.
    echo   Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
    echo.
    pause
    exit /b 1
)

REM Uma copia recem-clonada nao tem node_modules, e o erro que o npm da nesse
REM caso fala de um pacote que nao existe -- nao de uma instalacao que falta.
if not exist "node_modules" (
    echo   Primeira vez aqui: instalando as dependencias. Leva alguns minutos.
    echo.
    call npm.cmd install
    if errorlevel 1 goto :Failed
    echo.
)

REM npm.cmd, nao npm: dentro de um .cmd o wrapper .cmd e o que funciona.
REM O download nao precisa de banco de dados -- so de internet.
call npm.cmd run download:br
if errorlevel 1 goto :Failed

echo.
echo   Download concluido. O proximo passo e importar:
echo   de dois cliques em  importar-dados.cmd
echo.
pause
exit /b 0

:Failed
echo.
echo   O download nao terminou. A mensagem acima diz o porque.
echo.
echo   Se foi queda de conexao, e so rodar este arquivo de novo -- ele continua
echo   de onde parou, sem baixar tudo outra vez.
echo.
pause
exit /b 1
