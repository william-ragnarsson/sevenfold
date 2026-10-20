# Lets the deploy workflow on main sign in to AWS with a short-lived token
# from GitHub, so no AWS keys are stored anywhere. The role can upload code and
# files and nothing else: infrastructure changes stay a local terraform apply.

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "deploy" {
  name               = "${var.name}-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_assume.json
}

data "aws_iam_policy_document" "deploy_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only runs on main. A workflow on any other branch, or in a fork, is refused.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role_policy" "deploy" {
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid     = "UploadBuild"
    actions = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = [
      "${aws_s3_bucket.assets.arn}/_assets/*",
      "${aws_s3_bucket.assets.arn}/_cache/*",
    ]
  }

  statement {
    sid       = "CompareBuild"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.assets.arn]
  }

  statement {
    sid       = "UpdateCode"
    actions   = ["lambda:UpdateFunctionCode", "lambda:GetFunction", "lambda:GetFunctionConfiguration"]
    resources = [aws_lambda_function.server.arn, aws_lambda_function.image.arn]
  }

  statement {
    sid       = "ClearEdgeCache"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}
