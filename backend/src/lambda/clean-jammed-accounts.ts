import { ScheduledHandler } from "aws-lambda"
import { accountsDb } from "../db/accounts-db"
import { eventsDb } from "../db/events-db"
import { queues } from "../queue/sqs"

const maxInProgressTimeInMillis = 1000 * 60 * 30 // 60 minutes

export const handler: ScheduledHandler = async (): Promise<void> => {
  const now = Date.now()
  const accounts = await accountsDb.list()
  const jammedAccounts = accounts
    .filter((account) => account.status !== "ready")
    .filter((account) => account.updated + maxInProgressTimeInMillis < now)

  for (const account of jammedAccounts) {
    console.log(`Detected jammed account ${account.id}`)
    await Promise.all(
      accounts.map((account) => accountsDb.markAccountAsDirty(account.id)),
    )
    await Promise.all(
      accounts.map((account) =>
        eventsDb.put({
          accountId: account.id,
          message: "status changed to dirty",
        }),
      ),
    )

    await Promise.all(
      accounts.map((account) =>
        queues.putToCleanAccountsQueue({ accountId: account.id }),
      ),
    )
  }
}
