import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  aws_s3 as s3,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_route53_targets as targets,
  aws_certificatemanager as acm,
} from "aws-cdk-lib";

export interface StaticSiteProps {
  domain: string;
  subdomain: string;
  hostedZoneId: string;
  certificate: acm.ICertificate;
  bucketName: string;
  spaFallbackPath?: string;
}

export class StaticSite extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StaticSiteProps) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, "Bucket", {
      bucketName: props.bucketName,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const errorResponses: cloudfront.ErrorResponse[] = props.spaFallbackPath
      ? [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: props.spaFallbackPath,
            ttl: cdk.Duration.seconds(0),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: props.spaFallbackPath,
            ttl: cdk.Duration.seconds(0),
          },
        ]
      : [];

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      domainNames: [props.subdomain],
      certificate: props.certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      errorResponses,
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
        new targets.CloudFrontTarget(this.distribution)
      ),
    });

    new cdk.CfnOutput(
      cdk.Stack.of(this),
      `${id}BucketName`,
      { value: this.bucket.bucketName }
    );

    new cdk.CfnOutput(
      cdk.Stack.of(this),
      `${id}DistributionDomain`,
      { value: this.distribution.distributionDomainName }
    );
  }
}
