# Creates the bucket that holds the main config's Terraform state. Run once,
# before anything in infra/. Its own state stays on your machine
# (bootstrap/terraform.tfstate); losing that file only means Terraform forgets
# it made the bucket, not the bucket itself.

terraform {
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = "eu-central-1"

  default_tags {
    tags = {
      Project   = "sevenfold"
      ManagedBy = "terraform"
    }
  }
}

resource "aws_s3_bucket" "state" {
  bucket_prefix = "sevenfold-tfstate-"

  # The state file is the only record of what Terraform built. Deleting it
  # would mean cleaning up every resource by hand.
  lifecycle {
    prevent_destroy = true
  }
}

# Keeps every past version of the state, so a bad apply can be rolled back.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "state_bucket" {
  description = "Pass to the main config: terraform init -backend-config=\"bucket=<this>\""
  value       = aws_s3_bucket.state.id
}
