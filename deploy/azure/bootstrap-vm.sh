#!/usr/bin/env bash

set -euo pipefail

APP_USER="${APP_USER:-azureuser}"
APP_DIR="${APP_DIR:-/home/${APP_USER}/Eventus-ATS-App}"
APP_ENV_FILE="${APP_ENV_FILE:-${APP_DIR}/.env.production}"
APP_PORT="${APP_PORT:-4175}"
SERVER_NAME="${SERVER_NAME:-_}"
SERVICE_NAME="${SERVICE_NAME:-eventus-ats}"
NODE_MAJOR="${NODE_MAJOR:-22}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo or as root."
  exit 1
fi

if ! id "${APP_USER}" >/dev/null 2>&1; then
  echo "User ${APP_USER} does not exist."
  exit 1
fi

if [[ ! -d "${APP_DIR}" ]]; then
  echo "App directory not found: ${APP_DIR}"
  exit 1
fi

if [[ ! -f "${APP_ENV_FILE}" ]]; then
  echo "Env file not found: ${APP_ENV_FILE}"
  exit 1
fi

install_base_packages() {
  apt-get update
  apt-get install -y ca-certificates curl gnupg git nginx build-essential
}

install_nodejs() {
  local current_major=""

  if command -v node >/dev/null 2>&1; then
    current_major="$(node -p "process.versions.node.split('.')[0]")"
  fi

  if [[ "${current_major}" == "${NODE_MAJOR}" ]]; then
    return
  fi

  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
}

prepare_app() {
  chown -R "${APP_USER}": "${APP_DIR}"
  chmod 600 "${APP_ENV_FILE}"

  sudo -u "${APP_USER}" bash -lc "
    set -euo pipefail
    cd '${APP_DIR}'
    npm ci
    npm run build
    set -a
    source '${APP_ENV_FILE}'
    set +a
    npm run db:migrate
  "
}

install_systemd_unit() {
  sed \
    -e "s|__APP_USER__|${APP_USER}|g" \
    -e "s|__APP_DIR__|${APP_DIR}|g" \
    -e "s|__APP_ENV_FILE__|${APP_ENV_FILE}|g" \
    "${APP_DIR}/deploy/azure/eventus-ats.service" \
    > "/etc/systemd/system/${SERVICE_NAME}.service"

  systemctl daemon-reload
  systemctl enable --now "${SERVICE_NAME}"
}

install_nginx_config() {
  sed \
    -e "s|__SERVER_NAME__|${SERVER_NAME}|g" \
    -e "s|__APP_PORT__|${APP_PORT}|g" \
    "${APP_DIR}/deploy/azure/nginx-eventus-ats.conf" \
    > "/etc/nginx/sites-available/${SERVICE_NAME}.conf"

  rm -f /etc/nginx/sites-enabled/default
  ln -sf "/etc/nginx/sites-available/${SERVICE_NAME}.conf" "/etc/nginx/sites-enabled/${SERVICE_NAME}.conf"
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
}

verify_local_health() {
  local attempt

  for attempt in 1 2 3 4 5 6; do
    if curl --fail --silent "http://127.0.0.1:${APP_PORT}/healthz" >/tmp/eventus-ats-healthz.json; then
      cat /tmp/eventus-ats-healthz.json
      echo
      return
    fi
    sleep 2
  done

  echo "App health check failed after waiting for the service to start."
  exit 1
}

install_base_packages
install_nodejs
prepare_app
install_systemd_unit
install_nginx_config
verify_local_health

echo "Azure VM bootstrap completed successfully."
