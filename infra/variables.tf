variable "region" {
  description = "Where everything but the certificate lives. eu-central-1 is the Supabase project's region, so database calls stay in-region."
  type        = string
  default     = "eu-central-1"
}

variable "name" {
  description = "Prefix for every resource name."
  type        = string
  default     = "sevenfold"
}

variable "domain_name" {
  description = "Custom domain for the site, e.g. aws.vcanalyst.williamragnarsson.dev. Leave empty to serve from the *.cloudfront.net address only."
  type        = string
  default     = ""
}

variable "alert_email" {
  description = "Where the budget emails go."
  type        = string
}

variable "budget_alert_usd" {
  description = "Monthly spend (before credits) that sends a warning email."
  type        = number
  default     = 1
}

variable "kill_switch_usd" {
  description = "Monthly spend (before credits) that takes the site offline: both app functions are throttled to zero until the next terraform apply."
  type        = number
  default     = 5
}

variable "reserved_concurrency" {
  description = "Most copies of each app function that may run at once. -1 leaves it to the account-wide limit, which is 10 on a new account; AWS refuses to reserve most of those 10 for one function."
  type        = number
  default     = -1
}

variable "github_repo" {
  description = "owner/name of the repository whose main branch may deploy."
  type        = string
  default     = "william-ragnarsson/sevenfold"
}

variable "supabase_url" {
  description = "NEXT_PUBLIC_SUPABASE_URL. Public: it ships to the browser."
  type        = string
}

variable "supabase_publishable_key" {
  description = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_…). Public: it ships to the browser."
  type        = string
}

variable "site_url" {
  description = "NEXT_PUBLIC_SITE_URL, the origin used in link previews. Defaults to this deployment's own address."
  type        = string
  default     = ""
}

variable "app_env" {
  description = "Server-only environment variables from .env.example: the API keys, SUPABASE_SERVICE_ROLE_KEY and any model or budget overrides."
  type        = map(string)
  sensitive   = true
}
