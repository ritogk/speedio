import * as cdk from "aws-cdk-lib";
import {
  aws_route53 as route53,
  aws_certificatemanager as acm,
} from "aws-cdk-lib";

interface AcmStackProps extends cdk.StackProps {
  domain: string;
  hostedZoneId: string;
  subjectAlternativeNames: string[];
}

export class AcmStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;

  constructor(scope: cdk.App, id: string, props: AcmStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domain,
      }
    );

    this.certificate = new acm.Certificate(this, "WildcardCertificate", {
      domainName: props.subjectAlternativeNames[0],
      subjectAlternativeNames: props.subjectAlternativeNames.slice(1),
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
  }
}
