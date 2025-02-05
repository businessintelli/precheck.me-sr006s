# Environment Configuration
environment = "staging"
region     = "us-east-1"

# Network Configuration
vpc_cidr = "10.1.0.0/16"  # Dedicated CIDR range for staging
availability_zones = [
  "us-east-1a",
  "us-east-1b"
]

# Database Configuration
db_instance_class = "db.t3.medium"  # Right-sized for staging workload
db_multi_az = true  # Enable high availability
db_backup_retention_period = 7  # 7 days retention for staging

# Cache Configuration
redis_node_type = "cache.t3.medium"  # Optimized for staging performance
redis_num_cache_nodes = 2  # Multi-node for HA
redis_automatic_failover = true

# Container Configuration
ecs_container_insights = true  # Enable detailed monitoring
ecs_min_capacity = 2  # Minimum tasks for HA
ecs_max_capacity = 4  # Maximum tasks for controlled scaling
ecs_cpu_threshold = 70  # Scale up when CPU > 70%
ecs_memory_threshold = 80  # Scale up when Memory > 80%

# Storage Configuration
s3_versioning = true  # Enable versioning for document storage
s3_lifecycle_enabled = true  # Enable lifecycle management
s3_lifecycle_expiration = 90  # Expire old versions after 90 days

# Monitoring Configuration
cloudwatch_retention_days = 30  # Log retention period
enable_enhanced_monitoring = true  # Detailed metrics collection

# Tags for resource management
tags = {
  Environment     = "staging"
  ManagedBy      = "terraform"
  Project        = "precheck-me"
  BackupRetention = "7days"
  CostCenter     = "engineering"
  SecurityZone   = "restricted"
}

# Security Configuration
ssl_policy = "ELBSecurityPolicy-TLS-1-2-2017-01"  # Modern TLS policy
waf_enabled = true  # Enable WAF protection

# Auto-scaling Configuration
autoscaling_target_cpu = 70  # Target CPU utilization
autoscaling_target_memory = 80  # Target memory utilization
autoscaling_scale_in_cooldown = 300  # 5 minutes cooldown
autoscaling_scale_out_cooldown = 180  # 3 minutes cooldown

# Backup Configuration
backup_window = "03:00-04:00"  # Backup window during off-peak
maintenance_window = "Mon:04:00-Mon:05:00"  # Maintenance window after backup

# Performance Configuration
alb_idle_timeout = 60  # Load balancer idle timeout
connection_draining_timeout = 300  # 5 minutes for connection draining

# Cost Optimization
instance_stop_protection = false  # Allow instance stopping for cost saving
spot_enabled = false  # Use on-demand for staging reliability