@echo off
setlocal enabledelayedexpansion

REM install-deps.dev.bat
REM Run `npm install` in each service folder using a temporary Node Docker image (Windows)
REM Usage: install-deps.dev.bat [node-image]
REM Example: install-deps.dev.bat node:20

REM Determine repository root (parent of this script folder)
pushd "%~dp0.." >nul
set "ROOT=%CD%"

set "IMAGE=%~1"
if "%IMAGE%"=="" set "IMAGE=node"

echo Using Docker image: %IMAGE%
echo Repo root: %ROOT%

REM Auto-discover folders with package.json
for /d %%D in ("%ROOT%\*") do (
  if exist "%%D\package.json" (
    set "name=%%~nD"
    echo.
    echo === Installing in !name! (path: %%D) ===
    docker run --rm -v "%%D":/usr/src/app -w /usr/src/app %IMAGE% sh -c "npm install"
  )
)

popd >nul
echo.
echo All done.
endlocal
