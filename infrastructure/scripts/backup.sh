#!/bin/bash

# Precheck.me Backup Script
# Version: 1.0.0
# Dependencies:
# - aws-cli ^2.0.0
# - postgresql-client 15.x

set -euo pipefail

# Global Configuration
BACKUP_RETENTION_DAYS=2555  # 7 years retention for compliance
BACKUP_PREFIX="precheck-backup"
MAX_CONCURRENT_UPLOADS=5
ALERT_EMAIL="devops@precheck.me"

# Load environment variables
if [ -f ".env" ]; then
    source .env
fi

# Logging configuration
LOGFILE="/var/log/precheck/backup-$(date +%Y%m%d).log"
mkdir -p "$(dirname "$LOGFILE")"

log() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$LOGFILE"
}

error() {
    log "ERROR: $1"
    send_notification "ERROR" "$1" "{}"
    exit 1
}

# Backup Database Function
backup_database() {
    local db_name=$1
    local output_path=$2
    local encryption_key=$3
    local start_time
    local end_time
    local backup_size
    local checksum
    
    start_time=$(date +%s)
    
    log "Starting database backup for $db_name"
    
    # Create backup directory
    mkdir -p "$output_path"
    
    # Generate backup filename with timestamp
    local backup_file="${output_path}/${db_name}-$(date +%Y%m%d-%H%M%S).sql.gz.enc"
    
    # Execute pg_dump with compression and encryption
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h "${DB_HOST}" \
        -U "${DB_USER}" \
        -d "$db_name" \
        -j 4 \
        -F c \
        | gzip \
        | openssl enc -aes-256-cbc -salt -k "$encryption_key" \
        > "$backup_file"
    
    if [ $? -ne 0 ]; then
        error "Database backup failed for $db_name"
    fi
    
    # Calculate backup metrics
    end_time=$(date +%s)
    backup_size=$(stat -f%z "$backup_file")
    checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
    
    # Generate backup metadata
    cat > "${backup_file}.meta" <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "database": "$db_name",
    "size": $backup_size,
    "checksum": "$checksum",
    "duration": $((end_time - start_time))
}
EOF
    
    # Upload to S3
    log "Uploading database backup to S3"
    aws s3 cp "$backup_file" "s3://${S3_BACKUP_BUCKET}/database/${db_name}/" \
        --storage-class STANDARD_IA
    aws s3 cp "${backup_file}.meta" "s3://${S3_BACKUP_BUCKET}/database/${db_name}/"
    
    # Upload to DR region
    if [ -n "${S3_DR_BUCKET:-}" ]; then
        log "Replicating backup to DR region"
        aws s3 cp "$backup_file" "s3://${S3_DR_BUCKET}/database/${db_name}/" \
            --storage-class STANDARD_IA
        aws s3 cp "${backup_file}.meta" "s3://${S3_DR_BUCKET}/database/${db_name}/"
    fi
    
    # Cleanup local files
    rm -f "$backup_file" "${backup_file}.meta"
    
    send_notification "SUCCESS" "Database backup completed for $db_name" \
        "{\"size\":$backup_size,\"duration\":$((end_time - start_time)),\"checksum\":\"$checksum\"}"
    
    return 0
}

# Backup Documents Function
backup_documents() {
    local source_bucket=$1
    local backup_bucket=$2
    local thread_count=$3
    local start_time
    local end_time
    
    start_time=$(date +%s)
    
    log "Starting document backup sync from $source_bucket to $backup_bucket"
    
    # Verify source bucket access
    aws s3 ls "s3://${source_bucket}" >/dev/null 2>&1 || {
        error "Cannot access source bucket ${source_bucket}"
    }
    
    # Calculate total size
    local total_size
    total_size=$(aws s3 ls --recursive "s3://${source_bucket}" | awk '{total += $3} END {print total}')
    
    # Perform multi-threaded sync
    aws s3 sync "s3://${source_bucket}" "s3://${backup_bucket}/documents" \
        --storage-class STANDARD_IA \
        --delete \
        --only-show-errors \
        --metadata-directive COPY \
        --request-payer requester \
        --exclude "*.tmp" \
        --include "*" \
        --cp-parallel $thread_count
    
    if [ $? -ne 0 ]; then
        error "Document sync failed"
    fi
    
    end_time=$(date +%s)
    
    # Verify sync
    local source_count
    local backup_count
    source_count=$(aws s3 ls --recursive "s3://${source_bucket}" | wc -l)
    backup_count=$(aws s3 ls --recursive "s3://${backup_bucket}/documents" | wc -l)
    
    if [ "$source_count" -ne "$backup_count" ]; then
        error "Document count mismatch after sync"
    fi
    
    send_notification "SUCCESS" "Document backup completed" \
        "{\"size\":$total_size,\"duration\":$((end_time - start_time)),\"objects\":$source_count}"
    
    return 0
}

