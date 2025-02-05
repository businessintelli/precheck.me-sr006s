#!/bin/bash

# Monitoring Stack Setup Script v1.0.0
# Sets up a highly available monitoring stack for Precheck.me platform
# Components: Prometheus, Grafana, Alertmanager, Loki

set -euo pipefail

# Global variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../monitoring"
MONITORING_VERSION="v1.0.0"
PROMETHEUS_PORT="9090"
GRAFANA_PORT="3000"
ALERTMANAGER_PORT="9093"
LOKI_PORT="3100"
HA_REPLICA_COUNT="3"
RETENTION_DAYS="90"
BACKUP_ENABLED="true"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites and security requirements
check_prerequisites() {
    local cluster_context="$1"
    local namespace="$2"
    local verify_ssl="${3:-true}"

    log_info "Checking prerequisites..."

    # Check required tools
    for tool in kubectl helm jq openssl; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool $tool is not installed"
            exit 1
        fi
    done

    # Verify kubectl context
    if ! kubectl config use-context "$cluster_context" &> /dev/null; then
        log_error "Failed to switch to context: $cluster_context"
        exit 1
    fi

    # Check namespace existence and create if needed
    if ! kubectl get namespace "$namespace" &> /dev/null; then
        kubectl create namespace "$namespace"
        log_info "Created namespace: $namespace"
    fi

    # Verify SSL certificates if enabled
    if [[ "$verify_ssl" == "true" ]]; then
        for cert in cert.pem key.pem ca.pem; do
            if [[ ! -f "${CONFIG_DIR}/certs/${cert}" ]]; then
                log_error "Missing SSL certificate: ${cert}"
                exit 1
            fi
        done
    fi

    # Check storage class availability
    if ! kubectl get storageclass &> /dev/null; then
        log_error "No storage class found in cluster"
        exit 1
    }

    log_info "Prerequisites check completed successfully"
}

# Install and configure Prometheus with HA
install_prometheus() {
    local namespace="$1"
    local config_path="${CONFIG_DIR}/prometheus.yml"

    log_info "Installing Prometheus..."

    # Add Prometheus helm repository
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update

    # Create Prometheus values file
    cat > /tmp/prometheus-values.yaml <<EOF
replicas: ${HA_REPLICA_COUNT}
retention: ${RETENTION_DAYS}d
persistentVolume:
  size: 100Gi
  storageClass: standard
configMapReloadImage:
  repository: jimmidyson/configmap-reload
  tag: v0.5.0
serviceMonitor:
  enabled: true
alertmanager:
  enabled: true
  replicaCount: ${HA_REPLICA_COUNT}
EOF

    # Install/upgrade Prometheus
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace "$namespace" \
        --values /tmp/prometheus-values.yaml \
        --set-file configmapReload.prometheus.yaml="$config_path" \
        --wait

    # Verify deployment
    if ! kubectl rollout status statefulset/prometheus-server -n "$namespace" --timeout=300s; then
        log_error "Prometheus deployment failed"
        exit 1
    }

    log_info "Prometheus installation completed"
}

# Install and configure Grafana
install_grafana() {
    local namespace="$1"
    local dashboards_path="${CONFIG_DIR}/grafana-dashboards.json"

    log_info "Installing Grafana..."

    # Add Grafana helm repository
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Create Grafana values file
    cat > /tmp/grafana-values.yaml <<EOF
replicas: ${HA_REPLICA_COUNT}
persistence:
  enabled: true
  size: 10Gi
adminPassword: "${GRAFANA_ADMIN_PASSWORD}"
datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
      - name: Prometheus
        type: prometheus
        url: http://prometheus-server:${PROMETHEUS_PORT}
        isDefault: true
      - name: Loki
        type: loki
        url: http://loki:${LOKI_PORT}
dashboardProviders:
  dashboardproviders.yaml:
    apiVersion: 1
    providers:
      - name: 'default'
        orgId: 1
        folder: ''
        type: file
        disableDeletion: false
        editable: true
        options:
          path: /var/lib/grafana/dashboards
EOF

    # Install/upgrade Grafana
    helm upgrade --install grafana grafana/grafana \
        --namespace "$namespace" \
        --values /tmp/grafana-values.yaml \
        --set-file "dashboards[0].json"="$dashboards_path" \
        --wait

    log_info "Grafana installation completed"
}

