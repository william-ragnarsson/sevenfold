import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";

/**
 * How `npx open-next build` packages the app for AWS Lambda (see infra/).
 *
 * - Streaming wrapper: `/api/analyze` sends progress line by line for minutes,
 *   so the Lambda must stream its response, not buffer it.
 * - s3-lite incremental cache: prerendered pages are read from the assets
 *   bucket. Nothing revalidates (no ISR, no revalidatePath/Tag), so the tag
 *   cache and revalidation queue are dummies and need no DynamoDB or SQS.
 */
const config = {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
      converter: "aws-apigw-v2",
      incrementalCache: "s3-lite",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
} satisfies OpenNextConfig;

export default config;
