# Backend configuration for Terraform state management
# Version: ~> 1.6
# Purpose: Configures secure and highly available state storage using AWS S3 and DynamoDB

terraform {
  backend "s3" {
    # S3 bucket for state storage with environment-based paths
    bucket = "precheck-me-terraform-state"
    key    = "${var.environment}/terraform.tfstate"
    region = "us-east-1"  # Primary region for state storage

    # Enhanced security configuration
    encrypt        = true
    kms_key_id    = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/terraform-state-key"
    sse_algorithm = "aws:kms"
    acl           = "private"

    # State locking using DynamoDB
    dynamodb_table = "precheck-me-terraform-locks"

    # Access control and authentication
    role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformStateAccess"

    # Workspace and organization settings
    workspace_key_prefix = "env"

    # Additional security and configuration options
    force_path_style      = true
    skip_region_validation = false

    # Versioning enabled for state history and recovery
    versioning = true

    # Additional S3 configuration
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "aws:kms"
          kms_key_id    = "arn:aws:kms:us-east-1:ACCOUNT_ID:key/terraform-state-key"
        }
      }
    }

    # Lifecycle rules for state management
    lifecycle_rule {
      enabled = true

      noncurrent_version_transition {
        days          = 30
        storage_class = "STANDARD_IA"
      }

      noncurrent_version_expiration {
        days = 90
      }
    }

    # Cross-region replication for disaster recovery
    replication_configuration {
      role = "arn:aws:iam::ACCOUNT_ID:role/TerraformStateReplication"

      rules {
        id     = "StateReplicationRule"
        status = "Enabled"

        destination {
          bucket        = "arn:aws:s3:::precheck-me-terraform-state-dr"
          storage_class = "STANDARD"
          
          encryption_configuration {
            replica_kms_key_id = "arn:aws:kms:us-west-2:ACCOUNT_ID:key/terraform-state-key-dr"
          }
        }
      }
    }
  }
}

# Backend configuration validation
locals {
  backend_validation = {
    environment_valid = contains(["development", "staging", "production"], var.environment)
    region_valid     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.region))
  }

  validate_backend = {
    environment_check = local.backend_validation.environment_valid ? null : file("ERROR: Invalid environment specified")
    region_check     = local.backend_validation.region_valid ? null : file("ERROR: Invalid region specified")
  }
}