# Install and configure Alertmanager
install_alertmanager() {
    local namespace="$1"
    local config_path="${CONFIG_DIR}/alertmanager.yml"

    log_info "Installing Alertmanager..."

    # Create Alertmanager ConfigMap
    kubectl create configmap alertmanager-config \
        --from-file=alertmanager.yml="$config_path" \
        -n "$namespace" \
        --dry-run=client -o yaml | kubectl apply -f -

    # Create Alertmanager deployment
    cat > /tmp/alertmanager-deployment.yaml <<EOF
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: alertmanager
  namespace: ${namespace}
spec:
  replicas: ${HA_REPLICA_COUNT}
  selector:
    matchLabels:
      app: alertmanager
  serviceName: alertmanager
  template:
    metadata:
      labels:
        app: alertmanager
    spec:
      containers:
      - name: alertmanager
        image: prom/alertmanager:v0.25.0
        args:
          - "--config.file=/etc/alertmanager/alertmanager.yml"
          - "--storage.path=/alertmanager"
          - "--cluster.listen-address=0.0.0.0:9094"
        ports:
          - containerPort: ${ALERTMANAGER_PORT}
            name: http
          - containerPort: 9094
            name: cluster
        volumeMounts:
          - name: config
            mountPath: /etc/alertmanager
          - name: storage
            mountPath: /alertmanager
      volumes:
        - name: config
          configMap:
            name: alertmanager-config
  volumeClaimTemplates:
    - metadata:
        name: storage
      spec:
        accessModes: [ "ReadWriteOnce" ]
        resources:
          requests:
            storage: 10Gi
EOF

    kubectl apply -f /tmp/alertmanager-deployment.yaml

    log_info "Alertmanager installation completed"
}

# Install and configure Loki
install_loki() {
    local namespace="$1"
    local config_path="${CONFIG_DIR}/loki.yml"

    log_info "Installing Loki..."

    # Add Loki helm repository
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Create Loki values file
    cat > /tmp/loki-values.yaml <<EOF
replicas: ${HA_REPLICA_COUNT}
persistence:
  enabled: true
  size: 50Gi
config:
  auth_enabled: false
  ingester:
    lifecycler:
      ring:
        replication_factor: ${HA_REPLICA_COUNT}
  schema_config:
    configs:
      - from: "2023-01-01"
        store: boltdb-shipper
        object_store: filesystem
        schema: v11
        index:
          prefix: index_
          period: 24h
EOF

    # Install/upgrade Loki
    helm upgrade --install loki grafana/loki \
        --namespace "$namespace" \
        --values /tmp/loki-values.yaml \
        --set-file "loki.config"="$config_path" \
        --wait

    log_info "Loki installation completed"
}

# Setup monitoring stack
setup_monitoring() {
    local cluster_context="$1"
    local namespace="$2"
    local verify_ssl="$3"

    log_info "Starting monitoring stack setup..."

    # Check prerequisites
    check_prerequisites "$cluster_context" "$namespace" "$verify_ssl"

    # Install components
    install_prometheus "$namespace"
    install_grafana "$namespace"
    install_alertmanager "$namespace"
    install_loki "$namespace"

    # Verify all components
    verify_installation "$namespace"

    log_info "Monitoring stack setup completed successfully"
}

# Verify installation
verify_installation() {
    local namespace="$1"

    log_info "Verifying installation..."

    # Check all pods are running
    local components=("prometheus" "grafana" "alertmanager" "loki")
    for component in "${components[@]}"; do
        if ! kubectl get pods -n "$namespace" -l "app=${component}" -o jsonpath='{.items[*].status.phase}' | grep -q "Running"; then
            log_error "${component} pods are not running"
            exit 1
        fi
    done

    # Verify service endpoints
    for component in "${components[@]}"; do
        if ! kubectl get service -n "$namespace" "${component}" &> /dev/null; then
            log_error "${component} service not found"
            exit 1
        fi
    done

    log_info "Installation verification completed successfully"
}

# Main execution
main() {
    if [[ $# -lt 2 ]]; then
        echo "Usage: $0 <cluster_context> <namespace> [verify_ssl]"
        exit 1
    fi

    local cluster_context="$1"
    local namespace="$2"
    local verify_ssl="${3:-true}"

    setup_monitoring "$cluster_context" "$namespace" "$verify_ssl"
}

# Execute main function
main "$@"