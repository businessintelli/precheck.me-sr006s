# Core environment configuration
variable "environment" {
  type        = string
  description = "Environment identifier for staging deployment"
  default     = "staging"

  validation {
    condition     = var.environment == "staging"
    error_message = "This configuration is specifically for staging environment"
  }
}

variable "region" {
  type        = string
  description = "AWS region for staging deployment"
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.region))
    error_message = "Region must be a valid AWS region identifier"
  }
}

# VPC Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for staging VPC"
  default     = "10.1.0.0/16"  # Staging-specific CIDR range

  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for staging environment"
  default     = ["us-east-1a", "us-east-1b"]  # Two AZs for staging

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "Staging environment requires at least 2 availability zones"
  }
}

# Database Configuration
variable "db_instance_class" {
  type        = string
  description = "RDS instance class for staging database"
  default     = "db.t3.large"  # Moderate size for staging

  validation {
    condition     = can(regex("^db\\.[t3|r5|m5]\\.", var.db_instance_class))
    error_message = "DB instance class must be a valid RDS instance type"
  }
}

# Redis Configuration
variable "redis_node_type" {
  type        = string
  description = "ElastiCache node type for staging Redis cluster"
  default     = "cache.t3.medium"  # Moderate size for staging

  validation {
    condition     = can(regex("^cache\\.[t3|r5|m5]\\.", var.redis_node_type))
    error_message = "Redis node type must be a valid ElastiCache instance type"
  }
}

# ECS Configuration
variable "ecs_container_insights" {
  type        = bool
  description = "Enable Container Insights for ECS monitoring in staging"
  default     = true
}

variable "ecs_min_capacity" {
  type        = number
  description = "Minimum ECS task count for staging auto-scaling"
  default     = 2  # Minimum 2 tasks for staging

  validation {
    condition     = var.ecs_min_capacity >= 2
    error_message = "Staging environment requires minimum 2 tasks for high availability"
  }
}

variable "ecs_max_capacity" {
  type        = number
  description = "Maximum ECS task count for staging auto-scaling"
  default     = 4  # Maximum 4 tasks for staging

  validation {
    condition     = var.ecs_max_capacity >= var.ecs_min_capacity
    error_message = "Maximum capacity must be greater than or equal to minimum capacity"
  }
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Resource tags for staging environment infrastructure"
  default = {
    "Environment"  = "staging"
    "Organization" = "Precheck.me"
    "ManagedBy"   = "Terraform"
    "Purpose"     = "Staging deployment"
  }

  validation {
    condition     = contains(keys(var.tags), "Environment") && var.tags["Environment"] == "staging"
    error_message = "Tags must include Environment=staging"
  }
}

# High Availability Configuration
variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ deployment for staging RDS"
  default     = true  # Enable HA for staging
}

# Monitoring Configuration
variable "enable_enhanced_monitoring" {
  type        = bool
  description = "Enable enhanced monitoring for RDS in staging"
  default     = true
}

variable "monitoring_interval" {
  type        = number
  description = "Enhanced monitoring interval in seconds"
  default     = 30

  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be one of: 0, 1, 5, 10, 15, 30, 60"
  }
}