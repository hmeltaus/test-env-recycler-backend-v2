import { ScheduledHandler } from "aws-lambda"
import { accountsDb } from "../db/accounts-db"
import { reservationsDb } from "../db/reservations-db"
import { queues } from "../queue/sqs"

export const handler: ScheduledHandler = async (): Promise<void> => {
  const accounts = await accountsDb.listByStatus("reserved")

  const reservations = await reservationsDb.list()
  const reservationIds = new Set(reservations.map((r) => r.id))

  for (const account of accounts) {
    if (account.reservationId && !reservationIds.has(account.reservationId)) {
      console.log(`Found orphaned account ${account.id}`)
      await accountsDb.markAccountAsDirty(account.id)
      await queues.putToCleanAccountsQueue({ accountId: account.id })
    }
  }
}
