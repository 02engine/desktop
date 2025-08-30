@echo off
title Executable Signing Tool - Automated Batch Signing By Deep-sea-lab for 02engine
PUSHD "%~DP0" && CD /D "%~DP0"

:: Enable delayed variable expansion
setlocal enabledelayedexpansion

:: Check if running as administrator
net session >nul 2>&1
if %errorlevel% == 0 (
    echo Already running with administrator privileges
) else (
    echo Requesting administrator privileges...
    :: Use PowerShell to elevate privileges
    powershell -Command "Start-Process cmd -ArgumentList '/c %~f0' -Verb RunAs"
    exit /b
)

:: Set certificate-related files and password
set "CER_FILE=%~DP0deepsealab.cer"
set "PVK_FILE=%~DP0deepsealab.pvk"
set "SPC_FILE=%~DP0deepsealab.spc"
set "PFX_FILE=%~DP0deepsealab.pfx"
set "CERT_PASS=0.2Studio"

:: Check if PFX file exists, otherwise convert .pvk and .spc to .pfx
if exist "%PFX_FILE%" (
    echo Using existing PFX file: %PFX_FILE%
) else (
    :: Check if certificate files exist
    if not exist "%CER_FILE%" (
        echo Error: Certificate file %CER_FILE% does not exist!
    )
    if not exist "%PVK_FILE%" (
        echo Error: Private key file %PVK_FILE% does not exist!
    )
    if not exist "%SPC_FILE%" (
        echo Error: SPC file %SPC_FILE% does not exist!
    )
    :: Convert .pvk and .spc to .pfx
    echo Converting .pvk and .spc to .pfx ...
    pvk2pfx.exe -pvk "%PVK_FILE%" -pi "%CERT_PASS%" -spc "%SPC_FILE%" -pfx "%PFX_FILE%" -f
    if %errorlevel% NEQ 0 (
        echo Error: Failed to generate .pfx file!
    ) else (
        echo .pfx file generated successfully: %PFX_FILE%
    )
)

:: Set dist folder path (parent directory's dist folder)
set "DIST_DIR=%~DP0..\dist"
:: Set output folder for signed files (same level as dist)
set "SIGNED_DIR=%~DP0..\windows_signed"

:: Check if dist folder exists
if not exist "%DIST_DIR%" (
    echo Error: dist folder %DIST_DIR% does not exist!
    goto :end
)

:: Create windows_signed folder if it doesn't exist
if not exist "%SIGNED_DIR%" (
    mkdir "%SIGNED_DIR%"
    echo Created windows_signed folder: %SIGNED_DIR%
)

:: Copy all .exe files from dist to windows_signed
echo Copying .exe files from %DIST_DIR% to %SIGNED_DIR%...
for %%F in ("%DIST_DIR%\*.exe") do (
    set "FILENAME=%%~nxF"
    copy /Y "%%F" "%SIGNED_DIR%\!FILENAME!"
    if %errorlevel% EQU 0 (
        echo Copied: %%F to %SIGNED_DIR%\!FILENAME!
    ) else (
        echo Error: Failed to copy %%F!
    )
)

:: Sign all .exe files in windows_signed folder
echo Starting to sign .exe files in %SIGNED_DIR%...
for %%F in ("%SIGNED_DIR%\*.exe") do (
    :: Sign the file
    signtool.exe sign /f "%PFX_FILE%" /p "%CERT_PASS%" /v "%%F"
    if %errorlevel% EQU 0 (
        echo Successfully signed: %%F
        :: Add timestamp (optional)
        signtool.exe timestamp /t http://timestamp.comodoca.com "%%F"
        if %errorlevel% EQU 0 (
            echo Timestamp added successfully: %%F
        ) else (
            echo Warning: Failed to add timestamp to %%F!
        )
    ) else (
        echo Error: Failed to sign %%F!
    )
)

:end
echo Signing process completed!
endlocal
exit /b 0