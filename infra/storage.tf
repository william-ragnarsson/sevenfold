# One private bucket, two prefixes, matching what `npm run build:aws` writes:
#   _assets/  .open-next/assets: hashed JS/CSS chunks and public/, read by CloudFront
#   _cache/   .open-next/cache: prerendered pages, read by the server function
resource "aws_s3_bucket" "assets" {
  bucket_prefix = "${var.name}-assets-"

  # Everything in it is rebuilt by the next deploy, so let destroy empty it.
  force_destroy = true
}

resource "aws_s3_bucket_ownership_controls" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Only this distribution can read, and only the public half.
resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id
  policy = data.aws_iam_policy_document.assets_bucket.json

  depends_on = [aws_s3_bucket_public_access_block.assets]
}

data "aws_iam_policy_document" "assets_bucket" {
  statement {
    sid       = "CloudFrontReadsAssets"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.assets.arn}/_assets/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}
