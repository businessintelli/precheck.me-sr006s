# AWS RDS PostgreSQL Module
# Provider version: ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# DB Subnet Group for network isolation
resource "aws_db_subnet_group" "precheck" {
  name_prefix = "${var.environment}-precheck-"
  subnet_ids  = var.database_subnet_ids
  
  tags = {
    Environment = var.environment
    Name        = "${var.environment}-precheck-db-subnet-group"
    ManagedBy   = "terraform"
    Project     = "precheck"
  }
}

# Parameter group for PostgreSQL optimization
resource "aws_db_parameter_group" "precheck" {
  family      = "postgres15"
  name_prefix = "${var.environment}-precheck-"
  
  # Performance optimization parameters
  parameter {
    name  = "max_connections"
    value = "1000"
  }
  
  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4}"
  }
  
  parameter {
    name  = "work_mem"
    value = "64MB"
  }
  
  parameter {
    name  = "maintenance_work_mem"
    value = "256MB"
  }
  
  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory*3/4}"
  }
  
  parameter {
    name  = "random_page_cost"
    value = "1.1"
  }
  
  parameter {
    name  = "checkpoint_timeout"
    value = "900"
  }
  
  tags = {
    Environment = var.environment
    Name        = "${var.environment}-precheck-db-parameter-group"
    ManagedBy   = "terraform"
    Project     = "precheck"
  }
}

# Primary RDS instance
resource "aws_db_instance" "primary" {
  identifier_prefix = "${var.environment}-precheck-"
  
  # Engine configuration
  engine         = "postgres"
  engine_version = "15.4"
  
  # Instance configuration
  instance_class        = var.instance_class
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  iops                  = 12000
  
  # Database configuration
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  
  # Network configuration
  db_subnet_group_name = aws_db_subnet_group.precheck.name
  parameter_group_name = aws_db_parameter_group.precheck.name
  multi_az            = var.multi_az
  
  # Backup configuration
  backup_retention_period = var.backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  # Security configuration
  storage_encrypted = var.storage_encrypted
  kms_key_id       = var.kms_key_id
  
  # Monitoring configuration
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_retention_period
  monitoring_interval                   = 60
  monitoring_role_arn                  = var.monitoring_role_arn
  enabled_cloudwatch_logs_exports      = ["postgresql", "upgrade"]
  
  # Protection configuration
  deletion_protection       = var.deletion_protection
  skip_final_snapshot      = false
  final_snapshot_identifier = "${var.environment}-precheck-final-snapshot"
  
  # Maintenance configuration
  auto_minor_version_upgrade = var.auto_minor_version_upgrade
  copy_tags_to_snapshot     = true
  
  tags = {
    Environment = var.environment
    Name        = "${var.environment}-precheck-primary"
    ManagedBy   = "terraform"
    Project     = "precheck"
  }
}

# Read replica instance
resource "aws_db_instance" "replica" {
  count = var.enable_read_replica ? 1 : 0
  
  identifier_prefix = "${var.environment}-precheck-replica-"
  instance_class    = var.read_replica_instance_class
  
  # Replication configuration
  replicate_source_db = aws_db_instance.primary.id
  
  # Database configuration
  parameter_group_name = aws_db_parameter_group.precheck.name
  
  # Monitoring configuration
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_retention_period
  monitoring_interval                   = 60
  monitoring_role_arn                  = var.monitoring_role_arn
  enabled_cloudwatch_logs_exports      = ["postgresql", "upgrade"]
  
  # Maintenance configuration
  auto_minor_version_upgrade = var.auto_minor_version_upgrade
  copy_tags_to_snapshot     = true
  
  tags = {
    Environment = var.environment
    Name        = "${var.environment}-precheck-replica"
    ManagedBy   = "terraform"
    Project     = "precheck"
  }
}

# Outputs
output "db_instance_endpoint" {
  description = "The connection endpoint for the primary DB instance"
  value       = aws_db_instance.primary.endpoint
}

output "read_replica_endpoint" {
  description = "The connection endpoint for the read replica DB instance"
  value       = var.enable_read_replica ? aws_db_instance.replica[0].endpoint : null
}

output "db_instance_id" {
  description = "The ID of the primary RDS instance"
  value       = aws_db_instance.primary.id
}