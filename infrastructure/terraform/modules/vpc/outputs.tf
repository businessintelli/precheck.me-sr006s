# Output definitions for the VPC Terraform module
# Exposes network infrastructure identifiers and configuration values

output "vpc_id" {
  description = "The ID of the VPC created for the Precheck.me platform"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "The CIDR block range assigned to the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "List of IDs for the public subnets distributed across availability zones"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of IDs for the private subnets distributed across availability zones"
  value       = aws_subnet.private[*].id
}

output "nat_gateway_ids" {
  description = "List of IDs for the NAT gateways providing internet access to private subnets"
  value       = aws_nat_gateway.main[*].id
}

output "internet_gateway_id" {
  description = "The ID of the Internet Gateway attached to the VPC"
  value       = aws_internet_gateway.main.id
}

output "availability_zones" {
  description = "List of availability zones where the VPC resources are deployed"
  value       = var.availability_zones
}

output "route_table_ids" {
  description = "Map of route table IDs for public and private subnets"
  value = {
    public  = aws_route_table.public.id
    private = aws_route_table.private[*].id
  }
}

output "flow_logs_enabled" {
  description = "Indicates whether VPC flow logs are enabled for network monitoring"
  value       = var.enable_flow_logs
}

output "flow_logs_group" {
  description = "Name of the CloudWatch Log Group for VPC flow logs if enabled"
  value       = var.enable_flow_logs ? aws_cloudwatch_log_group.flow_logs[0].name : null
}