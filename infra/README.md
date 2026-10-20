# Sevenfold on AWS

A second copy of the site, running on AWS beside the Vercel one. Both deploy
from `main`, and both use the same Supabase project and API keys. Vercel stays
the real site until the custom domain is pointed here, and pointing it back is
the rollback.

## What's here

| Piece | What it does |
| --- | --- |
| **CloudFront** (`cdn.tf`) | The front door. Sends each request to the right place below, and keeps copies of static files close to visitors. |
| **Server function** (`lambda.tf`) | Every page, API route and `proxy.ts`. It streams its response, so `/api/analyze` can send progress for minutes. |
| **Image function** (`lambda.tf`) | `/_next/image`, which resizes `logo.png`. |
| **S3 bucket** (`storage.tf`) | Built JavaScript, CSS, `public/`, and prerendered pages. |
| **Budget and kill switch** (`guardrails.tf`) | Emails you at $1 of spend in a month. At $5 it switches both functions off. |
| **Deploy role** (`github.tf`) | Lets the GitHub workflow upload new code without any stored AWS keys. |

Terraform builds all of this once, from your machine. After that,
`.github/workflows/deploy-aws.yml` ships every push to `main`: it builds with
`npm run build:aws`, uploads the files, swaps in the new function code, and
clears CloudFront's cache. Changing the infrastructure itself (memory, a new
domain) is always a local `terraform apply`. CI never does it.

## What it costs

Nothing, at this site's traffic. The account is on the Free plan, which can't
be charged at all; usage comes out of its credits. Most of it is inside AWS's
always-free allowances anyway:

- **Lambda**: 1 million requests and 400,000 GB-seconds a month. One analysis
  uses about 200–300 GB-seconds, so over a thousand a month are free.
- **CloudFront**: 1 TB and 10 million requests a month.
- **S3, CloudWatch logs**: cents at most. Logs are deleted after 14 days.
- **Budgets, SNS, IAM**: free.

The budget counts spend *before* credits, so the alerts work while the real
bill is $0. Billing data lags by several hours, so an alert means "this
happened earlier today", not "this is happening now".

If the kill switch fires, the site returns errors until you run
`terraform apply` from `infra/`, which switches the functions back on.

## First-time setup

### 1. Install the tools

```bash
brew install awscli hashicorp/tap/terraform
```

(Homebrew's own `terraform` formula is stuck on an old version; the
`hashicorp/tap` one is current.)

### 2. Sign in to AWS from the terminal

Don't use the root account (the email you signed up with) day to day. In the
AWS console, go to IAM → Users → Create user. Give it console access and the
`AdministratorAccess` policy, then turn on MFA for it. Don't create access
keys for it.

Then sign in from the terminal:

```bash
aws login --region eu-central-1
```

This opens the browser. Sign in as that user and the terminal gets
credentials that expire on their own. Run it again when they do.

If Terraform says it can't find credentials, copy them into the shell first:

```bash
eval "$(aws configure export-credentials --format env)"
```

### 3. Create the state bucket

Terraform keeps a record of what it built (its "state"). This one-off step
makes a private S3 bucket to hold it:

```bash
cd infra/bootstrap
terraform init
terraform apply
```

Note the `state_bucket` it prints.

### 4. Build the stack

```bash
cd infra
terraform init -backend-config="bucket=<state_bucket from step 3>"
cp terraform.tfvars.example terraform.tfvars
```

Fill in `terraform.tfvars` from your local `.env`. It's gitignored. Then:

```bash
terraform plan
terraform apply
```

`plan` lists what will be created; `apply` asks before creating it. The
CloudFront step takes 5–10 minutes. The site then answers at the `site_url`
output, with a "Not deployed yet" error until step 6.

### 5. Give the workflow its settings

The workflow needs to know which bucket, functions and role to use. This sets
them as repository variables. It needs the GitHub CLI, signed in:

```bash
terraform output -raw github_variables | sh
```

Until these exist the workflow is skipped, so pushes to `main` stay green.

### 6. Deploy

GitHub → Actions → Deploy to AWS → Run workflow. It takes about 5 minutes.
After that, every push to `main` deploys here and to Vercel.

### 7. Allow sign-in on the new address

Supabase dashboard → Authentication → URL Configuration → Redirect URLs: add
`<site_url>/**`. Leave the Site URL alone; it stays on Vercel.

Google sign-in then works on the AWS copy. Email links (sign-up confirmation,
password reset) are built from the Site URL, so they land on Vercel until the
real domain moves here.

## Custom domain

Do this once the AWS copy has been tested on its `*.cloudfront.net` address.
The domain's DNS is at GoDaddy, so both records below go there.

1. Set `domain_name` in `terraform.tfvars`, e.g.
   `aws.vcanalyst.williamragnarsson.dev`.
2. Ask AWS for a certificate, and get the record that proves you own the
   domain:

   ```bash
   terraform apply -target='aws_acm_certificate.site[0]'
   terraform output certificate_validation
   ```

   (The same record is in the AWS console under Certificate Manager, region
   N. Virginia.)

3. At GoDaddy, add that record as a CNAME. Leave it there for good: AWS uses
   it to renew the certificate every year.
4. Run `terraform apply`. It waits until AWS sees the record, usually a few
   minutes, then puts the domain on CloudFront.
5. At GoDaddy, add a CNAME from the domain to the `cloudfront_domain` output.
6. Re-run `terraform output -raw github_variables | sh` (the site URL changed),
   then the workflow. Add `https://<domain>/**` to Supabase's Redirect URLs.

Moving the real domain later works the same way: switch its record at
GoDaddy from Vercel to CloudFront. Vercel keeps deploying, so switching the
record back undoes it.

## Good to know

- **A new top-level file or folder in `public/`** needs a `terraform apply`
  before it's served. CloudFront has a route for each one (`cdn.tf`).
- **The server function's own URL is public** (the `server_function_url`
  output). CloudFront's signed access can't pass a POST body through to it,
  which uploads and sign-in need. Anyone who finds the URL meets the same
  sign-in checks as on the site.
- **Uploads are capped at 4 MB** (`lib/upload.ts`). Lambda refuses requests
  over 6 MB, and a file grows by a third on the way in.
- **Logs**: CloudWatch → Log groups → `/aws/lambda/sevenfold-server`.

## Free credits

The account came with $100 in credits. The "Explore AWS" panel on the console
home gives $20 more for each of five tasks, up to $100. The Budgets and Lambda
tasks overlap with what's already built here. For the EC2 and RDS tasks,
delete what they create as soon as they're done.

## Before 2027-03-27

The Free plan account closes around then. Before that, either:

- **Upgrade to the Paid plan**, to keep the AWS copy. Expect well under
  $1/month with the guardrails above. Leftover credits keep paying until 12
  months after the account was opened (Billing → Credits shows the date).
- **Or tear it down** and stay on Vercel: `terraform destroy` in `infra/`.
  The state bucket in `bootstrap/` is protected from deletion on purpose;
  empty and delete it in the S3 console afterwards.
