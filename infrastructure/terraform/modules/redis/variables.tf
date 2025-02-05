# Core Terraform functionality for variable definitions and validation
terraform {
  required_version = "~> 1.6"
}

# Project name for resource naming and tagging
variable "project" {
  description = "Project name for resource naming and tagging"
  type        = string
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

# Deployment environment
variable "environment" {
  description = "Deployment environment (development, staging, production)"
  type        = string
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

# Redis cluster identifier
variable "cluster_id" {
  description = "Unique identifier for the Redis cluster"
  type        = string
  
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.cluster_id)) && length(var.cluster_id) <= 40
    error_message = "Cluster ID must contain only lowercase letters, numbers, hyphens and be <= 40 characters."
  }
}

# Node type for Redis instances
variable "node_type" {
  description = "AWS ElastiCache node type for Redis instances"
  type        = string
  
  validation {
    condition     = can(regex("^cache\\.[t3|r5|r6|m5|m6].*$", var.node_type))
    error_message = "Node type must be a valid ElastiCache instance type (e.g., cache.t3.micro, cache.r6g.large)."
  }
}

# Number of cache nodes
variable "num_cache_nodes" {
  description = "Number of cache nodes in the cluster"
  type        = number
  
  validation {
    condition     = var.num_cache_nodes >= 1 && var.num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 1 and 6."
  }
}

# Redis port
variable "port" {
  description = "Port number for Redis connections"
  type        = number
  default     = 6379
  
  validation {
    condition     = var.port > 0 && var.port < 65536
    error_message = "Port number must be between 1 and 65535."
  }
}

# VPC configuration
variable "vpc_id" {
  description = "VPC ID where the Redis cluster will be deployed"
  type        = string
  
  validation {
    condition     = can(regex("^vpc-[a-z0-9]+$", var.vpc_id))
    error_message = "VPC ID must be a valid AWS VPC identifier."
  }
}

variable "subnet_ids" {
  description = "List of subnet IDs for multi-AZ deployment"
  type        = list(string)
  
  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least two subnet IDs are required for high availability."
  }
}

# Redis configuration
variable "parameter_group_family" {
  description = "Redis parameter group family"
  type        = string
  default     = "redis7"
  
  validation {
    condition     = can(regex("^redis[5-7]\\.[x0-9]$", var.parameter_group_family))
    error_message = "Parameter group family must be a valid Redis version (e.g., redis7.x)."
  }
}

# Maintenance settings
variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:05:00-sun:09:00"
  
  validation {
    condition     = can(regex("^(mon|tue|wed|thu|fri|sat|sun):[0-2][0-9]:[0-5][0-9]-(mon|tue|wed|thu|fri|sat|sun):[0-2][0-9]:[0-5][0-9]$", var.maintenance_window))
    error_message = "Maintenance window must be in the format ddd:hh24:mi-ddd:hh24:mi."
  }
}

# Snapshot configuration
variable "snapshot_retention_limit" {
  description = "Number of days to retain automatic snapshots"
  type        = number
  
  validation {
    condition     = var.snapshot_retention_limit >= 0 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days."
  }
}

variable "snapshot_window" {
  description = "Daily time range for automated snapshots"
  type        = string
  default     = "03:00-05:00"
  
  validation {
    condition     = can(regex("^[0-2][0-9]:[0-5][0-9]-[0-2][0-9]:[0-5][0-9]$", var.snapshot_window))
    error_message = "Snapshot window must be in the format hh24:mi-hh24:mi."
  }
}

# Version upgrade settings
variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}

# Encryption settings
variable "at_rest_encryption_enabled" {
  description = "Enable encryption at rest"
  type        = bool
  default     = true
  
  validation {
    condition     = var.at_rest_encryption_enabled == true
    error_message = "Encryption at rest must be enabled for security compliance."
  }
}

variable "transit_encryption_enabled" {
  description = "Enable encryption in transit"
  type        = bool
  default     = true
  
  validation {
    condition     = var.transit_encryption_enabled == true
    error_message = "Encryption in transit must be enabled for security compliance."
  }
}

# Resource tagging
variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
  
  validation {
    condition     = contains(keys(var.tags), "Environment") && contains(keys(var.tags), "ManagedBy")
    error_message = "Tags must include 'Environment' and 'ManagedBy' keys."
  }
}