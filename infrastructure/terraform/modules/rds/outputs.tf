# Primary RDS instance outputs
output "db_instance_endpoint" {
  description = "Primary RDS instance endpoint for application connections with writer capabilities"
  value       = aws_db_instance.primary.endpoint
}

output "db_instance_id" {
  description = "Primary RDS instance identifier for resource management and monitoring"
  value       = aws_db_instance.primary.id
}

output "db_instance_arn" {
  description = "Primary RDS instance ARN for IAM policy attachment and CloudWatch monitoring"
  value       = aws_db_instance.primary.arn
}

output "db_instance_az" {
  description = "Primary RDS instance availability zone for infrastructure planning"
  value       = aws_db_instance.primary.availability_zone
}

output "db_instance_class" {
  description = "Primary RDS instance class for capacity planning and monitoring"
  value       = aws_db_instance.primary.instance_class
}

# Read replica outputs with conditional exposure based on replica enablement
output "read_replica_endpoint" {
  description = "Read replica endpoint for read-only connections with conditional exposure"
  value       = length(aws_db_instance.replica) > 0 ? aws_db_instance.replica[0].endpoint : null
}

output "read_replica_id" {
  description = "Read replica instance identifier for resource management when replicas are enabled"
  value       = length(aws_db_instance.replica) > 0 ? aws_db_instance.replica[0].id : null
}

output "read_replica_az" {
  description = "Read replica availability zone for cross-AZ deployment validation"
  value       = length(aws_db_instance.replica) > 0 ? aws_db_instance.replica[0].availability_zone : null
}