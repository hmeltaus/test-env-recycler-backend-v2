import { SendMessageCommand, SQS } from "@aws-sdk/client-sqs"
import { CleanAccountItem, ReserveAccountItem } from "./model"

const sqs = new SQS({ region: process.env.AWS_REGION })

const putToReserveAccountsQueue = async (
  item: ReserveAccountItem,
  delaySeconds: number = 0,
): Promise<void> => {
  await sqs.send(
    new SendMessageCommand({
      MessageBody: JSON.stringify(item),
      QueueUrl: process.env.RESERVE_ACCOUNTS_QUEUE_URL,
      DelaySeconds: delaySeconds,
    }),
  )
}

const putToCleanAccountsQueue = async (
  item: CleanAccountItem,
): Promise<void> => {
  await sqs.send(
    new SendMessageCommand({
      MessageBody: JSON.stringify(item),
      QueueUrl: process.env.CLEAN_ACCOUNTS_QUEUE_URL,
    }),
  )
}

export const queues = {
  putToReserveAccountsQueue,
  putToCleanAccountsQueue,
}
