# What keeps a surprise bill from happening.
#
# The budget counts spend *before* credits, so it fires while credits are still
# paying and the real bill is $0. AWS refreshes billing data a few times a day,
# so expect alerts several hours after the spend, not the moment it happens.

resource "aws_budgets_budget" "monthly" {
  name         = "${var.name}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.kill_switch_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_types {
    include_credit = false
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = var.budget_alert_usd
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = var.kill_switch_usd
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
    subscriber_sns_topic_arns  = [aws_sns_topic.kill_switch.arn]
  }

  depends_on = [aws_sns_topic_policy.kill_switch]
}

# ── Kill switch: budget → SNS topic → function that throttles the app ───────

resource "aws_sns_topic" "kill_switch" {
  name = "${var.name}-kill-switch"
}

resource "aws_sns_topic_policy" "kill_switch" {
  arn    = aws_sns_topic.kill_switch.arn
  policy = data.aws_iam_policy_document.kill_switch_topic.json
}

data "aws_iam_policy_document" "kill_switch_topic" {
  statement {
    sid       = "BudgetsPublish"
    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.kill_switch.arn]

    principals {
      type        = "Service"
      identifiers = ["budgets.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sns_topic_subscription" "kill_switch" {
  topic_arn = aws_sns_topic.kill_switch.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.kill_switch.arn
}

data "archive_file" "kill_switch" {
  type        = "zip"
  source_file = "${path.module}/kill-switch/index.mjs"
  output_path = "${path.module}/.build/kill-switch.zip"
}

resource "aws_lambda_function" "kill_switch" {
  function_name    = "${var.name}-kill-switch"
  role             = aws_iam_role.kill_switch.arn
  runtime          = local.runtime
  architectures    = ["arm64"]
  handler          = "index.handler"
  memory_size      = 128
  timeout          = 30
  filename         = data.archive_file.kill_switch.output_path
  source_code_hash = data.archive_file.kill_switch.output_base64sha256

  environment {
    variables = {
      FUNCTION_NAMES = join(",", [aws_lambda_function.server.function_name, aws_lambda_function.image.function_name])
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.kill_switch.name
  }
}

resource "aws_lambda_permission" "kill_switch_sns" {
  statement_id  = "BudgetTopic"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.kill_switch.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.kill_switch.arn
}

resource "aws_cloudwatch_log_group" "kill_switch" {
  name              = "/aws/lambda/${var.name}-kill-switch"
  retention_in_days = 14
}

resource "aws_iam_role" "kill_switch" {
  name               = "${var.name}-kill-switch"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "kill_switch" {
  role   = aws_iam_role.kill_switch.id
  policy = data.aws_iam_policy_document.kill_switch.json
}

data "aws_iam_policy_document" "kill_switch" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.kill_switch.arn}:*"]
  }

  statement {
    sid       = "ThrottleApp"
    actions   = ["lambda:PutFunctionConcurrency"]
    resources = [aws_lambda_function.server.arn, aws_lambda_function.image.arn]
  }
}
