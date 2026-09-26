@echo off
REM ===========================================================================
REM  Azven - importa os dados do CNPJ ja baixados, so o Amazonas.
REM
REM  De dois cliques depois do baixar-dados.cmd. Ele acha sozinho a extracao
REM  mais recente dentro de dados-cnpj.
REM
REM  Mostra primeiro o layout das colunas para voce conferir contra o PDF de
REM  metadados da Receita, e so importa se voce confirmar. Essa conferencia
REM  existe porque um parser com a ordem errada nao quebra: ele grava capital
REM  social no campo de porte e produz numeros convincentes e errados.
REM ===========================================================================

setlocal
chcp 65001 >nul 2>nul
title Azven - importar dados do CNPJ

cd /d "%~dp0"

echo.
echo   Azven - importar dados do CNPJ
echo   ==============================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo   O Node.js nao esta instalado, ou nao esta no PATH.
    echo.
    pause
    exit /b 1
)

if not exist "dados-cnpj" (
    echo   A pasta dados-cnpj nao existe.
    echo.
    echo   De dois cliques em  baixar-dados.cmd  primeiro.
    echo.
    pause
    exit /b 1
)

echo   Passo 1 de 2 - conferindo o layout das colunas.
echo.
call npm.cmd run ingest:br -- --inspect
if errorlevel 1 goto :Failed

echo.
echo   ---------------------------------------------------------------------
echo   Compare o que apareceu acima com o PDF de metadados da Receita:
echo   https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf
echo.
echo   Cada linha mostra a posicao, o nome que o sistema espera, e o valor
echo   encontrado. Se algo estiver fora do lugar, uma seta ^<-- aponta.
echo   ---------------------------------------------------------------------
echo.

choice /c SN /m "Os nomes das colunas batem com o PDF? Importar agora"
if errorlevel 2 (
    echo.
    echo   Importacao cancelada. Nada foi gravado.
    echo.
    echo   Se uma coluna estiver no lugar errado, me diga qual -- a correcao
    echo   e uma linha em packages\core\src\providers\companies\receita\layout.ts
    echo.
    pause
    exit /b 0
)

echo.
echo   Passo 2 de 2 - importando, so o Amazonas.
echo   Nada e gravado enquanto as linhas conferidas nao baterem com o layout.
echo.

call npm.cmd run ingest:br -- --uf AM
if errorlevel 1 goto :Failed

echo.
echo   Pronto. Abra o Azven e rode uma busca pelo Brasil.
echo.
pause
exit /b 0

:Failed
echo.
echo   A importacao nao terminou. A mensagem acima diz o porque.
echo.
pause
exit /b 1
