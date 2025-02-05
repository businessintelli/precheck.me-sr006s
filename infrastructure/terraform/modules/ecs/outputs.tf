# Cluster outputs
output "cluster_id" {
  description = "The ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "The name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

# Service outputs
output "web_service_id" {
  description = "The ID of the web service running in ECS"
  value       = aws_ecs_service.web.id
}

output "worker_service_id" {
  description = "The ID of the worker service running in ECS"
  value       = aws_ecs_service.worker.id
}

output "ai_service_id" {
  description = "The ID of the AI service running in ECS"
  value       = aws_ecs_service.ai.id
}

# Service names
output "web_service_name" {
  description = "The name of the web service"
  value       = aws_ecs_service.web.name
}

output "worker_service_name" {
  description = "The name of the worker service"
  value       = aws_ecs_service.worker.name
}

output "ai_service_name" {
  description = "The name of the AI service"
  value       = aws_ecs_service.ai.name
}

# Task definition ARNs
output "web_task_definition_arn" {
  description = "The ARN of the web service task definition"
  value       = aws_ecs_task_definition.web.arn
}

output "worker_task_definition_arn" {
  description = "The ARN of the worker service task definition"
  value       = aws_ecs_task_definition.worker.arn
}

output "ai_task_definition_arn" {
  description = "The ARN of the AI service task definition"
  value       = aws_ecs_task_definition.ai.arn
}

# Task definition families
output "web_task_family" {
  description = "The family name of the web service task definition"
  value       = aws_ecs_task_definition.web.family
}

output "worker_task_family" {
  description = "The family name of the worker service task definition"
  value       = aws_ecs_task_definition.worker.family
}

output "ai_task_family" {
  description = "The family name of the AI service task definition"
  value       = aws_ecs_task_definition.ai.family
}

# Security group
output "ecs_security_group_id" {
  description = "The ID of the security group attached to ECS tasks"
  value       = aws_security_group.ecs_tasks.id
}

# CloudWatch log groups
output "cloudwatch_log_groups" {
  description = "Map of CloudWatch log group names for each service"
  value = {
    web    = aws_cloudwatch_log_group.ecs_logs["web"].name
    worker = aws_cloudwatch_log_group.ecs_logs["worker"].name
    ai     = aws_cloudwatch_log_group.ecs_logs["ai"].name
  }
}

# Auto scaling targets
output "web_autoscaling_target_id" {
  description = "The ID of the web service auto scaling target"
  value       = aws_appautoscaling_target.web.id
}

# Service discovery info
output "service_discovery_namespace" {
  description = "The service discovery namespace for ECS services"
  value       = "ecs.${var.environment}.local"
}