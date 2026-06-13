import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AcmStack } from "../lib/acm-stack";
import { StaticSite } from "../lib/static-site";
import { domainConfig } from "../config";

const app = new cdk.App();

const envName = app.node.tryGetContext("env") as string | undefined;
const envs = app.node.tryGetContext("envs") as Record<
  string,
  { subdomain: string; type: string }
>;

if (!envName || !envs[envName]) {
  const valid = Object.keys(envs).join(", ");
  throw new Error(`"-c env=<name>" is required. Valid values: ${valid}`);
}

const envConfig = envs[envName];
const baseBucketName = app.node.tryGetContext("bucketName") as string;
const accountId = app.node.tryGetContext("accountId") as string;

const acmStack = new AcmStack(app, "SpeedioAcmStack", {
  domain: domainConfig.domain,
  hostedZoneId: domainConfig.hostedZoneId,
  subjectAlternativeNames: [
    `speedio.${domainConfig.domain}`,
    `*.speedio.${domainConfig.domain}`,
  ],
  env: { region: "us-east-1" },
  crossRegionReferences: true,
});

const stack = new cdk.Stack(app, `Speedio-${envName}`, {
  env: { region: "ap-northeast-1" },
  crossRegionReferences: true,
});

new StaticSite(stack, "Site", {
  domain: domainConfig.domain,
  subdomain: envConfig.subdomain,
  hostedZoneId: domainConfig.hostedZoneId,
  certificate: acmStack.certificate,
  bucketName: `${baseBucketName}-${envName}-${accountId}`,
  spaFallbackPath:
    envConfig.type === "site" ? "/app/index.html" : undefined,
});
