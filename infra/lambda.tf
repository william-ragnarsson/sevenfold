# The two functions `npm run build:aws` produces (see open-next.config.ts):
#   server  .open-next/server-functions/default: every page, API route and proxy.ts
#   image   .open-next/image-optimization-function: /_next/image
# Terraform creates them with a stub. The deploy workflow uploads the real code
# (.github/workflows/deploy-aws.yml), so code changes never need an apply.

locals {
  runtime         = "nodejs24.x"
  server_function = "${var.name}-server"
  image_function  = "${var.name}-image"
}

data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/.build/placeholder.zip"

  source {
    filename = "index.mjs"
    content  = "export const handler = async () => ({ statusCode: 503, body: \"Not deployed yet: run the Deploy to AWS workflow.\" });\n"
  }
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# ── Server ──────────────────────────────────────────────────────────────────

resource "aws_lambda_function" "server" {
  function_name = local.server_function
  role          = aws_iam_role.server.arn
  runtime       = local.runtime
  architectures = ["arm64"] # scripts/build-aws.sh keeps only onnxruntime's arm64 binary
  handler       = "index.handler"
  memory_size   = 1024
  # /api/analyze runs for up to 300s (its maxDuration), plus headroom to save the result.
  timeout                        = 330
  reserved_concurrent_executions = var.reserved_concurrency

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = merge(var.app_env, {
      NEXT_PUBLIC_SUPABASE_URL             = var.supabase_url
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = var.supabase_publishable_key
      CACHE_BUCKET_NAME                    = aws_s3_bucket.assets.id
      CACHE_BUCKET_KEY_PREFIX              = "_cache"
      CACHE_BUCKET_REGION                  = var.region
    })
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.server.name
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

# Public, unlike the image function's URL. CloudFront's signed access (OAC)
# can't carry a POST body to a function URL unless the browser itself puts the
# body's SHA-256 in an x-amz-content-sha256 header, and uploads, sign-in forms
# and MCP calls don't. Anyone who finds this URL meets the same sign-in checks
# as on the site, and the kill switch caps what they can spend.
resource "aws_lambda_function_url" "server" {
  function_name      = aws_lambda_function.server.function_name
  authorization_type = "NONE"
  invoke_mode        = "RESPONSE_STREAM" # /api/analyze streams progress for minutes
}

resource "aws_lambda_permission" "server_url" {
  statement_id           = "PublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.server.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# Function URLs created since October 2025 also need lambda:InvokeFunction.
resource "aws_lambda_permission" "server_url_invoke" {
  statement_id             = "PublicFunctionUrlInvoke"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.server.function_name
  principal                = "*"
  invoked_via_function_url = true
}

resource "aws_cloudwatch_log_group" "server" {
  name              = "/aws/lambda/${local.server_function}"
  retention_in_days = 14
}

resource "aws_iam_role" "server" {
  name               = local.server_function
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "server" {
  role   = aws_iam_role.server.id
  policy = data.aws_iam_policy_document.server.json
}

data "aws_iam_policy_document" "server" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.server.arn}:*"]
  }

  statement {
    sid       = "PageCache"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.assets.arn}/_cache/*"]
  }

  # Lets a page that isn't cached read as 404 rather than 403, which the cache
  # would log as a failure.
  statement {
    sid       = "PageCacheMisses"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.assets.arn]
  }
}

# ── Image optimizer ─────────────────────────────────────────────────────────

resource "aws_lambda_function" "image" {
  function_name                  = local.image_function
  role                           = aws_iam_role.image.arn
  runtime                        = local.runtime
  architectures                  = ["arm64"]
  handler                        = "index.handler"
  memory_size                    = 1536
  timeout                        = 30
  reserved_concurrent_executions = var.reserved_concurrency

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      BUCKET_NAME       = aws_s3_bucket.assets.id
      BUCKET_KEY_PREFIX = "_assets"
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.image.name
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

# Only CloudFront can call this one: image requests are all GETs, so signed
# access works.
resource "aws_lambda_function_url" "image" {
  function_name      = aws_lambda_function.image.function_name
  authorization_type = "AWS_IAM"
}

resource "aws_lambda_permission" "image_url" {
  statement_id           = "CloudFrontFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.image.function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.site.arn
  function_url_auth_type = "AWS_IAM"
}

resource "aws_lambda_permission" "image_url_invoke" {
  statement_id             = "CloudFrontFunctionUrlInvoke"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.image.function_name
  principal                = "cloudfront.amazonaws.com"
  source_arn               = aws_cloudfront_distribution.site.arn
  invoked_via_function_url = true
}

resource "aws_cloudwatch_log_group" "image" {
  name              = "/aws/lambda/${local.image_function}"
  retention_in_days = 14
}

resource "aws_iam_role" "image" {
  name               = local.image_function
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "image" {
  role   = aws_iam_role.image.id
  policy = data.aws_iam_policy_document.image.json
}

data "aws_iam_policy_document" "image" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.image.arn}:*"]
  }

  statement {
    sid       = "SourceImages"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.assets.arn}/_assets/*"]
  }
}
