# CollabPlatform Local Runner
# This script starts all microservices in separate windows

Write-Host "🚀 Starting Real-Time Collaboration Platform..." -ForegroundColor Cyan

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev" -WindowStyle Normal
Write-Host "✅ Backend starting on port 5000..."

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal
Write-Host "✅ Frontend starting on port 5173..."

# Start WS Server (Yjs)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ws-server; npm run dev" -WindowStyle Normal
Write-Host "✅ Yjs Sync Server starting on port 1234..."

# Start Terminal Service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd terminal-service; npm start" -WindowStyle Normal
Write-Host "✅ Terminal Service starting on port 4000..."

# Start Execution Service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd execution-service; npm start" -WindowStyle Normal
Write-Host "✅ Execution Service starting on port 5001..."

Write-Host "------------------------------------------------"
Write-Host "All services are launching in separate windows." -ForegroundColor Green
Write-Host "Make sure MongoDB (27017) and Redis (6379) are running!" -ForegroundColor Yellow
