@echo off
setlocal

REM Resolve o diretorio do projeto para permitir execucao de qualquer pasta.
for %%I in ("%~dp0.") do set "PROJECT_DIR=%%~fI"
set "ROOT_INPUT_DIR=%PROJECT_DIR%"
set "INPUT_DIR=%PROJECT_DIR%\input"
set "OUTPUT_JSON=%PROJECT_DIR%\data\dashboard-data.json"
set "OUTPUT_JS=%PROJECT_DIR%\data\dashboard-data.js"
set "SCRIPT_PATH=%PROJECT_DIR%\scripts\process_data.py"

echo ==============================================
echo Atualizacao do dashboard de velocidade
echo Projeto: "%PROJECT_DIR%"
echo Pasta de entrada 1: "%ROOT_INPUT_DIR%"
echo Pasta de entrada 2: "%INPUT_DIR%"
echo ==============================================

if not exist "%SCRIPT_PATH%" (
  echo ERRO: script nao encontrado em "%SCRIPT_PATH%"
  exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
  echo ERRO: Python nao foi encontrado no PATH.
  echo Instale o Python 3 e tente novamente.
  exit /b 1
)

python "%SCRIPT_PATH%" ^
  --input-dir "%ROOT_INPUT_DIR%" ^
  --input-dir "%INPUT_DIR%" ^
  --output-json "%OUTPUT_JSON%" ^
  --output-js "%OUTPUT_JS%" ^
  --min-analysis-speed 50 ^
  --speed-limit 80

if errorlevel 1 (
  echo.
  echo Falha na atualizacao dos dados.
  exit /b 1
)

echo.
echo Dados atualizados com sucesso.
echo Publicacao: envie o projeto para o GitHub Pages apos revisar os arquivos em /data.
exit /b 0
