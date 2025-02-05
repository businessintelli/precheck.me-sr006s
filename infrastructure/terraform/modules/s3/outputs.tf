# Output definitions for the S3 storage module
# Provider: hashicorp/terraform >= 1.6.0

output "bucket_id" {
  description = "The unique identifier of the S3 bucket used for document storage"
  value       = aws_s3_bucket.documents.id
}

output "bucket_arn" {
  description = "The ARN of the S3 bucket for use in IAM policies and resource references"
  value       = aws_s3_bucket.documents.arn
}

output "bucket_name" {
  description = "The name of the S3 bucket for use in application configurations"
  value       = aws_s3_bucket.documents.bucket
}

output "versioning_status" {
  description = "The current versioning status of the S3 bucket (Enabled/Disabled)"
  value       = aws_s3_bucket_versioning.documents.versioning_configuration[0].status
}

output "bucket_domain_name" {
  description = "The bucket domain name for use with S3 endpoints"
  value       = aws_s3_bucket.documents.bucket_domain_name
}

output "bucket_regional_domain_name" {
  description = "The regional domain name of the S3 bucket"
  value       = aws_s3_bucket.documents.bucket_regional_domain_name
}

output "bucket_acceleration_status" {
  description = "The transfer acceleration status of the S3 bucket"
  value       = aws_s3_bucket.documents.acceleration_status
}

output "bucket_region" {
  description = "The AWS region where the S3 bucket is located"
  value       = aws_s3_bucket.documents.region
}

output "bucket_tags" {
  description = "The tags assigned to the S3 bucket"
  value       = aws_s3_bucket.documents.tags_all
}

output "bucket_policy" {
  description = "The bucket policy JSON document"
  value       = aws_s3_bucket.documents.policy
}