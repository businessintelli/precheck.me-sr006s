# Environment Configuration
variable "environment" {
  description = "Deployment environment (development, staging, production)"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

# Regional Configuration
variable "region" {
  description = "Primary AWS region for deployment"
  type        = string
  default     = "us-east-1"
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.region))
    error_message = "Region must be a valid AWS region identifier (e.g., us-east-1)."
  }
}

variable "dr_region" {
  description = "AWS region for disaster recovery deployment"
  type        = string
  default     = "us-west-2"
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.dr_region))
    error_message = "DR region must be a valid AWS region identifier (e.g., us-west-2)."
  }
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for the VPC network"
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones" {
  description = "List of AWS availability zones for multi-AZ deployment"
  type        = list(string)
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones must be specified for high availability."
  }
}

# Database Configuration
variable "db_instance_class" {
  description = "RDS instance class for PostgreSQL database"
  type        = string
  default     = "db.t3.large"
  validation {
    condition     = can(regex("^db\\.[a-z0-9]+\\.[a-z0-9]+$", var.db_instance_class))
    error_message = "DB instance class must be a valid RDS instance type."
  }
}

# Cache Configuration
variable "redis_node_type" {
  description = "ElastiCache node type for Redis cluster"
  type        = string
  default     = "cache.t3.medium"
  validation {
    condition     = can(regex("^cache\\.[a-z0-9]+\\.[a-z0-9]+$", var.redis_node_type))
    error_message = "Redis node type must be a valid ElastiCache node type."
  }
}

# Container Configuration
variable "ecs_container_insights" {
  description = "Enable/disable Container Insights for ECS monitoring"
  type        = bool
  default     = true
}

# Resource Tagging
variable "tags" {
  description = "Common resource tags for all infrastructure components"
  type        = map(string)
  default = {
    Project     = "precheck-me"
    Terraform   = "true"
    Environment = "development"
  }
  validation {
    condition     = length(var.tags) > 0
    error_message = "At least one tag must be specified."
  }
}

# Scaling Configuration
variable "min_capacity" {
  description = "Minimum number of ECS tasks per service"
  type        = number
  default     = 2
  validation {
    condition     = var.min_capacity >= 1
    error_message = "Minimum capacity must be at least 1."
  }
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks per service"
  type        = number
  default     = 10
  validation {
    condition     = var.max_capacity >= var.min_capacity
    error_message = "Maximum capacity must be greater than or equal to minimum capacity."
  }
}

# Backup Configuration
variable "backup_retention_period" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
  validation {
    condition     = var.backup_retention_period >= 1 && var.backup_retention_period <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

# SSL/TLS Configuration
variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS endpoints"
  type        = string
  validation {
    condition     = can(regex("^arn:aws:acm:", var.certificate_arn))
    error_message = "Certificate ARN must be a valid ACM certificate ARN."
  }
}

# Monitoring Configuration
variable "alarm_email" {
  description = "Email address for CloudWatch alarms"
  type        = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.alarm_email))
    error_message = "Must provide a valid email address for alarms."
  }
}