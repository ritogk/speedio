import * as cdk from "aws-cdk-lib";
import { ViewerStack } from "../lib/viewer-stack";

const app = new cdk.App();

const domain = app.node.tryGetContext("domain") as string;
const subdomain = app.node.tryGetContext("subdomain") as string;
const hostedZoneId = app.node.tryGetContext("hostedZoneId") as string;
const certificateArn = app.node.tryGetContext("certificateArn") as string;
const bucketName = app.node.tryGetContext("bucketName") as string;
const accountId = app.node.tryGetContext("accountId") as string;

new ViewerStack(app, "SpeedioOldViewer", {
  domain,
  subdomain,
  hostedZoneId,
  certificateArn,
  bucketName: `${bucketName}-${accountId}`,
  env: { region: "ap-northeast-1" },
});
