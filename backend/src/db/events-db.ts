import { PutCommand } from "@aws-sdk/lib-dynamodb"
import { dynamoDb, EVENTS_TABLE_NAME } from "./common"

interface PutProps {
  accountId: string
  message: string
}

const eventTimeToLiveInSeconds = 60 * 60 * 24 // 24 hours

const put = async (props: PutProps): Promise<void> => {
  const now = Date.now()
  await dynamoDb.send(
    new PutCommand({
      TableName: EVENTS_TABLE_NAME,
      Item: {
        ...props,
        timestamp: now,
        ttl: Math.floor(now / 1000) + eventTimeToLiveInSeconds,
      },
    }),
  )
}

export const eventsDb = {
  put,
}
