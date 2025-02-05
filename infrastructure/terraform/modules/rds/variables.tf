# Environment configuration
variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

# Networking configuration
variable "vpc_id" {
  description = "VPC ID where RDS instances will be deployed"
  type        = string
}

variable "database_subnet_ids" {
  description = "List of subnet IDs for RDS subnet group"
  type        = list(string)
}

# Instance configuration
variable "instance_class" {
  description = "RDS instance class for primary database"
  type        = string
  default     = "db.t3.medium"
  validation {
    condition     = can(regex("^db\\.[t3|r5|m5]\\.", var.instance_class))
    error_message = "Instance class must be a valid RDS instance type starting with db.t3, db.r5, or db.m5"
  }
}

variable "allocated_storage" {
  description = "Initial storage allocation in GB"
  type        = number
  default     = 20
  validation {
    condition     = var.allocated_storage >= 20 && var.allocated_storage <= 16384
    error_message = "Allocated storage must be between 20 and 16384 GB"
  }
}

variable "max_allocated_storage" {
  description = "Maximum storage allocation for autoscaling in GB"
  type        = number
  default     = 1000
  validation {
    condition     = var.max_allocated_storage >= 20 && var.max_allocated_storage <= 16384
    error_message = "Maximum allocated storage must be between 20 and 16384 GB"
  }
}

# Database configuration
variable "db_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_name))
    error_message = "Database name must start with a letter and contain only alphanumeric characters and underscores"
  }
}

variable "db_username" {
  description = "Master username for database access"
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_username))
    error_message = "Username must start with a letter and contain only alphanumeric characters and underscores"
  }
}

variable "db_password" {
  description = "Master password for database access"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.db_password) >= 8
    error_message = "Database password must be at least 8 characters long"
  }
}

# High availability configuration
variable "multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = true
}

# Backup configuration
variable "backup_retention_period" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
  validation {
    condition     = var.backup_retention_period >= 0 && var.backup_retention_period <= 35
    error_message = "Backup retention period must be between 0 and 35 days"
  }
}

# Read replica configuration
variable "enable_read_replica" {
  description = "Flag to enable read replica instance"
  type        = bool
  default     = false
}

variable "read_replica_instance_class" {
  description = "RDS instance class for read replica"
  type        = string
  default     = "db.t3.medium"
  validation {
    condition     = can(regex("^db\\.[t3|r5|m5]\\.", var.read_replica_instance_class))
    error_message = "Read replica instance class must be a valid RDS instance type starting with db.t3, db.r5, or db.m5"
  }
}

# Performance configuration
variable "performance_insights_enabled" {
  description = "Enable Performance Insights for monitoring"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 7
  validation {
    condition     = contains([7, 731], var.performance_insights_retention_period)
    error_message = "Performance Insights retention period must be either 7 or 731 days"
  }
}

# Security configuration
variable "deletion_protection" {
  description = "Enable deletion protection for the RDS instance"
  type        = bool
  default     = true
}

variable "storage_encrypted" {
  description = "Enable storage encryption using KMS"
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = "KMS key ID for storage encryption"
  type        = string
  default     = null
}

# Maintenance configuration
variable "preferred_maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:03:00-sun:04:00"
  validation {
    condition     = can(regex("^[a-z]{3}:[0-9]{2}:[0-9]{2}-[a-z]{3}:[0-9]{2}:[0-9]{2}$", var.preferred_maintenance_window))
    error_message = "Maintenance window must be in the format ddd:hh24:mi-ddd:hh24:mi"
  }
}

variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}