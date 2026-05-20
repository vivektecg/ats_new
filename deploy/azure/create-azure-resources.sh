#!/usr/bin/env bash

set -euo pipefail

AZURE_LOCATION="${AZURE_LOCATION:-centralindia}"
RESOURCE_GROUP="${RESOURCE_GROUP:-eventus-ats-rg}"
VM_NAME="${VM_NAME:-eventus-ats-vm}"
VM_SIZE="${VM_SIZE:-Standard_B1s}"
VM_FALLBACK_SIZE="${VM_FALLBACK_SIZE:-Standard_B2ats_v2}"
VM_IMAGE="${VM_IMAGE:-Canonical:ubuntu-24_04-lts:server:latest}"
VM_ADMIN_USER="${VM_ADMIN_USER:-azureuser}"
VM_SSH_PUBLIC_KEY="${VM_SSH_PUBLIC_KEY:-$HOME/.ssh/id_ed25519.pub}"
VNET_NAME="${VNET_NAME:-${VM_NAME}-vnet}"
SUBNET_NAME="${SUBNET_NAME:-${VM_NAME}-subnet}"
NSG_NAME="${NSG_NAME:-${VM_NAME}-nsg}"
PUBLIC_IP_NAME="${PUBLIC_IP_NAME:-${VM_NAME}-ip}"
DB_SERVER_NAME="${DB_SERVER_NAME:-eventus-ats-pg-$(date +%m%d%H%M)}"
DB_ADMIN_USER="${DB_ADMIN_USER:-eventusadmin}"
DB_ADMIN_PASSWORD="${DB_ADMIN_PASSWORD:-}"
DB_SKU_NAME="${DB_SKU_NAME:-Standard_B1ms}"
DB_TIER="${DB_TIER:-Burstable}"
DB_VERSION="${DB_VERSION:-16}"
DB_STORAGE_GB="${DB_STORAGE_GB:-32}"
DB_NAME="${DB_NAME:-postgres}"
ADMIN_PUBLIC_IP="${ADMIN_PUBLIC_IP:-}"

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI is required. Install it and retry."
  exit 1
fi

if [[ -z "${DB_ADMIN_PASSWORD}" ]]; then
  echo "Set DB_ADMIN_PASSWORD before running this script."
  exit 1
fi

if [[ ! -f "${VM_SSH_PUBLIC_KEY}" ]]; then
  echo "SSH public key not found: ${VM_SSH_PUBLIC_KEY}"
  exit 1
fi

az account show >/dev/null

if [[ -z "${ADMIN_PUBLIC_IP}" ]]; then
  ADMIN_PUBLIC_IP="$(curl -fsSL https://api.ipify.org)"
fi

echo "Using admin IP: ${ADMIN_PUBLIC_IP}"

az group create \
  --name "${RESOURCE_GROUP}" \
  --location "${AZURE_LOCATION}" \
  --output none

create_vm() {
  local size="$1"

  az vm create \
    --resource-group "${RESOURCE_GROUP}" \
    --location "${AZURE_LOCATION}" \
    --name "${VM_NAME}" \
    --image "${VM_IMAGE}" \
    --size "${size}" \
    --admin-username "${VM_ADMIN_USER}" \
    --authentication-type ssh \
    --ssh-key-values "${VM_SSH_PUBLIC_KEY}" \
    --public-ip-address "${PUBLIC_IP_NAME}" \
    --public-ip-sku Standard \
    --vnet-name "${VNET_NAME}" \
    --subnet "${SUBNET_NAME}" \
    --nsg "${NSG_NAME}" \
    --nsg-rule NONE \
    --output none
}

echo "Creating VM ${VM_NAME} in ${AZURE_LOCATION} using ${VM_SIZE}..."
if ! create_vm "${VM_SIZE}"; then
  echo "Primary VM size ${VM_SIZE} failed. Retrying with ${VM_FALLBACK_SIZE}..."
  create_vm "${VM_FALLBACK_SIZE}"
fi

az network nsg rule create \
  --resource-group "${RESOURCE_GROUP}" \
  --nsg-name "${NSG_NAME}" \
  --name "AllowSshFromAdminIp" \
  --priority 1000 \
  --access Allow \
  --direction Inbound \
  --protocol Tcp \
  --source-address-prefixes "${ADMIN_PUBLIC_IP}" \
  --source-port-ranges "*" \
  --destination-address-prefixes "*" \
  --destination-port-ranges 22 \
  --output none

az network nsg rule create \
  --resource-group "${RESOURCE_GROUP}" \
  --nsg-name "${NSG_NAME}" \
  --name "AllowHttp" \
  --priority 1010 \
  --access Allow \
  --direction Inbound \
  --protocol Tcp \
  --source-address-prefixes Internet \
  --source-port-ranges "*" \
  --destination-address-prefixes "*" \
  --destination-port-ranges 80 \
  --output none

az network nsg rule create \
  --resource-group "${RESOURCE_GROUP}" \
  --nsg-name "${NSG_NAME}" \
  --name "AllowHttps" \
  --priority 1020 \
  --access Allow \
  --direction Inbound \
  --protocol Tcp \
  --source-address-prefixes Internet \
  --source-port-ranges "*" \
  --destination-address-prefixes "*" \
  --destination-port-ranges 443 \
  --output none

VM_PUBLIC_IP="$(az vm show -d \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${VM_NAME}" \
  --query publicIps \
  --output tsv)"

echo "Creating PostgreSQL flexible server ${DB_SERVER_NAME}..."
az postgres flexible-server create \
  --resource-group "${RESOURCE_GROUP}" \
  --location "${AZURE_LOCATION}" \
  --name "${DB_SERVER_NAME}" \
  --admin-user "${DB_ADMIN_USER}" \
  --admin-password "${DB_ADMIN_PASSWORD}" \
  --sku-name "${DB_SKU_NAME}" \
  --tier "${DB_TIER}" \
  --storage-size "${DB_STORAGE_GB}" \
  --storage-auto-grow Disabled \
  --geo-redundant-backup Disabled \
  --public-access "${ADMIN_PUBLIC_IP}" \
  --version "${DB_VERSION}" \
  --output none

az postgres flexible-server firewall-rule create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${DB_SERVER_NAME}" \
  --rule-name "AllowVmPublicIp" \
  --start-ip-address "${VM_PUBLIC_IP}" \
  --end-ip-address "${VM_PUBLIC_IP}" \
  --output none

cat <<EOF

Azure resources created.

VM public IP: ${VM_PUBLIC_IP}
PostgreSQL host: ${DB_SERVER_NAME}.postgres.database.azure.com
PostgreSQL database: ${DB_NAME}
PostgreSQL user: ${DB_ADMIN_USER}

Next steps:
1. ssh ${VM_ADMIN_USER}@${VM_PUBLIC_IP}
2. Clone this repo onto the VM
3. Copy deploy/azure/.env.production.example to .env.production
4. Set DATABASE_URL to:
   postgres://${DB_ADMIN_USER}:${DB_ADMIN_PASSWORD}@${DB_SERVER_NAME}.postgres.database.azure.com:5432/${DB_NAME}
5. Run:
   sudo APP_DIR="\$PWD" APP_USER=${VM_ADMIN_USER} APP_ENV_FILE="\$PWD/.env.production" SERVER_NAME="_" bash deploy/azure/bootstrap-vm.sh

Important:
- Create Azure budget alerts manually after deployment.
- If you want to use a fallback region, rerun this script with AZURE_LOCATION=southeastasia or AZURE_LOCATION=eastus.
EOF
