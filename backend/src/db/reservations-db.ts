import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb"
import * as uuid from "uuid"
import { dynamoDb, RESERVATIONS_TABLE_NAME } from "./common"
import { Reservation } from "./model"

const get = async (id: string): Promise<Reservation | undefined> => {
  const { Item } = await dynamoDb.send(
    new GetCommand({
      Key: { id },
      TableName: RESERVATIONS_TABLE_NAME,
    }),
  )

  if (!Item) {
    return undefined
  }

  return {
    id: Item.id!,
    name: Item.name!,
    timestamp: parseInt(Item.timestamp!, 10),
    accountCount: Item.accountCount!,
  }
}

const put = async (
  timestamp: number,
  name: string,
  accountCount: number,
): Promise<Reservation> => {
  const reservation: Reservation = {
    id: uuid.v4(),
    timestamp,
    accountCount,
    name,
  }

  await dynamoDb.send(
    new PutCommand({
      Item: reservation,
      TableName: RESERVATIONS_TABLE_NAME,
    }),
  )

  return reservation
}

const remove = async (id: string): Promise<void> => {
  await dynamoDb.send(
    new DeleteCommand({
      Key: {
        id,
      },
      TableName: RESERVATIONS_TABLE_NAME,
    }),
  )
}

const list = async (): Promise<ReadonlyArray<Reservation>> => {
  const { Items = [] } = await dynamoDb.send(
    new ScanCommand({
      TableName: RESERVATIONS_TABLE_NAME,
    }),
  )

  return Items.map((item) => ({
    id: item.id!,
    name: item.name!,
    timestamp: parseInt(item.timestamp!, 10),
    accountCount: item.accountCount!,
  }))
}

export const reservationsDb = {
  get,
  put,
  remove,
  list,
}
