@echo off
set PATH=%PATH%;C:\Program Files\nodejs
set NODE_ENV=development
cd /d "D:\Car Rental - App"
"C:\Program Files\nodejs\node.exe" "D:\Car Rental - App\node_modules\next\dist\bin\next" dev
