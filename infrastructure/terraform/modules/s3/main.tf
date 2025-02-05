# AWS S3 Module for Precheck.me Document Storage
# Provider: hashicorp/aws ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Main document storage bucket
resource "aws_s3_bucket" "documents" {
  bucket = "${var.environment}-${var.bucket_name}"
  
  # Force destroy only in non-production environments
  force_destroy = var.environment != "production"

  # Enable transfer acceleration for improved upload/download speeds
  acceleration_status = "Enabled"

  tags = merge(var.tags, {
    Name        = "${var.environment}-${var.bucket_name}"
    Environment = var.environment
  })
}

# Versioning configuration
resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Disabled"
  }
}

# Server-side encryption configuration
resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
      kms_master_key_id = "aws/s3"
    }
    bucket_key_enabled = true
  }
}

# Lifecycle rules configuration
resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  dynamic "rule" {
    for_each = var.lifecycle_rules
    content {
      id     = rule.value.id
      status = rule.value.enabled ? "Enabled" : "Disabled"

      filter {
        prefix = rule.value.prefix
        tags   = rule.value.tags
      }

      # Transition rules for current versions
      dynamic "transition" {
        for_each = rule.value.transition_days > 0 ? [1] : []
        content {
          days          = rule.value.transition_days
          storage_class = rule.value.transition_storage_class
        }
      }

      # Expiration rules for current versions
      dynamic "expiration" {
        for_each = rule.value.expiration_days > 0 ? [1] : []
        content {
          days = rule.value.expiration_days
        }
      }

      # Rules for noncurrent versions
      dynamic "noncurrent_version_transition" {
        for_each = rule.value.noncurrent_version_transition_days > 0 ? [1] : []
        content {
          noncurrent_days = rule.value.noncurrent_version_transition_days
          storage_class   = rule.value.noncurrent_version_transition_storage_class
        }
      }

      dynamic "noncurrent_version_expiration" {
        for_each = rule.value.noncurrent_version_expiration_days > 0 ? [1] : []
        content {
          noncurrent_days = rule.value.noncurrent_version_expiration_days
        }
      }
    }
  }
}

# CORS configuration
resource "aws_s3_bucket_cors_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  dynamic "cors_rule" {
    for_each = var.cors_rules
    content {
      allowed_headers = cors_rule.value.allowed_headers
      allowed_methods = cors_rule.value.allowed_methods
      allowed_origins = cors_rule.value.allowed_origins
      expose_headers  = cors_rule.value.expose_headers
      max_age_seconds = cors_rule.value.max_age_seconds
    }
  }
}

# Public access block configuration
resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket policy for enforcing SSL and other security controls
resource "aws_s3_bucket_policy" "documents" {
  bucket = aws_s3_bucket.documents.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceSSLOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid       = "DenyIncorrectEncryptionHeader"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource = "${aws_s3_bucket.documents.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      }
    ]
  })
}

# Access logging configuration
resource "aws_s3_bucket_logging" "documents" {
  count = var.logging_enabled ? 1 : 0
  
  bucket = aws_s3_bucket.documents.id

  target_bucket = var.logging_target_bucket
  target_prefix = var.logging_target_prefix
}

# Intelligent tiering configuration for cost optimization
resource "aws_s3_bucket_intelligent_tiering_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  name   = "DocumentStorageOptimization"

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
}

# Object lock configuration for compliance requirements
resource "aws_s3_bucket_object_lock_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 90
    }
  }
}

# Bucket ownership controls
resource "aws_s3_bucket_ownership_controls" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

# Bucket notification configuration for event processing
resource "aws_s3_bucket_notification" "documents" {
  bucket = aws_s3_bucket.documents.id

  lambda_function {
    lambda_function_arn = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:document-processor"
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
    filter_suffix       = ".pdf"
  }
}

# Data sources for current AWS context
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}