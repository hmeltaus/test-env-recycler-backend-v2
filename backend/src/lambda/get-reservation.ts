import {
  fromEnv,
  fromTemporaryCredentials,
} from "@aws-sdk/credential-providers"
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { accountsDb } from "../db/accounts-db"
import { reservationsDb } from "../db/reservations-db"
import { ReservationCredentials, ReservationResponse } from "./model"

const getCredentials = async (
  ready: boolean,
): Promise<ReservationCredentials | undefined> => {
  if (!ready) {
    return undefined
  }

  const credentialsProvider = await fromTemporaryCredentials({
    masterCredentials: fromEnv(),
    params: {
      RoleSessionName: "test-env-recycler",
      RoleArn: `${process.env.EXECUTION_ROLE_ARN}`,
      DurationSeconds: 60 * 30,
    },
  })

  return credentialsProvider()
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

  const reservation = await reservationsDb.get(event.pathParameters!.id!)
  if (!reservation) {
    return {
      body: JSON.stringify({ message: "Not found" }),
      statusCode: 404,
    }
  }

  const accounts = await accountsDb.listByReservation(reservation.id)
  const ready = accounts.every((a) => a.status === "reserved")
  const credentials = await getCredentials(ready)

  const response: ReservationResponse = {
    ...reservation,
    ready,
    credentials,
    accounts: accounts.map((account) => ({ id: account.id })),
  }

  return {
    body: JSON.stringify(response),
    statusCode: 200,
  }
}
