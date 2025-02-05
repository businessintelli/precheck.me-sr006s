# Main Terraform configuration for Precheck.me platform infrastructure
# Version: 1.0.0

# Import required providers and variables
terraform {
  required_version = "~> 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "precheck-me-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "precheck-me-terraform-locks"
  }
}

# Local variables for resource naming and tagging
locals {
  name_prefix = "${var.environment}-precheck"
  common_tags = {
    Environment        = var.environment
    Project           = "precheck-me"
    ManagedBy         = "terraform"
    CostCenter        = "platform-infrastructure"
    DataClassification = "confidential"
  }
}

# Primary region VPC module
module "vpc" {
  source = "./modules/vpc"
  
  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  name_prefix        = local.name_prefix
  tags               = local.common_tags
}

# DR region VPC module
module "vpc_dr" {
  source = "./modules/vpc"
  providers = {
    aws = aws.dr
  }
  
  environment         = var.environment
  vpc_cidr           = "10.1.0.0/16" # Different CIDR for DR region
  availability_zones = var.availability_zones
  name_prefix        = "${local.name_prefix}-dr"
  tags               = merge(local.common_tags, { Type = "disaster-recovery" })
}

# ECS cluster and services for primary region
module "ecs" {
  source = "./modules/ecs"
  
  environment            = var.environment
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  container_insights    = var.ecs_container_insights
  min_capacity          = var.min_capacity
  max_capacity          = var.max_capacity
  name_prefix           = local.name_prefix
  tags                  = local.common_tags
}

# ECS cluster and services for DR region
module "ecs_dr" {
  source = "./modules/ecs"
  providers = {
    aws = aws.dr
  }
  
  environment            = var.environment
  vpc_id                = module.vpc_dr.vpc_id
  private_subnet_ids    = module.vpc_dr.private_subnet_ids
  container_insights    = var.ecs_container_insights
  min_capacity          = 1 # Reduced capacity for DR
  max_capacity          = var.max_capacity
  name_prefix           = "${local.name_prefix}-dr"
  tags                  = merge(local.common_tags, { Type = "disaster-recovery" })
}

# RDS database configuration
module "rds" {
  source = "./modules/rds"
  
  environment              = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  instance_class          = var.db_instance_class
  backup_retention_period = var.backup_retention_period
  name_prefix             = local.name_prefix
  tags                    = local.common_tags
}

# Cross-region RDS read replica
module "rds_dr" {
  source = "./modules/rds"
  providers = {
    aws = aws.dr
  }
  
  environment              = var.environment
  vpc_id                  = module.vpc_dr.vpc_id
  private_subnet_ids      = module.vpc_dr.private_subnet_ids
  instance_class          = var.db_instance_class
  source_db_instance_arn  = module.rds.db_instance_arn
  is_replica              = true
  name_prefix             = "${local.name_prefix}-dr"
  tags                    = merge(local.common_tags, { Type = "disaster-recovery" })
}

# ElastiCache Redis cluster
module "redis" {
  source = "./modules/redis"
  
  environment         = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_type          = var.redis_node_type
  name_prefix        = local.name_prefix
  tags               = local.common_tags
}

# DR region Redis cluster
module "redis_dr" {
  source = "./modules/redis"
  providers = {
    aws = aws.dr
  }
  
  environment         = var.environment
  vpc_id             = module.vpc_dr.vpc_id
  private_subnet_ids = module.vpc_dr.private_subnet_ids
  node_type          = var.redis_node_type
  name_prefix        = "${local.name_prefix}-dr"
  tags               = merge(local.common_tags, { Type = "disaster-recovery" })
}

# Route 53 DNS configuration with failover
module "dns" {
  source = "./modules/dns"
  
  environment      = var.environment
  primary_alb_dns = module.ecs.alb_dns_name
  dr_alb_dns      = module.ecs_dr.alb_dns_name
  certificate_arn = var.certificate_arn
  name_prefix     = local.name_prefix
  tags            = local.common_tags
}

# CloudWatch monitoring and alarms
module "monitoring" {
  source = "./modules/monitoring"
  
  environment     = var.environment
  alarm_email    = var.alarm_email
  cluster_name   = module.ecs.cluster_name
  db_identifier = module.rds.db_identifier
  name_prefix    = local.name_prefix
  tags           = local.common_tags
}

# Outputs for other configurations to consume
output "vpc_id" {
  value = module.vpc.vpc_id
  description = "ID of the primary region VPC"
}

output "private_subnet_ids" {
  value = module.vpc.private_subnet_ids
  description = "IDs of private subnets in primary region"
}

output "ecs_cluster_id" {
  value = module.ecs.cluster_id
  description = "ID of the primary ECS cluster"
}

output "db_endpoint" {
  value = module.rds.db_endpoint
  description = "Endpoint of the primary RDS instance"
  sensitive = true
}

output "redis_endpoint" {
  value = module.redis.endpoint
  description = "Endpoint of the primary Redis cluster"
  sensitive = true
}

output "dr_vpc_id" {
  value = module.vpc_dr.vpc_id
  description = "ID of the DR region VPC"
}

output "dr_ecs_cluster_id" {
  value = module.ecs_dr.cluster_id
  description = "ID of the DR ECS cluster"
}