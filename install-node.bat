@echo off
echo Starting custom node installation...

rem First clean up existing installations
cd C:\Users\jwolf\.n8n\custom\node_modules
if exist n8n-nodes-textduplicator (
    echo Removing old installation...
    rmdir /s /q n8n-nodes-textduplicator
)

rem Go to your node project and rebuild
cd C:\git\personal\n8n-nodes-textduplicator
if exist dist (
    echo Cleaning dist folder...
    rmdir /s /q dist
)

echo Installing dependencies...
call npm install

echo Building project...
call npm run build

rem Create custom directory if it doesn't exist
cd C:\Users\jwolf\.n8n
if not exist custom (
    echo Creating custom directory...
    mkdir custom
)
cd custom
if not exist node_modules (
    echo Creating node_modules directory...
    mkdir node_modules
)
cd node_modules

echo Installing custom node...
call npm install C:\git\personal\n8n-nodes-textduplicator

echo Verifying installation...
dir n8n-nodes-textduplicator

echo Installation complete!
echo Please restart n8n to see the changes.
pause