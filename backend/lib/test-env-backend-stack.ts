import * as apigateway from "@aws-cdk/aws-apigatewayv2-alpha"
import { HttpMethod } from "@aws-cdk/aws-apigatewayv2-alpha"
import { HttpUserPoolAuthorizer } from "@aws-cdk/aws-apigatewayv2-authorizers-alpha"
import { HttpLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha"
import * as cdk from "aws-cdk-lib"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import { AttributeType, BillingMode } from "aws-cdk-lib/aws-dynamodb"
import * as events from "aws-cdk-lib/aws-events"
import * as targets from "aws-cdk-lib/aws-events-targets"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources"
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs"
import * as sqs from "aws-cdk-lib/aws-sqs"
import { Construct } from "constructs"
import * as path from "path"
import { ACCOUNTS_TABLE_NAME, RESERVATIONS_TABLE_NAME } from "../src/db/common"

export class TestEnvBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const executionRole = new iam.Role(this, "execution-role", {
      roleName: "test-env-execution-role",
      assumedBy: new iam.AccountPrincipal(this.account),
      inlinePolicies: {
        executionRole: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["sts:AssumeRole"],
              resources: ["*"],
              effect: iam.Effect.ALLOW,
            }),
          ],
        }),
      },
    })

    // 👇 create the user pool
    const userPool = new cognito.UserPool(this, "user-pool", {
      userPoolName: `test-env-user-pool`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 6,
        requireLowercase: false,
        requireDigits: false,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    })

    const userPoolClient = new cognito.UserPoolClient(this, "userpool-client", {
      userPool,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        custom: true,
        userSrp: true,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    })

    const authorizer = new HttpUserPoolAuthorizer(
      "user-pool-authorizer",
      userPool,
      {
        userPoolClients: [userPoolClient],
        identitySource: ["$request.header.Authorization"],
      },
    )

    const cleanAccountsQueue = new sqs.Queue(this, "CleanAccountsQueue", {
      visibilityTimeout: cdk.Duration.seconds(300),
      queueName: "CleanAccountsQueue",
    })

    const reserveAccountsQueue = new sqs.Queue(this, "ReserveAccountsQueue", {
      visibilityTimeout: cdk.Duration.seconds(300),
      queueName: "ReserveAccountsQueue",
    })

    const accountsTable = new dynamodb.Table(this, "accounts-table", {
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName: ACCOUNTS_TABLE_NAME,
      partitionKey: {
        type: AttributeType.STRING,
        name: "id",
      },
    })

    accountsTable.addGlobalSecondaryIndex({
      indexName: "reservation",
      partitionKey: { type: AttributeType.STRING, name: "reservationId" },
      sortKey: { type: AttributeType.STRING, name: "id" },
    })

    const reservationsTable = new dynamodb.Table(this, "reservations-table", {
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName: RESERVATIONS_TABLE_NAME,
      partitionKey: {
        type: AttributeType.STRING,
        name: "id",
      },
    })

    const createReservationFn = new NodejsFunction(this, "create-reservation", {
      functionName: "create-reservation",
      memorySize: 512,
      timeout: cdk.Duration.seconds(120),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/create-reservation.ts`),
      environment: {
        RESERVE_ACCOUNTS_QUEUE_URL: reserveAccountsQueue.queueUrl,
      },
    })

    const getReservationFn = new NodejsFunction(this, "get-reservation", {
      functionName: "get-reservation",
      memorySize: 512,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/get-reservation.ts`),
      environment: {
        EXECUTION_ROLE_ARN: executionRole.roleArn,
      },
    })

    const removeReservationFn = new NodejsFunction(this, "remove-reservation", {
      functionName: "remove-reservation",
      memorySize: 512,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/remove-reservation.ts`),
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["dynamodb:Query"],
          resources: [`${accountsTable.tableArn}/index/*`],
          effect: iam.Effect.ALLOW,
        }),
      ],
      environment: {
        CLEAN_ACCOUNTS_QUEUE_URL: cleanAccountsQueue.queueUrl,
      },
    })

    const loginFn = new NodejsFunction(this, "login", {
      functionName: "login",
      memorySize: 512,
      timeout: cdk.Duration.seconds(5),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/login.ts`),
      environment: {
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["cognito-idp:InitiateAuth"],
          resources: ["*"],
          effect: iam.Effect.ALLOW,
        }),
      ],
    })

    const reserveAccountsFn = new NodejsFunction(this, "reserve-accounts", {
      functionName: "reserve-accounts",
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/reserve-accounts.ts`),
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["dynamodb:Query"],
          resources: [`${accountsTable.tableArn}/index/*`],
          effect: iam.Effect.ALLOW,
        }),
      ],
      environment: {
        RESERVE_ACCOUNTS_QUEUE_URL: reserveAccountsQueue.queueUrl,
      },
      events: [new SqsEventSource(reserveAccountsQueue, { enabled: true })],
    })

    const cleanAccountFn = new NodejsFunction(this, "clean-account", {
      functionName: "clean-account",
      memorySize: 512,
      timeout: cdk.Duration.seconds(300),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/clean-account.ts`),
      environment: {
        EXECUTION_ROLE_NAME: "OrganizationAccountAccessRole",
      },
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["sts:AssumeRole"],
          resources: ["arn:aws:iam::*:role/OrganizationAccountAccessRole"],
          effect: iam.Effect.ALLOW,
        }),
      ],
      events: [new SqsEventSource(cleanAccountsQueue, { enabled: true })],
    })

    const removeExpiredReservationsFn = new NodejsFunction(
      this,
      "remove-expired-reservations",
      {
        functionName: "remove-expired-reservations",
        memorySize: 512,
        timeout: cdk.Duration.seconds(30),
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          `/../src/lambda/remove-expired-reservations.ts`,
        ),
        environment: {
          CLEAN_ACCOUNTS_QUEUE_URL: cleanAccountsQueue.queueUrl,
        },
        initialPolicy: [
          new iam.PolicyStatement({
            actions: ["dynamodb:Query"],
            resources: [`${accountsTable.tableArn}/index/*`],
            effect: iam.Effect.ALLOW,
          }),
        ],
      },
    )

    const handleOrphanAccountsFn = new NodejsFunction(
      this,
      "handle-orphan-accounts",
      {
        functionName: "handle-orphan-accounts",
        memorySize: 512,
        timeout: cdk.Duration.seconds(30),
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: "handler",
        entry: path.join(__dirname, `/../src/lambda/handle-orphan-accounts.ts`),
        environment: {
          CLEAN_ACCOUNTS_QUEUE_URL: cleanAccountsQueue.queueUrl,
        },
      },
    )

    const api = new apigateway.HttpApi(this, "test-env-recycler-api", {
      apiName: "Test Env Recycler",
      description: "Test Env Recycler",
    })

    api.addRoutes({
      path: "/login",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("login-integration", loginFn),
    })

    api.addRoutes({
      path: "/reservations",
      methods: [HttpMethod.POST],
      authorizer,
      integration: new HttpLambdaIntegration(
        "create-reservation-integration",
        createReservationFn,
      ),
    })

    api.addRoutes({
      path: "/reservations/{id}",
      methods: [HttpMethod.GET],
      authorizer,
      integration: new HttpLambdaIntegration(
        "get-reservation-integration",
        getReservationFn,
      ),
    })

    api.addRoutes({
      path: "/reservations/{id}",
      methods: [HttpMethod.DELETE],
      authorizer,
      integration: new HttpLambdaIntegration(
        "remove-reservation-integration",
        removeReservationFn,
      ),
    })

    reservationsTable.grantReadWriteData(createReservationFn)
    reservationsTable.grantReadWriteData(reserveAccountsFn)
    reservationsTable.grantReadWriteData(removeReservationFn)
    reservationsTable.grantReadWriteData(removeExpiredReservationsFn)
    reservationsTable.grantReadData(getReservationFn)
    reservationsTable.grantReadData(handleOrphanAccountsFn)

    accountsTable.grantReadWriteData(removeReservationFn)
    accountsTable.grantReadWriteData(createReservationFn)
    accountsTable.grantReadWriteData(reserveAccountsFn)
    accountsTable.grantReadWriteData(removeExpiredReservationsFn)
    accountsTable.grantReadWriteData(cleanAccountFn)
    accountsTable.grantReadWriteData(handleOrphanAccountsFn)
    accountsTable.grantReadData(getReservationFn)

    reserveAccountsQueue.grantSendMessages(createReservationFn)
    reserveAccountsQueue.grantConsumeMessages(reserveAccountsFn)
    reserveAccountsQueue.grantSendMessages(reserveAccountsFn)
    cleanAccountsQueue.grantSendMessages(removeExpiredReservationsFn)
    cleanAccountsQueue.grantSendMessages(removeReservationFn)
    cleanAccountsQueue.grantSendMessages(handleOrphanAccountsFn)

    executionRole.grantAssumeRole(getReservationFn.grantPrincipal)

    const removeExpiredReservationsRule = new events.Rule(
      this,
      "remove-expired-reservations-schedule-rule",
      {
        schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      },
    )

    removeExpiredReservationsRule.addTarget(
      new targets.LambdaFunction(removeExpiredReservationsFn),
    )

    const handleOrphanAccountsRule = new events.Rule(
      this,
      "handle-orphan-accounts-schedule-rule",
      {
        schedule: events.Schedule.rate(cdk.Duration.minutes(20)),
      },
    )

    handleOrphanAccountsRule.addTarget(
      new targets.LambdaFunction(handleOrphanAccountsFn),
    )

    new cdk.CfnOutput(this, "region", { value: cdk.Stack.of(this).region })
    new cdk.CfnOutput(this, "userPoolId", { value: userPool.userPoolId })
    new cdk.CfnOutput(this, "userPoolClientId", {
      value: userPoolClient.userPoolClientId,
    })
    new cdk.CfnOutput(this, "apiUrl", {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      value: api.url!,
    })
  }
}
