import { DynamoDB } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocument, GetCommand } from "@aws-sdk/lib-dynamodb"
import { User } from "../model"

const dynamoDb = DynamoDBDocument.from(
  new DynamoDB({ region: `${process.env.AWS_REGION}` }),
)

const get = async (username: string): Promise<User | undefined> => {
  const { Item } = await dynamoDb.send(
    new GetCommand({ Key: { username }, TableName: "test-env-users" }),
  )
  if (!Item) {
    return undefined
  }

  return {
    username: Item.username!,
    password: Item.password!,
  }
}

export const UserDb = {
  get,
}
