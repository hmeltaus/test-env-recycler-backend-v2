import { DynamoDB } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb"

export const ACCOUNTS_TABLE_NAME = "test-env-accounts"
export const RESERVATIONS_TABLE_NAME = "test-env-reservations"

export const dynamoDb = DynamoDBDocument.from(
  new DynamoDB({ region: `${process.env.AWS_REGION}` }),
)
