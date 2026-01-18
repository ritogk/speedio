import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { MainStack } from '../lib/main-stack'
import { AcmStack } from '../lib/acm-stack'
import * as dotenv from 'dotenv'

dotenv.config()

// 環境変数へのアクセス
const hostedZoneId = process.env.HOST_ZONE_ID ?? ''
const subDomain = process.env.SUB_DOMAIN ?? ''
const domain = process.env.DOMAIN ?? ''

const app = new cdk.App()

const acmCdk = new AcmStack(app, 'GpsRecorderAcmStack', domain, subDomain, hostedZoneId, {
  env: { region: 'us-east-1' },
  crossRegionReferences: true
})

new MainStack(app, 'GpsRecorderMainStack', domain, subDomain, hostedZoneId, acmCdk.certificate, {
  env: {
    region: 'ap-northeast-1'
  },
  crossRegionReferences: true
})
