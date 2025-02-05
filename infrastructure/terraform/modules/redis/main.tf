# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.0.0"
}

# Local variables for resource naming and tagging
locals {
  name_prefix = "${var.project}-${var.environment}"
  common_tags = {
    Project            = var.project
    Environment        = var.environment
    ManagedBy         = "terraform"
    Service           = "redis"
    BackupEnabled     = "true"
    EncryptionEnabled = "true"
  }
}

# KMS key for encryption at rest
resource "aws_kms_key" "redis" {
  description             = "KMS key for Redis encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-kms"
  })
}

# KMS key alias
resource "aws_kms_alias" "redis" {
  name          = "alias/${local.name_prefix}-redis"
  target_key_id = aws_kms_key.redis.key_id
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name_prefix = "${local.name_prefix}-redis-"
  description = "Security group for Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    description     = "Allow Redis traffic from application tier"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-sg"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Redis subnet group
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${local.name_prefix}-redis-subnet"
  description = "Subnet group for Redis cluster"
  subnet_ids  = var.private_subnet_ids

  tags = local.common_tags
}

# Redis parameter group
resource "aws_elasticache_parameter_group" "redis" {
  family      = "redis7"
  name        = "${local.name_prefix}-redis-params"
  description = "Custom parameter group for Redis cluster"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  tags = local.common_tags
}

# CloudWatch alarm for memory usage
resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "${local.name_prefix}-redis-memory-usage"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Redis cluster memory usage above 80%"
  alarm_actions       = var.alarm_actions

  dimensions = {
    CacheClusterId = aws_elasticache_cluster.redis.id
  }

  tags = local.common_tags
}

# Redis replication group
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = var.cluster_id
  replication_group_description = "Redis cluster for ${var.environment} environment"
  node_type                     = var.node_type
  number_cache_clusters         = var.num_cache_nodes
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  subnet_group_name           = aws_elasticache_subnet_group.redis.name
  security_group_ids          = [aws_security_group.redis.id]
  automatic_failover_enabled  = var.automatic_failover_enabled
  multi_az_enabled           = var.multi_az_enabled
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                = aws_kms_key.redis.arn
  
  auto_minor_version_upgrade = true
  maintenance_window        = "sun:05:00-sun:09:00"
  snapshot_window          = "00:00-03:00"
  snapshot_retention_limit = var.environment == "prod" ? 7 : 1

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis"
  })

  lifecycle {
    prevent_destroy = true
  }
}

# Redis event subscription
resource "aws_elasticache_event_subscription" "redis" {
  name                = "${local.name_prefix}-redis-events"
  sns_topic_arn       = var.notification_topic_arn
  source_type         = "replication-group"
  source_ids          = [aws_elasticache_replication_group.redis.id]
  event_categories    = [
    "failure",
    "maintenance",
    "recovery",
    "backup"
  ]

  tags = local.common_tags
}