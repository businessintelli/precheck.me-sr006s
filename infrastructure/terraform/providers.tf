# Configure Terraform settings and required providers
terraform {
  required_version = "~> 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary region provider configuration
provider "aws" {
  region = var.region

  # Enhanced retry configuration for API operations
  max_retries = 3

  # Assume role configuration for secure access
  assume_role {
    role_arn     = var.terraform_role_arn
    session_name = "TerraformSession-${var.environment}"
    external_id  = var.terraform_external_id
  }

  # Default tags applied to all resources
  default_tags {
    Environment = var.environment
    Project     = "precheck-me"
    ManagedBy   = "terraform"
    Owner       = "platform-team"
    Region      = var.region
  }
}

# Disaster recovery region provider configuration
provider "aws" {
  alias  = "dr"
  region = var.dr_region

  # Maintain consistent retry configuration
  max_retries = 3

  # Use same role assumption for DR region
  assume_role {
    role_arn     = var.terraform_role_arn
    session_name = "TerraformSession-${var.environment}-DR"
    external_id  = var.terraform_external_id
  }

  # Maintain consistent tagging strategy across regions
  default_tags {
    Environment = var.environment
    Project     = "precheck-me"
    ManagedBy   = "terraform"
    Owner       = "platform-team"
    Region      = var.dr_region
    Type        = "disaster-recovery"
  }
}