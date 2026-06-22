import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  aws_s3 as s3,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_route53_targets as targets,
  aws_certificatemanager as acm,
  aws_lambda as lambda,
  aws_events as events,
  aws_events_targets as eventsTargets,
} from "aws-cdk-lib";
import * as path from "path";

interface ViewerStackProps extends cdk.StackProps {
  domain: string;
  subdomain: string;
  hostedZoneId: string;
  certificateArn: string;
  bucketName: string;
}

export class ViewerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ViewerStackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "Bucket", {
      bucketName: props.bucketName,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "Certificate",
      props.certificateArn
    );

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      domainNames: [props.subdomain],
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
    });

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domain,
      }
    );

    new route53.ARecord(this, "AliasRecord", {
      zone: hostedZone,
      recordName: props.subdomain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    const scraper = new lambda.Function(this, "RoadClosureScraper", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "scrape.lambda_handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../../../pipeline/road_closure")
      ),
      memorySize: 128,
      timeout: cdk.Duration.seconds(120),
      environment: {
        S3_BUCKET: bucket.bucketName,
        S3_PREFIX: "road_closures",
      },
    });

    bucket.grantPut(scraper, "road_closures/*");

    new events.Rule(this, "RoadClosureSchedule", {
      schedule: events.Schedule.cron({ minute: "0", hour: "0" }),
      targets: [new eventsTargets.LambdaFunction(scraper)],
    });

    new cdk.CfnOutput(this, "BucketName", {
      value: bucket.bucketName,
    });
  }
}
