terraform {
  # 1.11 is the first release whose S3 backend can lock state without DynamoDB.
  required_version = ">= 1.11"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }

  # The bucket comes from bootstrap/ and is passed in once, at init:
  #   terraform init -backend-config="bucket=<state_bucket output of bootstrap/>"
  backend "s3" {
    key          = "sevenfold/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = local.tags
  }
}

# CloudFront only takes certificates issued in us-east-1, whatever region the
# rest of the stack is in.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.tags
  }
}

locals {
  tags = {
    Project   = var.name
    ManagedBy = "terraform"
  }
}

data "aws_caller_identity" "current" {}
