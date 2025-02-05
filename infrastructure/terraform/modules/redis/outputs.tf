# Primary cluster endpoint for application connection
output "cluster_endpoint" {
  description = "Primary endpoint URL for Redis cluster connection"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

# Reader endpoint for read replicas in HA setup
output "reader_endpoint" {
  description = "Reader endpoint URL for Redis read replicas"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

# Configuration endpoint for cluster mode
output "configuration_endpoint" {
  description = "Configuration endpoint for Redis cluster management"
  value       = aws_elasticache_replication_group.redis.configuration_endpoint_address
}

# Port number for Redis connections
output "cluster_port" {
  description = "Port number for Redis cluster connections"
  value       = aws_elasticache_replication_group.redis.port
}

# Security group ID for network access control
output "security_group_id" {
  description = "ID of the security group controlling Redis cluster access"
  value       = aws_security_group.redis.id
}

# List of cluster nodes with their details
output "cluster_nodes" {
  description = "List of Redis cluster nodes with their configuration details"
  value = {
    cluster_id     = aws_elasticache_replication_group.redis.id
    node_type      = aws_elasticache_replication_group.redis.node_type
    num_nodes      = aws_elasticache_replication_group.redis.number_cache_clusters
    engine_version = aws_elasticache_replication_group.redis.engine_version
  }
}

# Cluster tags for resource management
output "cluster_tags" {
  description = "Map of tags applied to the Redis cluster resources"
  value       = aws_elasticache_replication_group.redis.tags
}

# Connection information for application configuration
output "connection_info" {
  description = "Connection information for Redis cluster configuration"
  value = {
    primary_endpoint = aws_elasticache_replication_group.redis.primary_endpoint_address
    reader_endpoint  = aws_elasticache_replication_group.redis.reader_endpoint_address
    port            = aws_elasticache_replication_group.redis.port
    parameter_group = aws_elasticache_replication_group.redis.parameter_group_name
    subnet_group   = aws_elasticache_replication_group.redis.subnet_group_name
  }
}

# High availability configuration details
output "ha_config" {
  description = "High availability configuration details for the Redis cluster"
  value = {
    multi_az_enabled           = aws_elasticache_replication_group.redis.multi_az_enabled
    automatic_failover_enabled = aws_elasticache_replication_group.redis.automatic_failover_enabled
    num_cache_clusters         = aws_elasticache_replication_group.redis.number_cache_clusters
  }
}

# Maintenance and backup configuration
output "maintenance_config" {
  description = "Maintenance and backup configuration for the Redis cluster"
  value = {
    maintenance_window     = aws_elasticache_replication_group.redis.maintenance_window
    snapshot_window       = aws_elasticache_replication_group.redis.snapshot_window
    snapshot_retention    = aws_elasticache_replication_group.redis.snapshot_retention_limit
    auto_minor_upgrade   = aws_elasticache_replication_group.redis.auto_minor_version_upgrade
  }
}

# Security configuration details
output "security_config" {
  description = "Security configuration details for the Redis cluster"
  value = {
    security_group_id         = aws_security_group.redis.id
    encryption_at_rest       = aws_elasticache_replication_group.redis.at_rest_encryption_enabled
    encryption_in_transit    = aws_elasticache_replication_group.redis.transit_encryption_enabled
    kms_key_id              = aws_elasticache_replication_group.redis.kms_key_id
  }
}