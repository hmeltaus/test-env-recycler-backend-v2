import {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSHandler,
  SQSRecord,
} from "aws-lambda"
import * as lodash from "lodash"
import { v4 } from "uuid"
import { accountsDb } from "../db/accounts-db"
import { reservationsDb } from "../db/reservations-db"
import { ReserveAccountItem } from "../queue/model"
import { queues } from "../queue/sqs"
import { randomSleep } from "../util"

const RESERVATION_MAX_AGE_IN_MILLIS = 1000 * 60 * 10 // 10 minutes

const processRecord = async (record: SQSRecord): Promise<boolean> => {
  const now = Date.now()

  try {
    const item = JSON.parse(record.body) as ReserveAccountItem
    console.log(`Process record ${JSON.stringify(item, undefined, 2)}`)

    const reservation = await reservationsDb.get(item.reservationId)
    if (!reservation) {
      console.log(
        `Reservation ${item.reservationId} not found -> stop processing`,
      )
      return true
    }

    console.log(`Reservation ${item.reservationId} found`)

    const reservedAccounts = await accountsDb.listByReservation(
      item.reservationId,
    )

    if (reservation.timestamp + RESERVATION_MAX_AGE_IN_MILLIS < now) {
      console.log(`Reservation ${reservation.id} expired`)
      await reservationsDb.remove(reservation.id)

      for (const account of reservedAccounts) {
        console.log(`Mark account ${account.id} dirty`)
        await accountsDb.update({
          id: account.id,
          status: "dirty",
          version: v4(),
        })
      }

      return true
    }

    if (reservedAccounts.length === reservation.accountCount) {
      console.log(
        `All ${reservation.accountCount} accounts successfully reserved -> stop processing`,
      )
      return true
    }

    console.log(
      `${reservedAccounts.length} of ${reservation.accountCount} accounts reserved -> attempt to reserve more`,
    )

    await randomSleep(5000)

    let accounts = await accountsDb.listByStatus("ready")

    if (accounts.length === 0) {
      console.log(`No ready accounts available`)
      await queues.putToReserveAccountsQueue(item, 10)
      return true
    }

    console.log(`Found ${accounts.length} ready accounts`)

    let toReserveCount = reservation.accountCount - reservedAccounts.length

    while (toReserveCount > 0 && accounts.length > 0) {
      const [account, ...rest] = lodash.shuffle(accounts)
      if (!account) {
        console.log("No ready accounts available")
        await queues.putToReserveAccountsQueue(item, 10)
        return true
      }

      console.log(
        `Attempt to reserve account ${account.id} for reservation ${reservation.id}`,
      )

      const success = await accountsDb.reserveAccount(
        account.id,
        reservation.id,
        account.version,
        v4(),
      )

      console.log(
        `Account ${account.id} reservation ${success ? "succeeded" : "failed"}`,
      )

      if (success) {
        toReserveCount--
      }

      await randomSleep(1000)

      accounts = rest
    }

    return true
  } catch (e) {
    console.log(`An error occurred: ${e}`)
    return false
  }
}

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const batchItemFailures = new Array<SQSBatchItemFailure>()
  for (const record of event.Records) {
    const success = await processRecord(record)
    if (!success) {
      batchItemFailures.push({
        itemIdentifier: record.messageId,
      })
    }
  }

  return {
    batchItemFailures,
  }
}
