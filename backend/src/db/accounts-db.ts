import {
  GetCommand,
  paginateScan,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb"
import { ACCOUNTS_TABLE_NAME, dynamoDb } from "./common"
import { Account, AccountStatus } from "./model"

const convertAccount = (item: any): Account => ({
  id: item.id,
  reservationId: item.reservationId,
  status: item.status,
  version: item.version,
})

const listByReservation = async (
  reservationId: string,
): Promise<ReadonlyArray<Account>> => {
  const { Items } = await dynamoDb.send(
    new QueryCommand({
      IndexName: "reservation",
      TableName: ACCOUNTS_TABLE_NAME,
      KeyConditionExpression: "reservationId = :a",
      ExpressionAttributeValues: { ":a": reservationId },
    }),
  )

  return (Items ?? []).map(convertAccount)
}

const listByStatus = async (
  status: AccountStatus,
): Promise<ReadonlyArray<Account>> => {
  const pages = paginateScan(
    { client: dynamoDb },
    { TableName: ACCOUNTS_TABLE_NAME, ConsistentRead: true },
  )

  const accounts = []
  for await (const page of pages) {
    accounts.push(...(page.Items ?? []).map(convertAccount))
  }

  return accounts.filter((a) => a.status === status)
}

const reserveAccount = async (
  accountId: string,
  reservationId: string,
  version: string,
  newVersion: string,
): Promise<boolean> => {
  const { Attributes } = await dynamoDb.send(
    new UpdateCommand({
      TableName: ACCOUNTS_TABLE_NAME,
      ReturnValues: "UPDATED_NEW",
      Key: { id: accountId },
      UpdateExpression: "SET #a = :a, #b = :b, #c = :c",
      ConditionExpression: "#d = :d AND #e = :e",
      ExpressionAttributeNames: {
        "#a": "reservationId",
        "#b": "status",
        "#c": "version",
        "#d": "status",
        "#e": "version",
      },
      ExpressionAttributeValues: {
        ":a": reservationId,
        ":b": "reserved",
        ":c": newVersion,
        ":d": "ready",
        ":e": version,
      },
    }),
  )

  return Attributes?.version !== undefined
}

const update = async (account: Account): Promise<void> => {
  await dynamoDb.send(
    new PutCommand({
      TableName: ACCOUNTS_TABLE_NAME,
      Item: account,
    }),
  )
}

const get = async (id: string): Promise<Account | undefined> => {
  const { Item } = await dynamoDb.send(
    new GetCommand({
      Key: { id },
      TableName: ACCOUNTS_TABLE_NAME,
    }),
  )

  if (!Item) {
    return undefined
  }

  return convertAccount(Item)
}

export const accountsDb = {
  get,
  listByReservation,
  listByStatus,
  reserveAccount,
  update,
}