# Cleanup Old Backups Function
cleanup_old_backups() {
    local backup_path=$1
    local retention_days=$2
    local force_cleanup=$3
    local start_time
    local end_time
    
    start_time=$(date +%s)
    
    log "Starting backup cleanup for files older than $retention_days days"
    
    # Find expired backups
    local expired_files
    expired_files=$(aws s3 ls "s3://${backup_path}" --recursive \
        | awk -v date="$(date -d "-${retention_days} days" +%Y-%m-%d)" '$1 < date {print $4}')
    
    if [ -z "$expired_files" ]; then
        log "No expired backups found"
        return 0
    fi
    
    # Generate pre-cleanup report
    local total_size=0
    local file_count=0
    
    while IFS= read -r file; do
        # Skip empty lines
        [ -z "$file" ] && continue
        
        # Check compliance tags
        local tags
        tags=$(aws s3api get-object-tagging --bucket "${backup_path%%/*}" --key "${file#*/}")
        
        if echo "$tags" | grep -q "Compliance=retain" && [ "$force_cleanup" != "true" ]; then
            log "Skipping compliance-tagged file: $file"
            continue
        fi
        
        # Delete file
        aws s3 rm "s3://${backup_path}/${file}" --only-show-errors
        
        ((file_count++))
        total_size=$((total_size + $(aws s3api head-object --bucket "${backup_path%%/*}" --key "${file#*/}" --query 'ContentLength' --output text)))
    done <<< "$expired_files"
    
    end_time=$(date +%s)
    
    send_notification "SUCCESS" "Backup cleanup completed" \
        "{\"files_removed\":$file_count,\"space_recovered\":$total_size,\"duration\":$((end_time - start_time))}"
    
    return 0
}

# Send Notification Function
send_notification() {
    local status=$1
    local message=$2
    local metrics=$3
    
    # Format email body
    local body
    body=$(cat <<EOF
Backup Operation Report
----------------------
Status: $status
Message: $message
Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)

Metrics:
$metrics

Log File: $LOGFILE
EOF
)
    
    # Send email notification
    echo "$body" | mail -s "Precheck.me Backup: $status" "$ALERT_EMAIL"
    
    # Post metrics to monitoring system if available
    if command -v datadog-agent >/dev/null 2>&1; then
        echo "backup.status:$status|g" | nc -u -w1 127.0.0.1 8125
        echo "backup.duration:$(echo "$metrics" | jq -r '.duration // 0')|g" | nc -u -w1 127.0.0.1 8125
    fi
    
    return 0
}

# Main execution
main() {
    log "Starting backup process"
    
    # Verify required tools
    command -v aws >/dev/null 2>&1 || error "AWS CLI is required"
    command -v pg_dump >/dev/null 2>&1 || error "pg_dump is required"
    
    # Generate encryption key
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    
    # Backup database
    backup_database "${DB_NAME}" "/tmp/backup" "$ENCRYPTION_KEY"
    
    # Backup documents
    backup_documents "${S3_SOURCE_BUCKET}" "${S3_BACKUP_BUCKET}" "$MAX_CONCURRENT_UPLOADS"
    
    # Cleanup old backups
    cleanup_old_backups "${S3_BACKUP_BUCKET}" "$BACKUP_RETENTION_DAYS" "false"
    
    log "Backup process completed successfully"
}

# Execute main function
main "$@"
```

This script provides a comprehensive backup solution with the following features:

1. Database backup with compression and encryption
2. Multi-threaded document storage backup
3. Retention policy enforcement
4. Integrity verification
5. Monitoring and notifications
6. Error handling and logging
7. Compliance considerations
8. DR site replication

The script follows enterprise-grade practices including:

- Proper error handling and logging
- Secure handling of credentials
- Parallel processing for performance
- Integrity verification through checksums
- Comprehensive monitoring and alerting
- Compliance with retention requirements
- Proper cleanup of temporary files
- Support for disaster recovery

Make sure to set the appropriate environment variables or .env file with the following:

```
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
S3_SOURCE_BUCKET=
S3_BACKUP_BUCKET=
S3_DR_BUCKET=