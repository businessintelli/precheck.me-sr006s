# Terraform AWS S3 Module Variables
# Version: hashicorp/terraform >= 1.6.0

variable "environment" {
  type        = string
  description = "Deployment environment (development, staging, production)"
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

variable "bucket_name" {
  type        = string
  description = "Name of the S3 bucket for document storage"
  
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]*[a-z0-9]$", var.bucket_name))
    error_message = "Bucket name must be lowercase alphanumeric and can contain hyphens and dots"
  }
}

variable "versioning_enabled" {
  type        = bool
  description = "Enable versioning for document history tracking and retention"
  default     = true
}

variable "lifecycle_rules" {
  type = list(object({
    id                                     = string
    enabled                               = bool
    prefix                                = string
    tags                                  = map(string)
    expiration_days                       = number
    noncurrent_version_expiration_days    = number
    transition_days                       = number
    transition_storage_class              = string
    noncurrent_version_transition_days    = number
    noncurrent_version_transition_storage_class = string
  }))
  description = "Lifecycle rules for document retention and archival"
  default = [
    {
      id                                     = "default-lifecycle-rule"
      enabled                               = true
      prefix                                = ""
      tags                                  = {}
      expiration_days                       = 0
      noncurrent_version_expiration_days    = 90
      transition_days                       = 30
      transition_storage_class              = "STANDARD_IA"
      noncurrent_version_transition_days    = 30
      noncurrent_version_transition_storage_class = "GLACIER"
    }
  ]
}

variable "encryption_enabled" {
  type        = bool
  description = "Enable server-side encryption for document storage using AWS KMS"
  default     = true
}

variable "cors_rules" {
  type = list(object({
    allowed_headers = list(string)
    allowed_methods = list(string)
    allowed_origins = list(string)
    expose_headers  = list(string)
    max_age_seconds = number
  }))
  description = "CORS configuration for web client access to the S3 bucket"
  default = [
    {
      allowed_headers = ["*"]
      allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
      allowed_origins = ["*"]
      expose_headers  = ["ETag"]
      max_age_seconds = 3000
    }
  ]

  validation {
    condition = alltrue([
      for rule in var.cors_rules :
      alltrue([
        length(rule.allowed_methods) > 0,
        length(rule.allowed_origins) > 0,
        rule.max_age_seconds >= 0
      ])
    ])
    error_message = "CORS rules must specify at least one allowed method and origin, and max_age_seconds must be non-negative"
  }
}

variable "tags" {
  type        = map(string)
  description = "Resource tags for the S3 bucket"
  default = {
    Terraform   = "true"
    Environment = "development"
    Service     = "document-storage"
  }

  validation {
    condition     = length(var.tags) > 0
    error_message = "At least one tag must be specified"
  }
}

variable "block_public_access" {
  type = object({
    block_public_acls       = bool
    block_public_policy     = bool
    ignore_public_acls      = bool
    restrict_public_buckets = bool
  })
  description = "Settings for blocking public access to the S3 bucket"
  default = {
    block_public_acls       = true
    block_public_policy     = true
    ignore_public_acls      = true
    restrict_public_buckets = true
  }
}

variable "logging_enabled" {
  type        = bool
  description = "Enable access logging for the S3 bucket"
  default     = true
}

variable "logging_target_bucket" {
  type        = string
  description = "Target bucket for S3 access logs (required if logging_enabled is true)"
  default     = ""
}

variable "logging_target_prefix" {
  type        = string
  description = "Prefix for S3 access logs in the target bucket"
  default     = "s3-access-logs/"
}