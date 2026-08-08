@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo          SideRP - START
echo ========================================
where node >nul 2>nul
if errorlevel 1 (
  echo Nie masz zainstalowanego Node.js.
  echo Pobierz Node.js LTS z https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules\express (
  echo Pierwsze uruchomienie - instaluje wymagane pliki...
  call npm install
  if errorlevel 1 (pause & exit /b 1)
)
if not exist .env (
  copy /Y .env.example .env >nul
  echo Uzupelnij teraz plik .env danymi aplikacji Discord.
  notepad .env
  pause
  exit /b 0
)
start "SideRP" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:37033"
node server.js
pause
