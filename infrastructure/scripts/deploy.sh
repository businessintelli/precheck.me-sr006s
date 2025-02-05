#!/bin/bash

# Enterprise-grade deployment automation script for Precheck.me platform
# Version: 1.0.0
# Requires: kubectl v1.25+, aws-cli 2.x, datadog-agent 7.x

set -euo pipefail

# Global configuration
readonly ENVIRONMENTS=("development" "staging" "production")
readonly REGIONS=("us-east-1" "us-west-2" "eu-west-1")
readonly DEPLOYMENT_TIMEOUT=1800
readonly HEALTH_CHECK_INTERVAL=30
readonly MONITORING_ENDPOINTS='{
    "prometheus": "/metrics",
    "health": "/health",
    "readiness": "/ready"
}'

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

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

# Validate required tools
validate_prerequisites() {
    local required_tools=("kubectl" "aws" "datadog-agent")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            exit 1
        fi
    done
}

# Validate infrastructure readiness
validate_infrastructure() {
    local environment=$1
    local region=$2

    log_info "Validating infrastructure in $region for $environment environment"

    # Check AWS credentials
    aws sts get-caller-identity --region "$region" > /dev/null || {
        log_error "Invalid AWS credentials for region $region"
        return 1
    }

    # Validate Kubernetes cluster health
    kubectl get nodes --context "$environment-$region" || {
        log_error "Failed to connect to Kubernetes cluster in $region"
        return 1
    }

    # Check resource quotas
    kubectl describe quota --context "$environment-$region" || {
        log_warn "Resource quota check failed in $region"
    }

    return 0
}

# Configure monitoring and metrics
setup_monitoring() {
    local environment=$1
    local region=$2

    log_info "Setting up monitoring for $environment in $region"

    # Initialize Datadog agent
    datadog-agent status || {
        log_error "Failed to initialize Datadog agent"
        return 1
    }

    # Configure Prometheus endpoints
    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: precheck-monitor
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: precheck
  endpoints:
  - port: metrics
    interval: 30s
EOF
}

# Perform blue/green deployment
deploy_blue_green() {
    local environment=$1
    local region=$2
    local version=$3

    log_info "Starting blue/green deployment for $environment in $region"

    # Create new deployment
    kubectl apply -f infrastructure/kubernetes/backend-deployment.yaml \
        --context "$environment-$region" || {
        log_error "Failed to apply deployment configuration"
        return 1
    }

    # Wait for new pods
    kubectl rollout status deployment/backend \
        --timeout="${DEPLOYMENT_TIMEOUT}s" \
        --context "$environment-$region" || {
        log_error "Deployment timeout exceeded"
        kubectl rollout undo deployment/backend --context "$environment-$region"
        return 1
    }

    # Verify health checks
    local retries=0
    while [ $retries -lt 3 ]; do
        if curl -sf "https://$environment-$region.precheck.me/health"; then
            log_info "Health check passed"
            return 0
        fi
        ((retries++))
        sleep "$HEALTH_CHECK_INTERVAL"
    done

    log_error "Health check failed after 3 attempts"
    return 1
}

# Multi-region deployment orchestration
deploy_multi_region() {
    local environment=$1
    local version=$2

    log_info "Starting multi-region deployment for $environment"

    # Deploy to primary region first
    deploy_blue_green "$environment" "${REGIONS[0]}" "$version" || {
        log_error "Primary region deployment failed"
        return 1
    }

    # Progressive rollout to secondary regions
    for region in "${REGIONS[@]:1}"; do
        log_info "Deploying to $region"
        deploy_blue_green "$environment" "$region" "$version" || {
            log_error "Deployment failed in $region"
            continue
        }
    done
}

# Monitor deployment progress
monitor_deployment() {
    local environment=$1
    local start_time
    start_time=$(date +%s)

    log_info "Monitoring deployment progress"

    # Setup monitoring dashboards
    setup_monitoring "$environment" "${REGIONS[0]}" || {
        log_warn "Failed to setup monitoring"
    }

    # Watch deployment metrics
    while true; do
        local current_time
        current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -gt "$DEPLOYMENT_TIMEOUT" ]; then
            log_error "Deployment monitoring timeout exceeded"
            return 1
        fi

        # Check deployment status
        if kubectl get deployment backend \
            --context "$environment-${REGIONS[0]}" \
            -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' | grep -q "True"; then
            log_info "Deployment successful"
            return 0
        fi

        sleep "$HEALTH_CHECK_INTERVAL"
    done
}

# Main deployment function
main() {
    local environment=$1
    local version=${2:-latest}

    # Validate inputs
    if [[ ! " ${ENVIRONMENTS[*]} " =~ ${environment} ]]; then
        log_error "Invalid environment: $environment"
        exit 1
    }

    # Validate prerequisites
    validate_prerequisites || exit 1

    # Validate infrastructure in all regions
    for region in "${REGIONS[@]}"; do
        validate_infrastructure "$environment" "$region" || exit 1
    done

    # Start deployment
    log_info "Starting deployment of version $version to $environment"

    # Perform multi-region deployment
    deploy_multi_region "$environment" "$version" || {
        log_error "Multi-region deployment failed"
        exit 1
    }

    # Monitor deployment
    monitor_deployment "$environment" || {
        log_error "Deployment monitoring failed"
        exit 1
    }

    log_info "Deployment completed successfully"
}

# Script entry point
if [ "$#" -lt 1 ]; then
    log_error "Usage: $0 <environment> [version]"
    exit 1
fi

main "$@"