import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { accountsDb } from "../db/accounts-db"
import { Reservation } from "../db/model"
import { reservationsDb } from "../db/reservations-db"
import { queues } from "../queue/sqs"

export const removeReservation = async (
  id: string,
): Promise<Reservation | undefined> => {
  console.log(`Remove reservation ${id}`)
  const reservation = await reservationsDb.get(id)

  if (!reservation) {
    console.log(`Reservation ${id} not found`)
    return undefined
  }

  await reservationsDb.remove(id)

  const accounts = await accountsDb.listByReservation(id)
  console.log(`Reservation ${id} has ${accounts.length} accounts`)
  await Promise.all(
    accounts.map((account) => accountsDb.markAccountAsDirty(account.id)),
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

  const reservation = await removeReservation(id)
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
