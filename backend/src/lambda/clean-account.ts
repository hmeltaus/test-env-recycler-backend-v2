import {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSHandler,
  SQSRecord,
} from "aws-lambda"
import { CleanerRegistry } from "../cleaner/cleaner-registry"
import { accountsDb } from "../db/accounts-db"
import { eventsDb } from "../db/events-db"
import { CleanAccountItem } from "../queue/model"

const registry = new CleanerRegistry()

const processRecord = async (record: SQSRecord): Promise<boolean> => {
  try {
    const item = JSON.parse(record.body) as CleanAccountItem
    console.log(`Process record ${JSON.stringify(item, undefined, 2)}`)

    const account = await accountsDb.get(item.accountId)
    if (!account) {
      console.log(`Account ${item.accountId} not found -> stop processing`)
      return true
    }

    if (account.status === "ready") {
      console.log(`Account ${item.accountId} already ready -> stop processing`)
      return true
    }

    console.log(`Account ${item.accountId} found`)
    await accountsDb.markAccountAsInCleaning(account.id)
    await eventsDb.put({
      accountId: account.id,
      message: "status changed to in-cleaning",
    })

    const cleaners = await registry.getCleaners()

    let count = 1
    for (const cleaner of cleaners) {
      console.log(
        `Clean account ${account.id} resource ${count++}/${cleaners.length} ${
          cleaner.resourceType
        }`,
      )
      await cleaner.clean(account)
    }

    await accountsDb.markAccountAsReady(account.id)
    await eventsDb.put({
      accountId: account.id,
      message: "status changed to ready",
    })

    console.log(`Account ${item.accountId} cleaned`)

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
