@echo off
setlocal

REM Check if node name parameter was provided
if "%~1"=="" (
    echo ERROR: Please provide the node name as a parameter
    echo Usage: %0 [node-name]
    echo Example: %0 n8n-nodes-textduplicator
    pause
    exit /b 1
)

REM Store the node name in a variable
set NODE_NAME=%~1

REM ====================================================================
REM This script installs/updates a custom n8n node
REM It cleans previous installations, rebuilds the node, and installs it
REM Node name: %NODE_NAME%
REM ====================================================================

echo Starting custom node installation for: %NODE_NAME%

REM Step 1: Clean up any existing installation from n8n custom nodes directory
REM This prevents conflicts with old versions
echo Step 1: Cleaning up existing installation...
cd C:\Users\jwolf\.n8n\custom\node_modules
if exist %NODE_NAME% (
    echo Found existing installation, removing it...
    rmdir /s /q %NODE_NAME%
)

REM Step 2: Navigate to project directory and clean build artifacts
REM Remove the dist folder to ensure a clean build
echo Step 2: Preparing for fresh build...
cd C:\git\personal\%NODE_NAME%
if exist dist (
    echo Cleaning dist folder for fresh build...
    rmdir /s /q dist
)

REM Step 3: Install npm dependencies
REM This ensures all required packages are available for the build
echo Step 3: Installing project dependencies...
call npm install

REM Step 4: Build the project
REM This compiles TypeScript to JavaScript and prepares the node for installation
echo Step 4: Building the project...
call npm run build

REM Step 5: Ensure n8n custom directories exist
REM n8n looks for custom nodes in .n8n/custom/node_modules
echo Step 5: Setting up n8n custom directories...
cd C:\Users\jwolf\.n8n
if not exist custom (
    echo Creating custom directory for n8n...
    mkdir custom
)
cd custom
if not exist node_modules (
    echo Creating node_modules directory for custom nodes...
    mkdir node_modules
)
cd node_modules

REM Step 6: Install the custom node
REM This copies the built node to n8n's custom node directory
echo Step 6: Installing custom node in n8n...
call npm install C:\git\personal\%NODE_NAME%

REM Step 7: Verify the installation
REM Check that the node files are properly installed
echo Step 7: Verifying installation...
dir %NODE_NAME%

REM Final step: Inform user about completion and need to restart
echo ====================================================================
echo Installation complete for: %NODE_NAME%!
echo IMPORTANT: You must restart n8n to see the changes.
echo Steps to complete:
echo 1. Stop n8n if it's running
echo 2. Start n8n again
echo 3. Check n8n UI for your custom node
echo ====================================================================
pause