import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MainStack } from "../lib/main-stack";
import { AcmStack } from "../lib/acm-stack";
import { domainConfig } from "../config";

const app = new cdk.App();

// CloudFrontで使用するACM証明書を作成
const acmStack = new AcmStack(
  app,
  "SpeedioAcmStack",
  domainConfig.domain,
  domainConfig.subDomain,
  domainConfig.hostedZoneId,
  {
    env: { region: "us-east-1" },
    crossRegionReferences: true,
  }
);

// スタックは可能な限りわけずにここに書く。
new MainStack(
  app,
  "SpeedioMainStack",
  domainConfig.domain,
  domainConfig.subDomain,
  domainConfig.hostedZoneId,
  acmStack.certificate,
  {
    env: {
      region: "ap-northeast-1",
    },
    crossRegionReferences: true,
  }
);
