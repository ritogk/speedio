import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ユーザープールの作成
    const userPool = new cognito.UserPool(this, "SpeedioUserPool", {
      userPoolName: "speedio-user-pool",
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: false,
        requireLowercase: false,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    // クライアントアプリケーションの作成
    const userPoolClient = new cognito.UserPoolClient(
      this,
      "SpeedioUserPoolClient",
      {
        userPool,
        generateSecret: false,
        authFlows: {
          userPassword: false,
          userSrp: true,
        },
      }
    );

    // 出力
    new cdk.CfnOutput(this, "UserPool", {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "UserPoolClient", {
      value: userPoolClient.userPoolClientId,
    });
  }
}
