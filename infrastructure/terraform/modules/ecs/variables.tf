# Environment name for resource naming and tagging
variable "environment" {
  type        = string
  description = "Deployment environment (staging/production)"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

# Base name for ECS resources
variable "name" {
  type        = string
  description = "Base name for ECS cluster and related resources"
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.name))
    error_message = "Name must contain only lowercase letters, numbers, and hyphens."
  }
}

# VPC Configuration
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where ECS resources will be deployed"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for ECS task deployment"
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets must be provided for high availability."
  }
}

# Container Images
variable "container_image_web" {
  type        = string
  description = "Docker image URI for web application (e.g., {account}.dkr.ecr.{region}.amazonaws.com/precheck-web:{tag})"
  validation {
    condition     = can(regex("^[0-9]+\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/[a-z0-9-]+:[a-zA-Z0-9._-]+$", var.container_image_web))
    error_message = "Container image URI must be a valid ECR image URI with tag."
  }
}

variable "container_image_api" {
  type        = string
  description = "Docker image URI for API service (e.g., {account}.dkr.ecr.{region}.amazonaws.com/precheck-api:{tag})"
  validation {
    condition     = can(regex("^[0-9]+\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/[a-z0-9-]+:[a-zA-Z0-9._-]+$", var.container_image_api))
    error_message = "Container image URI must be a valid ECR image URI with tag."
  }
}

variable "container_image_worker" {
  type        = string
  description = "Docker image URI for background worker (e.g., {account}.dkr.ecr.{region}.amazonaws.com/precheck-worker:{tag})"
  validation {
    condition     = can(regex("^[0-9]+\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/[a-z0-9-]+:[a-zA-Z0-9._-]+$", var.container_image_worker))
    error_message = "Container image URI must be a valid ECR image URI with tag."
  }
}

# Service Scaling Configuration
variable "desired_count_web" {
  type        = number
  description = "Desired number of web application tasks"
  default     = 2
  validation {
    condition     = var.desired_count_web >= 2
    error_message = "At least two web tasks are required for high availability."
  }
}

variable "desired_count_api" {
  type        = number
  description = "Desired number of API service tasks"
  default     = 2
  validation {
    condition     = var.desired_count_api >= 2
    error_message = "At least two API tasks are required for high availability."
  }
}

variable "desired_count_worker" {
  type        = number
  description = "Desired number of background worker tasks"
  default     = 2
  validation {
    condition     = var.desired_count_worker >= 1
    error_message = "At least one worker task is required."
  }
}

# Resource Allocation - Web Service
variable "cpu_web" {
  type        = number
  description = "CPU units for web application tasks (1024 units = 1 vCPU)"
  default     = 1024
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.cpu_web)
    error_message = "CPU units must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "memory_web" {
  type        = number
  description = "Memory allocation in MiB for web application tasks"
  default     = 2048
  validation {
    condition     = var.memory_web >= 512 && var.memory_web <= 30720
    error_message = "Memory must be between 512 MiB and 30720 MiB."
  }
}

# Resource Allocation - API Service
variable "cpu_api" {
  type        = number
  description = "CPU units for API service tasks (1024 units = 1 vCPU)"
  default     = 1024
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.cpu_api)
    error_message = "CPU units must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "memory_api" {
  type        = number
  description = "Memory allocation in MiB for API service tasks"
  default     = 2048
  validation {
    condition     = var.memory_api >= 512 && var.memory_api <= 30720
    error_message = "Memory must be between 512 MiB and 30720 MiB."
  }
}

# Resource Allocation - Worker Service
variable "cpu_worker" {
  type        = number
  description = "CPU units for background worker tasks (1024 units = 1 vCPU)"
  default     = 512
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.cpu_worker)
    error_message = "CPU units must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "memory_worker" {
  type        = number
  description = "Memory allocation in MiB for background worker tasks"
  default     = 1024
  validation {
    condition     = var.memory_worker >= 512 && var.memory_worker <= 30720
    error_message = "Memory must be between 512 MiB and 30720 MiB."
  }
}