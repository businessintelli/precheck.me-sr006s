# VPC Infrastructure Outputs
output "vpc_infrastructure" {
  description = "VPC infrastructure details for the Precheck.me platform"
  value = {
    vpc_id              = module.vpc_module.vpc_id
    vpc_cidr_block      = module.vpc_module.vpc_cidr
    private_subnet_ids  = module.vpc_module.private_subnet_ids
    public_subnet_ids   = module.vpc_module.public_subnet_ids
    availability_zones  = module.vpc_module.availability_zones
    nat_gateway_ids     = module.vpc_module.nat_gateway_ids
    route_table_ids     = module.vpc_module.route_table_ids
  }
  sensitive = false
}

# Network Monitoring Outputs
output "network_monitoring" {
  description = "Network monitoring configuration for the VPC"
  value = {
    flow_logs_enabled = module.vpc_module.flow_logs_enabled
    flow_logs_group   = module.vpc_module.flow_logs_group
  }
  sensitive = false
}

# ECS Cluster Outputs
output "ecs_infrastructure" {
  description = "ECS cluster and service details for the Precheck.me platform"
  value = {
    cluster_id              = module.ecs_module.cluster_id
    cluster_arn            = module.ecs_module.cluster_arn
    service_names          = module.ecs_module.service_names
    task_definition_arns   = module.ecs_module.task_definition_arns
    service_security_groups = module.ecs_module.service_security_groups
  }
  sensitive = false
}

# Database Infrastructure Outputs
output "database_infrastructure" {
  description = "RDS database infrastructure details"
  value = {
    primary_endpoint = module.rds_module.db_instance_endpoint
    replica_endpoint = module.rds_module.read_replica_endpoint
    subnet_group     = module.rds_module.db_subnet_group
    security_groups  = module.rds_module.db_security_groups
  }
  # Marking as sensitive since it contains database connection information
  sensitive = true
}

# Environment Configuration Outputs
output "environment_config" {
  description = "Environment configuration details"
  value = {
    environment = var.environment
    region      = var.region
    tags        = var.tags
  }
  sensitive = false
}

# High Availability Configuration
output "high_availability_config" {
  description = "High availability configuration details"
  value = {
    multi_az_enabled     = module.rds_module.multi_az_enabled
    read_replica_enabled = module.rds_module.read_replica_enabled
    backup_retention     = module.rds_module.backup_retention_period
  }
  sensitive = false
}

# Security Configuration
output "security_config" {
  description = "Security configuration details"
  value = {
    storage_encryption_enabled = module.rds_module.storage_encrypted
    performance_insights_enabled = module.rds_module.performance_insights_enabled
    deletion_protection = module.rds_module.deletion_protection
  }
  sensitive = false
}

# Resource ARNs
output "resource_arns" {
  description = "ARNs for major infrastructure components"
  value = {
    cluster_arn = module.ecs_module.cluster_arn
    database_arn = module.rds_module.db_instance_id
    task_roles = {
      execution_role_arn = module.ecs_module.execution_role_arn
      task_role_arn = module.ecs_module.task_role_arn
    }
  }
  sensitive = false
}

# Monitoring and Logging
output "monitoring_config" {
  description = "Monitoring and logging configuration details"
  value = {
    cloudwatch_log_groups = module.ecs_module.cloudwatch_log_groups
    performance_insights_retention = module.rds_module.performance_insights_retention_period
    monitoring_interval = module.rds_module.monitoring_interval
  }
  sensitive = false
}