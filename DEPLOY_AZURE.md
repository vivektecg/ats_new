# Deploy on Azure Free Tier

This app is ready to run on Azure as:

- one Linux VM for the Node app
- one Azure Database for PostgreSQL Flexible Server for ATS storage

The deployment assets in this repo implement the testing-focused plan:

- [deploy/azure/create-azure-resources.sh](/Users/viveksharma/Documents/Eventus-ATS-App/deploy/azure/create-azure-resources.sh)
- [deploy/azure/bootstrap-vm.sh](/Users/viveksharma/Documents/Eventus-ATS-App/deploy/azure/bootstrap-vm.sh)
- [deploy/azure/eventus-ats.service](/Users/viveksharma/Documents/Eventus-ATS-App/deploy/azure/eventus-ats.service)
- [deploy/azure/nginx-eventus-ats.conf](/Users/viveksharma/Documents/Eventus-ATS-App/deploy/azure/nginx-eventus-ats.conf)
- [deploy/azure/.env.production.example](/Users/viveksharma/Documents/Eventus-ATS-App/deploy/azure/.env.production.example)

## What This Setup Assumes

- This is for testing or UAT, not hardened production.
- The frontend and API run from the same Node process in [server/ai-api.mjs](/Users/viveksharma/Documents/Eventus-ATS-App/server/ai-api.mjs).
- PostgreSQL is required in production mode.
- The app is deployed from GitHub after you push this repository.
- You use the Azure free-services flow where possible, then convert the subscription to pay-as-you-go within 30 days so the 12-month free allocations continue.

## Azure Resource Defaults

- Resource group: `eventus-ats-rg`
- Default region: `centralindia`
- Fallback region: `southeastasia`
- Second fallback region: `eastus`
- VM name: `eventus-ats-vm`
- VM size: `Standard_B1s`
- VM fallback size: `Standard_B2ats_v2`
- VM image: `Canonical:ubuntu-24_04-lts:server:latest`
- Admin user: `azureuser`
- PostgreSQL version: `16`
- PostgreSQL SKU: `Standard_B1ms`
- PostgreSQL storage: `32` GiB
- App port behind Nginx: `4175`

## 1. Push The App To GitHub

If you have not pushed the app yet, do that first. The VM bootstrap step expects the repo to be cloned onto the VM.

## 2. Install Azure CLI And Sign In

On your machine:

```bash
az login
az account show
```

If you manage multiple subscriptions:

```bash
az account set --subscription "<your-subscription-id-or-name>"
```

## 3. Create Azure Resources

Set a PostgreSQL admin password and run the helper:

```bash
export DB_ADMIN_PASSWORD='<strong-password>'
bash deploy/azure/create-azure-resources.sh
```

Important environment variables you can override before running:

```bash
export AZURE_LOCATION=centralindia
export RESOURCE_GROUP=eventus-ats-rg
export VM_NAME=eventus-ats-vm
export VM_SIZE=Standard_B1s
export VM_FALLBACK_SIZE=Standard_B2ats_v2
export VM_ADMIN_USER=azureuser
export VM_SSH_PUBLIC_KEY="$HOME/.ssh/id_ed25519.pub"
export DB_SERVER_NAME="eventus-ats-pg-$(date +%m%d%H)"
export DB_ADMIN_USER=eventusadmin
```

What the script creates:

- one resource group
- one Ubuntu 24.04 VM
- one NSG with:
  - `22` allowed only from your current public IP
  - `80` allowed from the internet
  - `443` allowed from the internet
- one public IP for the VM
- one PostgreSQL Flexible Server with public access limited first to your admin IP
- one firewall rule added afterward for the VM public IP

If `Standard_B1s` is unavailable, the script retries with `Standard_B2ats_v2`.

## 4. SSH Into The VM

After the resource script finishes:

```bash
ssh azureuser@<vm-public-ip>
```

## 5. Clone The Repo On The VM

On the VM:

```bash
git clone https://github.com/<your-user-or-org>/<your-repo>.git
cd <your-repo>
```

## 6. Create The Production Env File

Copy the example file and fill in the database host from the Azure PostgreSQL server output:

```bash
cp deploy/azure/.env.production.example .env.production
nano .env.production
chmod 600 .env.production
```

Minimum required values:

```env
NODE_ENV=production
PORT=4175
ATS_STORAGE=postgres
DATABASE_URL=postgres://eventusadmin:<PASSWORD>@<SERVER>.postgres.database.azure.com:5432/postgres
PGSSL=true
PGSSL_REJECT_UNAUTHORIZED=true
```

## 7. Bootstrap The VM

Run the bootstrap script as root from the repo:

```bash
sudo APP_DIR="$PWD" \
  APP_USER=azureuser \
  APP_ENV_FILE="$PWD/.env.production" \
  SERVER_NAME="_" \
  bash deploy/azure/bootstrap-vm.sh
```

What it does:

- installs `git`, `nginx`, `curl`, `build-essential`, and Node.js 22
- runs `npm ci`
- builds the Vite frontend
- runs PostgreSQL migrations
- installs the `systemd` service
- installs the Nginx reverse-proxy config
- enables and starts both services
- checks `http://127.0.0.1:4175/healthz`

## 8. Validate The Deployment

From your browser:

```text
http://<vm-public-ip>/login
```

Expected checks:

- `/login` loads
- first-run SuperUser bootstrap appears
- creating the initial admin account works
- `http://<vm-public-ip>/healthz` returns JSON with `"storage":"postgres"`

Optional VM checks:

```bash
sudo systemctl status eventus-ats --no-pager
sudo systemctl status nginx --no-pager
curl http://127.0.0.1:4175/healthz
```

## 9. Manual Cost Guardrails

The helper script does not create Azure budgets because those are subscription-scoped and teams often manage them centrally. After the app is up:

1. Open Azure Cost Management.
2. Create a budget alert at `$0`.
3. Create a second budget alert at `$5`.
4. Watch the VM, public IP, and PostgreSQL meters in the first 24 hours.

## Notes

- Keep only one VM and one PostgreSQL server for this test setup.
- Do not create Azure Bastion, load balancers, extra disks, snapshots, or a backup vault for this trial setup.
- If Azure free PostgreSQL is not available in your subscription flow, stop there and use PostgreSQL on the VM instead of accidentally provisioning a paid managed database.
- The app intentionally uses same-origin API paths in production, so no extra frontend base URL configuration is required for the normal Azure VM setup.
