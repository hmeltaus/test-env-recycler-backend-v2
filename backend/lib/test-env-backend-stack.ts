import * as apigateway from "@aws-cdk/aws-apigatewayv2-alpha"
import { HttpMethod } from "@aws-cdk/aws-apigatewayv2-alpha"
import { HttpJwtAuthorizer } from "@aws-cdk/aws-apigatewayv2-authorizers-alpha"
import { HttpLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha"
import * as cdk from "aws-cdk-lib"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import { AttributeType, BillingMode } from "aws-cdk-lib/aws-dynamodb"
import { PolicyStatement } from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import * as sqs from "aws-cdk-lib/aws-sqs"
import { Construct } from "constructs"
import * as path from "path"

const issuer = "https://test.us.auth0.com"

export class TestEnvBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const jwtSecret = new secretsmanager.Secret(this, "jwt-secret", {
      description: "jwt secret",
      secretName: "jwt-secret",
      generateSecretString: {},
    })

    const authorizer = new HttpJwtAuthorizer("JwtAuthorizer", issuer, {
      jwtAudience: ["3131231"],
    })

    const cleanAccountsQueue = new sqs.Queue(this, "CleanAccountsQueue", {
      visibilityTimeout: cdk.Duration.seconds(300),
      queueName: "CleanAccountsQueue",
    })

    const reserveAccountsQueue = new sqs.Queue(this, "ReserveAccountsQueue", {
      visibilityTimeout: cdk.Duration.seconds(300),
      queueName: "ReserveAccountsQueue",
    })

    const usersTable = new dynamodb.Table(this, "users-table", {
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName: "test-env-users",
      partitionKey: {
        type: AttributeType.STRING,
        name: "username",
      },
    })

    const accountsTable = new dynamodb.Table(this, "accounts-table", {
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName: "test-env-accounts",
      partitionKey: {
        type: AttributeType.STRING,
        name: "id",
      },
    })

    const reservationsTable = new dynamodb.Table(this, "reservations-table", {
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName: "test-env-reservations",
      partitionKey: {
        type: AttributeType.STRING,
        name: "id",
      },
    })

    const createReservationFn = new NodejsFunction(this, "create-reservation", {
      memorySize: 512,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/create-reservation.ts`),
    })

    const getReservationFn = new NodejsFunction(this, "get-reservation", {
      memorySize: 512,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/get-reservation.ts`),
    })

    const removeReservationFn = new NodejsFunction(this, "remove-reservation", {
      memorySize: 512,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/remove-reservation.ts`),
    })

    const loginFn = new NodejsFunction(this, "login", {
      memorySize: 512,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/login.ts`),
      initialPolicy: [
        new PolicyStatement({
          actions: ["secretsmanager:GetSecretValue"],
          resources: [jwtSecret.secretArn],
        }),
      ],
    })

    const api = new apigateway.HttpApi(this, "test-env-recycler-api", {
      apiName: "Test Env Recycler",
      description: "Test Env Recycler",
    })

    api.addRoutes({
      path: "/login",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("login-integration", loginFn),
    })
    //
    // const createReservationIntegration = new HttpLambdaIntegration(
    //   "create-reservation-integration",
    //   createReservationFn,
    // )
    //
    // const reservationsResource = api.root.addResource("reservations")
    // reservationsResource.addMethod("POST", createReservationIntegration)
    //
    // const getReservationIntegration = new HttpLambdaIntegration(
    //   getReservationFn,
    // )
    // const removeReservationIntegration = new HttpLambdaIntegration(
    //   removeReservationFn,
    // )
    //
    // const reservationResource = reservationsResource.addResource("{id}")
    // reservationResource.addMethod("GET", getReservationIntegration)
    // reservationResource.addMethod("DELETE", removeReservationIntegration, {
    //   authorizer,
    // })

    reservationsTable.grantReadWriteData(createReservationFn)
    reservationsTable.grantReadData(getReservationFn)
    reservationsTable.grantReadWriteData(removeReservationFn)

    usersTable.grantReadData(loginFn)
  }
}
