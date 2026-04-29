#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NexChat — Kubernetes Deploy Script
# Usage:
#   ./scripts/k8s-deploy.sh          # Deploy all
#   ./scripts/k8s-deploy.sh --down   # Tear down all
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

NAMESPACE="nexchat"
K8S_DIR="$(cd "$(dirname "$0")/../k8s" && pwd)"
BOLD='\033[1m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; RESET='\033[0m'

log()   { echo -e "${GREEN}[+]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[!]${RESET} $*"; }
error() { echo -e "${RED}[✗]${RESET} $*"; exit 1; }

# ── Teardown ──────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--down" ]]; then
    warn "Tearing down NexChat from namespace '${NAMESPACE}'..."
    kubectl delete namespace "${NAMESPACE}" --ignore-not-found
    log "Done."
    exit 0
fi

# ── Pre-flight checks ─────────────────────────────────────────────────────────
command -v kubectl &>/dev/null || error "kubectl not found — install it first"
kubectl cluster-info &>/dev/null || error "Cannot connect to Kubernetes cluster"

# ── Warn about secrets ────────────────────────────────────────────────────────
if grep -q "Y2hhbmdlX3RoaXNfaW5fcHJvZHVjdGlvbg==" "${K8S_DIR}/secrets.yaml" 2>/dev/null; then
    warn "⚠️  secrets.yaml still contains placeholder values!"
    warn "   Edit k8s/secrets.yaml before deploying to production."
    read -rp "Continue anyway? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || exit 0
fi

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  🚀 Deploying NexChat to Kubernetes${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

# 1. Namespace
log "Creating namespace..."
kubectl apply -f "${K8S_DIR}/namespace.yaml"

# 2. Config & Secrets
log "Applying ConfigMap and Secrets..."
kubectl apply -f "${K8S_DIR}/configmap.yaml"
kubectl apply -f "${K8S_DIR}/secrets.yaml"

# 3. Persistent Volumes
log "Applying PersistentVolumeClaims..."
kubectl apply -f "${K8S_DIR}/mongodb/pvc.yaml"
kubectl apply -f "${K8S_DIR}/redis/pvc.yaml"
kubectl apply -f "${K8S_DIR}/backend/pvc.yaml"

# 4. Databases (wait for healthy)
log "Deploying databases..."
kubectl apply -f "${K8S_DIR}/mongodb/"
kubectl apply -f "${K8S_DIR}/redis/"
log "Waiting for MongoDB to be ready..."
kubectl rollout status deployment/mongodb -n "${NAMESPACE}" --timeout=120s
log "Waiting for Redis to be ready..."
kubectl rollout status deployment/redis -n "${NAMESPACE}" --timeout=60s

# 5. Backend
log "Deploying backend..."
kubectl apply -f "${K8S_DIR}/backend/"
kubectl rollout status deployment/backend -n "${NAMESPACE}" --timeout=120s

# 6. Frontend
log "Deploying frontend..."
kubectl apply -f "${K8S_DIR}/frontend/"
kubectl rollout status deployment/frontend -n "${NAMESPACE}" --timeout=60s

# 7. Nginx proxy
log "Deploying Nginx..."
kubectl apply -f "${K8S_DIR}/nginx/"

# 8. Monitoring
log "Deploying Prometheus + Grafana..."
kubectl apply -f "${K8S_DIR}/monitoring/"

# 9. HPA + Ingress
log "Applying HPA and Ingress..."
kubectl apply -f "${K8S_DIR}/hpa.yaml"
kubectl apply -f "${K8S_DIR}/ingress.yaml"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}  ✅ Deployment complete!${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo "  📦 Pods:"
kubectl get pods -n "${NAMESPACE}" --no-headers
echo ""
echo "  🌐 Services:"
kubectl get svc -n "${NAMESPACE}" --no-headers
echo ""
echo "  Access (Minikube NodePort):"
echo "    App        → http://\$(minikube ip):30080"
echo "    Prometheus → http://\$(minikube ip):30090"
echo "    Grafana    → http://\$(minikube ip):30030  (admin / <GRAFANA_PASSWORD>)"
echo ""
