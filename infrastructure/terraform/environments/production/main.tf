# Production Environment Infrastructure Configuration
# Terraform AWS Provider v5.0
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "precheck-me-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Common tags for all resources
locals {
  common_tags = {
    Environment        = "production"
    Project           = "precheck-me"
    ManagedBy         = "terraform"
    ComplianceLevel   = "high"
    DataClassification = "sensitive"
  }
}

# Primary Region Provider
provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.common_tags
  }
}

# DR Region Provider
provider "aws" {
  alias  = "dr"
  region = var.dr_region
  default_tags {
    tags = local.common_tags
  }
}

# Primary Region VPC
module "vpc_primary" {
  source = "../../modules/vpc"
  
  vpc_cidr             = var.vpc_cidr
  environment          = "production"
  availability_zones   = var.availability_zones
  enable_nat_gateway   = true
  single_nat_gateway   = false
  enable_vpn_gateway   = true
  
  tags = merge(local.common_tags, {
    Region = var.aws_region
  })
}

# DR Region VPC
module "vpc_dr" {
  source = "../../modules/vpc"
  providers = {
    aws = aws.dr
  }
  
  vpc_cidr             = "10.1.0.0/16"
  environment          = "production-dr"
  availability_zones   = ["us-west-2a", "us-west-2b", "us-west-2c"]
  enable_nat_gateway   = true
  single_nat_gateway   = false
  enable_vpn_gateway   = true
  
  tags = merge(local.common_tags, {
    Region = var.dr_region
  })
}

# Primary Region ECS Cluster
module "ecs_cluster_primary" {
  source = "../../modules/ecs"
  
  cluster_name         = "precheck-production"
  vpc_id              = module.vpc_primary.vpc_id
  subnet_ids          = module.vpc_primary.private_subnet_ids
  min_capacity        = var.ecs_min_capacity
  max_capacity        = var.ecs_max_capacity
  instance_type       = "t3.large"
  enable_monitoring   = true
  
  tags = merge(local.common_tags, {
    Region = var.aws_region
  })
}

# DR Region ECS Cluster
module "ecs_cluster_dr" {
  source = "../../modules/ecs"
  providers = {
    aws = aws.dr
  }
  
  cluster_name         = "precheck-production-dr"
  vpc_id              = module.vpc_dr.vpc_id
  subnet_ids          = module.vpc_dr.private_subnet_ids
  min_capacity        = 2
  max_capacity        = var.ecs_max_capacity
  instance_type       = "t3.large"
  enable_monitoring   = true
  
  tags = merge(local.common_tags, {
    Region = var.dr_region
  })
}

# WAF Configuration
resource "aws_wafv2_web_acl" "main" {
  name        = "precheck-production-waf"
  description = "Production WAF rules"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "PrecheckProductionWAFMetric"
    sampled_requests_enabled  = true
  }
}

# Route 53 Health Checks
resource "aws_route53_health_check" "primary" {
  fqdn              = "api.precheck.me"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  tags = merge(local.common_tags, {
    Name = "Primary Region Health Check"
  })
}

resource "aws_route53_health_check" "dr" {
  provider          = aws.dr
  fqdn              = "api-dr.precheck.me"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  tags = merge(local.common_tags, {
    Name = "DR Region Health Check"
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  alarm_name          = "production-ecs-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = module.ecs_cluster_primary.cluster_name
  }
}

resource "aws_sns_topic" "alerts" {
  name = "precheck-production-alerts"
}

# Outputs
output "primary_vpc_id" {
  value = module.vpc_primary.vpc_id
}

output "dr_vpc_id" {
  value = module.vpc_dr.vpc_id
}

output "primary_cluster_id" {
  value = module.ecs_cluster_primary.cluster_id
}

output "dr_cluster_id" {
  value = module.ecs_cluster_dr.cluster_id
}

output "waf_web_acl_id" {
  value = aws_wafv2_web_acl.main.id
}

output "primary_health_check_id" {
  value = aws_route53_health_check.primary.id
}

output "dr_health_check_id" {
  value = aws_route53_health_check.dr.id
}