# CloudFront is the site's front door. It routes each path the way OpenNext
# lays the build out (.open-next/open-next.output.json):
#   /_next/image*                → image function
#   /BUILD_ID, /_next/*, public/ → S3, cached at the edge
#   everything else              → server function, never cached

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

# Every header, cookie and query string except Host, which has to be the
# function URL's own for Lambda to accept the request.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

locals {
  # public/ files by name, its folders by prefix. A new top-level file or
  # folder in public/ needs a terraform apply before it's served.
  public_paths = distinct([
    for f in fileset("${path.module}/../public", "**") :
    length(split("/", f)) > 1 ? "${split("/", f)[0]}/*" : f
  ])
  static_paths = concat(["BUILD_ID", "_next/*"], local.public_paths)

  custom_domain = var.domain_name != ""
}

resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.name}-s3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "image" {
  name                              = "${var.name}-image"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# The server function sees its own URL as Host, so pass on the one the visitor
# used. app/auth/redirects.ts and getPublicOrigin build links from it.
resource "aws_cloudfront_function" "forwarded_host" {
  name    = "${var.name}-forwarded-host"
  runtime = "cloudfront-js-2.0"
  comment = "Copies Host into x-forwarded-host"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      request.headers["x-forwarded-host"] = { value: request.headers.host.value };
      return request;
    }
  EOT
}

resource "aws_cloudfront_distribution" "site" {
  enabled         = true
  comment         = var.name
  is_ipv6_enabled = true
  http_version    = "http2and3"
  price_class     = "PriceClass_100" # edge locations in Europe and North America only
  aliases         = local.custom_domain ? [var.domain_name] : []

  origin {
    origin_id                = "assets"
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_path              = "/_assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  origin {
    origin_id   = "server"
    domain_name = split("/", aws_lambda_function_url.server.function_url)[2]

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      # The most CloudFront allows without a quota increase. /api/analyze sends
      # a blank line every 10s so a quiet stage never reaches it.
      origin_read_timeout = 60
    }
  }

  origin {
    origin_id                = "image"
    domain_name              = split("/", aws_lambda_function_url.image.function_url)[2]
    origin_access_control_id = aws_cloudfront_origin_access_control.image.id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id         = "server"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.forwarded_host.arn
    }
  }

  ordered_cache_behavior {
    path_pattern             = "_next/image*"
    target_origin_id         = "image"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  dynamic "ordered_cache_behavior" {
    for_each = local.static_paths

    content {
      path_pattern           = ordered_cache_behavior.value
      target_origin_id       = "assets"
      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD", "OPTIONS"]
      cached_methods         = ["GET", "HEAD"]
      cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
      compress               = true
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !local.custom_domain
    acm_certificate_arn            = local.custom_domain ? aws_acm_certificate_validation.site[0].certificate_arn : null
    ssl_support_method             = local.custom_domain ? "sni-only" : null
    minimum_protocol_version       = local.custom_domain ? "TLSv1.2_2021" : "TLSv1"
  }
}

# ── Custom domain (only when domain_name is set) ────────────────────────────
# The DNS record stays wherever the domain's DNS is hosted today; see the
# README for the two records to add there.

resource "aws_acm_certificate" "site" {
  count    = local.custom_domain ? 1 : 0
  provider = aws.us_east_1

  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Waits for the certificate_validation record (see outputs) to show up in DNS.
# If it isn't there within 75 minutes the apply fails; add it and apply again.
resource "aws_acm_certificate_validation" "site" {
  count    = local.custom_domain ? 1 : 0
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.site[0].arn
}
