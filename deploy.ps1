# Simple deploy script
$resourceGroup = "copilotbotgroup"
$appName = "copilotbot-wpp"

# Create deployment package
Write-Host "Creating deployment package..."
Compress-Archive -Force -Path @("package.json", "index.js", "startup.sh") -DestinationPath deploy.zip

# Deploy to Azure
Write-Host "Deploying to Azure..."
az webapp deployment source config-zip `
    --resource-group $resourceGroup `
    --name $appName `
    --src deploy.zip

# Configure Node.js version and startup command
Write-Host "Configuring Node.js and startup..."
az webapp config set `
    --resource-group $resourceGroup `
    --name $appName `
    --linux-fx-version 'NODE|18-lts' `
    --startup-file 'npm start'

Write-Host "Deployment complete. Check status at:"
Write-Host "https://$appName.azurewebsites.net/status"
