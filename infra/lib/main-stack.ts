import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  aws_s3 as s3,
  aws_s3_deployment as s3Deploy,
  aws_cloudfront as cloudfront,
  aws_route53 as route53,
  aws_certificatemanager as acm,
  aws_cloudfront_origins as cloudfront_origins,
  aws_route53_targets as route53_targets,
} from "aws-cdk-lib";

export class MainStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    domain: string,
    subDomain: string,
    hostZoneId: string,
    certificate: acm.Certificate,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    // バケット作成
    const bucket = new s3.Bucket(this, "CreateBucket", {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // CDKスタックが削除されたときにバケットを削除する（オプション）
    });

    // CloudFrontディストリビューションを作成
    const distribution2 = new cloudfront.Distribution(this, "CreateCfDist", {
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin:
          // S3 バケットへの OAC によるアクセス制御を設定
          cloudfront_origins.S3BucketOrigin.withOriginAccessControl(bucket),
        compress: true,
      },
      certificate: certificate,
      domainNames: [subDomain],
    });

    // ホストゾーンを取得
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "GetHostZone",
      {
        hostedZoneId: hostZoneId,
        zoneName: domain,
      }
    );

    // サブドメインを作成してCloudFrontに紐付け
    new route53.ARecord(this, "CreateSubdomain", {
      zone: hostedZone,
      recordName: subDomain,
      target: route53.RecordTarget.fromAlias(
        new route53_targets.CloudFrontTarget(distribution2)
      ),
    });
  }
}
