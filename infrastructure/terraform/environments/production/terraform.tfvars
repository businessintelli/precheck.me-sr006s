# Environment Configuration
environment = "production"
region = "us-east-1"
dr_region = "us-west-2"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

# Database Configuration
db_instance_class = "db.r6g.2xlarge"
backup_retention_period = 35
multi_az = true
db_backup_window = "03:00-04:00"
db_maintenance_window = "Mon:04:00-Mon:05:00"

# Cache Configuration
redis_node_type = "cache.r6g.xlarge"
num_cache_nodes = 3
redis_maintenance_window = "tue:04:00-tue:05:00"

# ECS Configuration
ecs_settings = {
  container_insights = true
  min_capacity      = 3
  max_capacity      = 10
  cpu_threshold     = 70
  memory_threshold  = 80
}

# Monitoring Configuration
monitoring_settings = {
  detailed_monitoring  = true
  log_retention_days  = 90
  alarm_evaluation_periods = 3
  alarm_period_seconds = 60
}

# Backup Configuration
backup_settings = {
  retention_period = 35
  backup_window    = "03:00-06:00"
  cross_region_backup = true
}

# Security Configuration
security_settings = {
  ssl_policy = "ELBSecurityPolicy-TLS-1-2-2017-01"
  enable_waf = true
  enable_shield = true
  enable_guardduty = true
}

# Resource Tags
tags = {
  Environment     = "production"
  Project         = "precheck-me"
  Terraform       = "true"
  BusinessUnit    = "engineering"
  CostCenter      = "prod-001"
  DataClass       = "confidential"
  Compliance      = "pci,hipaa,gdpr"
  BackupSchedule  = "daily"
  DR              = "enabled"
}

# Load Balancer Configuration
alb_settings = {
  idle_timeout = 60
  enable_http2 = true
  drop_invalid_headers = true
}

# Auto Scaling Configuration
autoscaling_settings = {
  scale_in_cooldown  = 300
  scale_out_cooldown = 180
  target_cpu_value   = 70
  target_memory_value = 80
}

# S3 Configuration
s3_settings = {
  versioning = true
  encryption = true
  lifecycle_rules_enabled = true
  replication_enabled = true
}

# CloudWatch Configuration
cloudwatch_settings = {
  metric_retention_days = 90
  dashboard_enabled = true
  detailed_monitoring = true
}

# Route53 Configuration
route53_settings = {
  health_check_interval = 30
  failover_enabled = true
  latency_routing = true
}

# WAF Configuration
waf_settings = {
  block_xff_header = true
  rate_limit = 2000
  ip_rate_limit = 2000
  geo_match_statement = ["US", "IN"]
}

# KMS Configuration
kms_settings = {
  key_rotation = true
  deletion_window = 30
}

# Performance Configuration
performance_settings = {
  connection_draining_timeout = 300
  cross_zone_load_balancing = true
  stickiness_enabled = true
}

# Compliance Configuration
compliance_settings = {
  audit_log_enabled = true
  cloudtrail_enabled = true
  config_enabled = true
}