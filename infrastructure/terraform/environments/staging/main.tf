# Terraform configuration for Precheck.me staging environment
# Version: 1.0.0

terraform {
  required_version = ">= 1.6.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket         = "precheck-staging-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "precheck-staging-terraform-locks"
  }
}

# Local variables for resource naming and tagging
locals {
  environment = "staging"
  name_prefix = "precheck-staging"
  common_tags = {
    Environment        = "staging"
    Project           = "precheck-me"
    ManagedBy         = "terraform"
    CostCenter        = "staging-ops"
    SecurityLevel     = "high"
    DataClassification = "sensitive"
  }
}

# VPC Configuration
module "vpc" {
  source = "../../modules/vpc"

  vpc_cidr           = var.vpc_cidr
  environment        = var.environment
  availability_zones = var.availability_zones
  
  tags = merge(local.common_tags, {
    Component = "networking"
  })
}

# ECS Cluster and Services
module "ecs" {
  source = "../../modules/ecs"

  environment         = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  container_insights = var.ecs_container_insights
  
  # Staging-specific auto-scaling configuration
  min_capacity = var.ecs_min_capacity
  max_capacity = var.ecs_max_capacity
  
  tags = merge(local.common_tags, {
    Component = "container-orchestration"
  })
}

# RDS Database
module "rds" {
  source = "../../modules/rds"

  environment          = var.environment
  vpc_id              = module.vpc.vpc_id
  database_subnet_ids = module.vpc.private_subnet_ids
  instance_class      = var.db_instance_class
  multi_az            = var.multi_az
  
  # Enable enhanced monitoring for staging
  performance_insights_enabled = var.enable_enhanced_monitoring
  monitoring_interval         = var.monitoring_interval
  
  tags = merge(local.common_tags, {
    Component = "database"
  })
}

# Redis Cache Cluster
module "redis" {
  source = "../../modules/redis"

  environment         = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_type          = var.redis_node_type
  
  tags = merge(local.common_tags, {
    Component = "cache"
  })
}

# Enhanced Monitoring Configuration
module "monitoring" {
  source = "../../modules/monitoring"

  environment     = var.environment
  cluster_name   = module.ecs.cluster_name
  db_identifier = module.rds.db_identifier
  
  # Staging-specific monitoring settings
  alarm_thresholds = {
    cpu_utilization    = 70
    memory_utilization = 80
    db_connections     = 100
  }
  
  tags = merge(local.common_tags, {
    Component = "monitoring"
  })
}

# Output VPC resource identifiers
output "vpc_outputs" {
  description = "VPC resource identifiers and configurations"
  value = {
    vpc_id             = module.vpc.vpc_id
    private_subnet_ids = module.vpc.private_subnet_ids
    security_group_ids = module.vpc.security_group_ids
  }
}

# Output monitoring configurations
output "monitoring_outputs" {
  description = "Monitoring and alerting configuration details"
  value = {
    cloudwatch_log_groups = module.monitoring.cloudwatch_log_groups
    alarm_topics         = module.monitoring.alarm_topics
    metric_namespaces    = module.monitoring.metric_namespaces
  }
  sensitive = true
}