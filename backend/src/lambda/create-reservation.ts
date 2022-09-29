import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { reservationsDb } from "../db/reservations-db"
import { queues } from "../queue/sqs"

interface ReservationData {
  count: number
  name: string
}

const parseBody = (body: string | undefined): ReservationData | undefined => {
  if (!body) {
    return undefined
  }
  try {
    const result = JSON.parse(body) as ReservationData
    if (!result.count) {
      return undefined
    }

    if (!result.name) {
      return undefined
    }

    return result
  } catch (e) {
    return undefined
  }
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const request = parseBody(event.body)

  if (!request) {
    return {
      body: JSON.stringify({
        message: "Bad request",
      }),
      statusCode: 400,
    }
  }

  const reservation = await reservationsDb.put(
    Date.now(),
    request.name,
    request.count,
  )

  for (const i of new Array(reservation.accountCount)) {
    await queues.putToReserveAccountsQueue({ reservationId: reservation.id })
  }

  return {
    body: JSON.stringify(reservation),
    statusCode: 200,
  }
}
