import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { v4 } from "uuid"
import { accountsDb } from "../db/accounts-db"
import { Reservation } from "../db/model"
import { reservationsDb } from "../db/reservations-db"
import { queues } from "../queue/sqs"

export const removeReservation = async (
  id: string,
): Promise<Reservation | undefined> => {
  const reservation = await reservationsDb.get(id)

  if (!reservation) {
    console.log(`Reservation ${id} not found`)
    return undefined
  }

  await reservationsDb.remove(id)

  const accounts = await accountsDb.listByReservation(id)
  await Promise.all(
    accounts.map((account) =>
      accountsDb.update({
        ...account,
        reservationId: undefined,
        status: "dirty",
        version: v4(),
      }),
    ),
  )

  await Promise.all(
    accounts.map((account) =>
      queues.putToCleanAccountsQueue({ accountId: account.id }),
    ),
  )

  return reservation
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const id = event.pathParameters?.id
  if (!id) {
    return {
      body: JSON.stringify({
        message: "Not found",
      }),
      statusCode: 404,
    }
  }

  const reservation = removeReservation(id)
  if (!reservation) {
    return {
      body: JSON.stringify({ message: "Not found" }),
      statusCode: 404,
    }
  }

  return {
    body: JSON.stringify(reservation),
    statusCode: 200,
  }
}
