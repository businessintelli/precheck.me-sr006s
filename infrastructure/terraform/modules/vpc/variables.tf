# Core VPC configuration
variable "vpc_cidr" {
  type        = string
  description = "The CIDR block for the VPC network"
  
  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block (e.g., 10.0.0.0/16)"
  }

  validation {
    condition     = tonumber(split("/", var.vpc_cidr)[1]) <= 24
    error_message = "VPC CIDR block must be /24 or larger to accommodate required subnets"
  }
}

# Environment identifier
variable "environment" {
  type        = string
  description = "Environment name for resource tagging and identification (e.g., dev, staging, prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Availability Zones configuration
variable "availability_zones" {
  type        = list(string)
  description = "List of AWS Availability Zones for subnet distribution"
  
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability"
  }

  validation {
    condition     = length(var.availability_zones) <= 4
    error_message = "Maximum of 4 availability zones supported"
  }

  validation {
    condition     = alltrue([for az in var.availability_zones : can(regex("^[a-z]{2}-[a-z]+-[0-9][a-z]$", az))])
    error_message = "Availability zone names must be in the format: region-az (e.g., us-east-1a)"
  }
}

# Public subnet configuration
variable "public_subnet_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks for public subnets, one per availability zone"
  
  validation {
    condition     = alltrue([for cidr in var.public_subnet_cidrs : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", cidr))])
    error_message = "Public subnet CIDRs must be valid IPv4 CIDR blocks"
  }

  validation {
    condition     = alltrue([for cidr in var.public_subnet_cidrs : tonumber(split("/", cidr)[1]) >= 24])
    error_message = "Public subnet CIDR blocks must be /24 or smaller"
  }
}

# Private subnet configuration
variable "private_subnet_cidrs" {
  type        = list(string)
  description = "List of CIDR blocks for private subnets, one per availability zone"
  
  validation {
    condition     = alltrue([for cidr in var.private_subnet_cidrs : can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", cidr))])
    error_message = "Private subnet CIDRs must be valid IPv4 CIDR blocks"
  }

  validation {
    condition     = alltrue([for cidr in var.private_subnet_cidrs : tonumber(split("/", cidr)[1]) >= 24])
    error_message = "Private subnet CIDR blocks must be /24 or smaller"
  }
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Map of tags to apply to all VPC resources"
  
  default = {
    "Organization" = "Precheck.me"
    "ManagedBy"   = "Terraform"
  }

  validation {
    condition     = length(var.tags) > 0
    error_message = "At least one tag must be specified"
  }

  validation {
    condition     = can(lookup(var.tags, "Organization"))
    error_message = "Organization tag is required"
  }
}