// Runs when the monthly budget passes kill_switch_usd (see guardrails.tf).
// Zero reserved concurrency means no copy of a function may run, so the site
// answers every request with an error and stops costing anything. `terraform
// apply` puts the old setting back.
import { LambdaClient, PutFunctionConcurrencyCommand } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({});

export const handler = async () => {
  for (const name of process.env.FUNCTION_NAMES.split(",")) {
    await lambda.send(new PutFunctionConcurrencyCommand({ FunctionName: name, ReservedConcurrentExecutions: 0 }));
    console.log(`Throttled ${name} to zero`);
  }
};
