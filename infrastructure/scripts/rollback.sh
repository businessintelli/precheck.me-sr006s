#!/bin/bash

# Rollback script for Kubernetes deployments
# Version: 1.0.0
# Dependencies:
# - kubectl v1.25+
# - aws-cli 2.x
# - jq 1.6+

set -euo pipefail

# Global variables
readonly ENVIRONMENTS=("staging" "production")
readonly REGIONS=("us-east-1" "us-west-2")
readonly REQUIRED_TOOLS=("kubectl" "aws" "jq")
readonly HEALTH_CHECK_TIMEOUT=300
readonly NAMESPACE="precheck-me"
readonly DEPLOYMENTS=("backend" "web-frontend")
readonly MONITORING_ENDPOINTS='{
  "prometheus": "http://prometheus:9090",
  "alertmanager": "http://alertmanager:9093"
}'

# Logging functions
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_warning() {
    echo "[WARNING] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Check prerequisites
check_prerequisites() {
    local environment=$1
    local region=$2

    # Validate environment
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${environment} " ]]; then
        log_error "Invalid environment: $environment"
        return 1
    }

    # Validate region
    if [[ ! " ${REGIONS[@]} " =~ " ${region} " ]]; then
        log_error "Invalid region: $region"
        return 1
    }

    # Check required tools
    for tool in "${REQUIRED_TOOLS[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            return 1
        fi
    done

    # Verify kubectl context
    if ! kubectl config current-context &> /dev/null; then
        log_error "kubectl context not set"
        return 1
    }

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        return 1
    }

    return 0
}

# Get previous revision
get_previous_revision() {
    local deployment_name=$1
    local namespace=$2
    local region=$3

    # Get deployment history
    local history
    history=$(kubectl rollout history deployment/"$deployment_name" -n "$namespace" -o json)
    if [ $? -ne 0 ]; then
        log_error "Failed to get deployment history for $deployment_name"
        return 1
    }

    # Get previous revision number
    local previous_revision
    previous_revision=$(echo "$history" | jq -r '.status.history[-2].revision')
    if [ -z "$previous_revision" ]; then
        log_error "No previous revision found for $deployment_name"
        return 1
    }

    echo "$previous_revision"
    return 0
}

# Perform rollback
perform_rollback() {
    local deployment_name=$1
    local namespace=$2
    local revision=$3
    local region=$4

    log_info "Starting rollback for $deployment_name to revision $revision"

    # Create pre-rollback snapshot
    kubectl get deployment "$deployment_name" -n "$namespace" -o yaml > "/tmp/${deployment_name}_pre_rollback.yaml"

    # Execute rollback
    if ! kubectl rollout undo deployment/"$deployment_name" -n "$namespace" --to-revision="$revision"; then
        log_error "Failed to rollback $deployment_name"
        return 1
    }

    # Wait for rollout to complete
    if ! kubectl rollout status deployment/"$deployment_name" -n "$namespace" --timeout="${HEALTH_CHECK_TIMEOUT}s"; then
        log_error "Rollback failed to complete within timeout period"
        return 1
    }

    return 0
}

# Verify rollback
verify_rollback() {
    local deployment_name=$1
    local namespace=$2
    local region=$3

    # Check deployment status
    local ready_replicas
    ready_replicas=$(kubectl get deployment "$deployment_name" -n "$namespace" -o jsonpath='{.status.readyReplicas}')
    if [ "$ready_replicas" -eq 0 ]; then
        log_error "No ready replicas found after rollback"
        return 1
    }

    # Check health endpoints
    local health_endpoint
    if [ "$deployment_name" == "backend" ]; then
        health_endpoint="/health"
    else
        health_endpoint="/api/health"
    fi

    # Get service IP
    local service_ip
    service_ip=$(kubectl get service "$deployment_name" -n "$namespace" -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    # Verify health endpoint
    if ! curl -sf "http://${service_ip}:3000${health_endpoint}" &> /dev/null; then
        log_error "Health check failed after rollback"
        return 1
    }

    return 0
}

# Update monitoring
update_monitoring() {
    local deployment_name=$1
    local status=$2
    local region=$3

    # Send alert to AlertManager
    local alert_payload="{
        \"status\": \"$status\",
        \"labels\": {
            \"deployment\": \"$deployment_name\",
            \"region\": \"$region\",
            \"severity\": \"info\"
        },
        \"annotations\": {
            \"summary\": \"Rollback $status for $deployment_name in $region\",
            \"description\": \"Deployment rollback operation $status at $(date -u '+%Y-%m-%dT%H:%M:%SZ')\"
        }
    }"

    curl -X POST -H "Content-Type: application/json" \
        -d "$alert_payload" \
        "$(echo "$MONITORING_ENDPOINTS" | jq -r '.alertmanager')/api/v1/alerts" || true

    return 0
}

# Main rollback function
main() {
    if [ $# -ne 3 ]; then
        echo "Usage: $0 <deployment_name> <environment> <region>"
        exit 1
    fi

    local deployment_name=$1
    local environment=$2
    local region=$3

    # Validate deployment name
    if [[ ! " ${DEPLOYMENTS[@]} " =~ " ${deployment_name} " ]]; then
        log_error "Invalid deployment name: $deployment_name"
        exit 1
    }

    # Check prerequisites
    if ! check_prerequisites "$environment" "$region"; then
        log_error "Prerequisites check failed"
        exit 1
    }

    # Get previous revision
    local previous_revision
    previous_revision=$(get_previous_revision "$deployment_name" "$NAMESPACE" "$region")
    if [ $? -ne 0 ]; then
        log_error "Failed to get previous revision"
        exit 1
    }

    # Perform rollback
    if ! perform_rollback "$deployment_name" "$NAMESPACE" "$previous_revision" "$region"; then
        log_error "Rollback failed"
        update_monitoring "$deployment_name" "failed" "$region"
        exit 1
    fi

    # Verify rollback
    if ! verify_rollback "$deployment_name" "$NAMESPACE" "$region"; then
        log_error "Rollback verification failed"
        update_monitoring "$deployment_name" "verification_failed" "$region"
        exit 1
    }

    # Update monitoring
    update_monitoring "$deployment_name" "success" "$region"

    log_info "Rollback completed successfully for $deployment_name"
    return 0
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi