locals {
  site_origin = local.custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.site.domain_name}"

  # What .github/workflows/deploy-aws.yml reads. The NEXT_PUBLIC_ ones are baked
  # into the JavaScript at build time, so they have to exist in CI.
  github_variables = {
    AWS_ROLE_ARN                         = aws_iam_role.deploy.arn
    AWS_ASSETS_BUCKET                    = aws_s3_bucket.assets.id
    AWS_SERVER_FUNCTION                  = aws_lambda_function.server.function_name
    AWS_IMAGE_FUNCTION                   = aws_lambda_function.image.function_name
    AWS_DISTRIBUTION_ID                  = aws_cloudfront_distribution.site.id
    NEXT_PUBLIC_SUPABASE_URL             = var.supabase_url
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = var.supabase_publishable_key
    NEXT_PUBLIC_SITE_URL                 = var.site_url != "" ? var.site_url : local.site_origin
  }
}

output "site_url" {
  description = "Where the AWS copy of the site answers."
  value       = local.site_origin
}

output "cloudfront_domain" {
  description = "Point the custom domain's CNAME here."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "certificate_validation" {
  description = "DNS record that proves you own domain_name. Add it at your DNS host and leave it there: ACM renews the certificate with it."
  value = local.custom_domain ? [
    for o in aws_acm_certificate.site[0].domain_validation_options : {
      type  = o.resource_record_type
      name  = o.resource_record_name
      value = o.resource_record_value
    }
  ] : []
}

output "github_variables" {
  description = "Commands that set the deploy workflow's repository variables. Run: terraform output -raw github_variables | sh"
  value = join("\n", [
    for k, v in local.github_variables : "gh variable set ${k} --repo ${var.github_repo} --body '${v}'"
  ])
}

output "server_function_url" {
  description = "The server function's own address, bypassing CloudFront. For debugging only."
  value       = aws_lambda_function_url.server.function_url
}
