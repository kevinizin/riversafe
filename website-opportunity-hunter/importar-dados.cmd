@echo off
REM ===========================================================================
REM  Azven - importa os dados do CNPJ ja baixados, so o Amazonas.
REM
REM  De dois cliques depois do baixar-dados.cmd. Ele acha sozinho a extracao
REM  mais recente dentro de dados-cnpj.
REM
REM  Mostra primeiro o layout das colunas e so importa se voce confirmar.
REM  A ordem ja foi conferida contra o documento oficial da Receita -- os 30
REM  campos de Estabelecimentos e os 7 de Empresas batem. A conferencia na
REM  tela continua porque a Receita pode mudar o layout: um parser com a ordem
REM  errada nao quebra, ele grava capital social no campo de porte e produz
REM  numeros convincentes e errados.
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
echo   Cada linha mostra a posicao, o nome que o sistema espera, e o valor
echo   encontrado no arquivo. Se algo estiver fora do lugar, uma seta ^<--
echo   aponta.
echo.
echo   A ordem ja foi conferida contra o documento oficial da Receita, entao
echo   o esperado e que esteja tudo certo. Uma olhada rapida basta: os nomes
echo   devem fazer sentido para os valores ao lado ^(um CNPJ no campo de CNPJ,
echo   uma UF no campo de UF^).
echo   ---------------------------------------------------------------------
echo.

choice /c SN /m "Os valores batem com os nomes das colunas? Importar agora"
if errorlevel 2 (
    echo.
    echo   Importacao cancelada. Nada foi gravado.
    echo.
    echo   Se uma coluna estiver no lugar errado, me diga qual -- significa que
    echo   a Receita mudou o layout. A correcao e uma linha em
    echo   packages\core\src\providers\companies\receita\layout.ts
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
