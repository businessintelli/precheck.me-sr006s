# Production Environment Configuration
variable "environment" {
  description = "Production environment identifier"
  type        = string
  default     = "production"
  validation {
    condition     = var.environment == "production"
    error_message = "This configuration is strictly for production environment."
  }
}

# Regional Configuration
variable "aws_region" {
  description = "Primary AWS region for production deployment"
  type        = string
  default     = "us-east-1"
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]{1}$", var.aws_region))
    error_message = "Primary region must be a valid AWS region identifier."
  }
}

variable "dr_region" {
  description = "Disaster recovery AWS region"
  type        = string
  default     = "us-west-2"
  validation {
    condition     = var.dr_region != var.aws_region
    error_message = "DR region must be different from primary region."
  }
}

# Network Configuration
variable "vpc_cidr" {
  description = "Production VPC CIDR block"
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
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "Production requires at least three availability zones."
  }
}

# Database Configuration
variable "rds_instance_class" {
  description = "Production RDS instance class"
  type        = string
  default     = "db.r6g.xlarge"
  validation {
    condition     = can(regex("^db\\.[mr][0-9]+g\\.[0-9]*xlarge$", var.rds_instance_class))
    error_message = "Production RDS must use r6g or m6g instance types."
  }
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = true
  validation {
    condition     = var.rds_multi_az == true
    error_message = "Multi-AZ must be enabled for production RDS."
  }
}

# Cache Configuration
variable "redis_node_type" {
  description = "Production Redis node type"
  type        = string
  default     = "cache.r6g.large"
  validation {
    condition     = can(regex("^cache\\.[mr][0-9]+g\\.[a-z]+$", var.redis_node_type))
    error_message = "Production Redis must use r6g or m6g node types."
  }
}

# Container Configuration
variable "ecs_min_capacity" {
  description = "Minimum ECS task count"
  type        = number
  default     = 3
  validation {
    condition     = var.ecs_min_capacity >= 3
    error_message = "Production minimum capacity must be at least 3."
  }
}

variable "ecs_max_capacity" {
  description = "Maximum ECS task count"
  type        = number
  default     = 10
  validation {
    condition     = var.ecs_max_capacity >= var.ecs_min_capacity
    error_message = "Maximum capacity must be greater than minimum capacity."
  }
}

# Backup Configuration
variable "backup_retention_days" {
  description = "RDS backup retention period in days"
  type        = number
  default     = 7
  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Production backup retention must be at least 7 days."
  }
}

# Monitoring Configuration
variable "enable_container_insights" {
  description = "Enable ECS Container Insights monitoring"
  type        = bool
  default     = true
  validation {
    condition     = var.enable_container_insights == true
    error_message = "Container Insights must be enabled in production."
  }
}

# Resource Tagging
variable "tags" {
  description = "Production environment resource tags"
  type        = map(string)
  default = {
    Environment = "production"
    Project     = "precheck-me"
    Terraform   = "true"
    CostCenter  = "prod-infrastructure"
    Backup      = "required"
  }
  validation {
    condition     = lookup(var.tags, "Environment", "") == "production"
    error_message = "Tags must specify production environment."
  }
}