import { paginateListQueues, SQS } from "@aws-sdk/client-sqs"
import { AwsCleaner, CleanResult } from "./aws-cleaner"

export class SqsQueueCleaner extends AwsCleaner<SQS, string> {
  static readonly resourceType = "SqsQueue"
  readonly resourceType = SqsQueueCleaner.resourceType
  readonly depends = []

  constructor(regions: string[]) {
    super((props) => new SQS(props), regions)
  }

  protected getResourcesToClean = async (
    client: SQS,
    region: string,
  ): Promise<string[]> =>
    this.paginate(
      paginateListQueues({ client }, {}),
      (response) => response.QueueUrls!,
    )

  protected cleanResource = async (
    client: SQS,
    resource: string,
  ): Promise<CleanResult> =>
    client
      .deleteQueue({ QueueUrl: resource })
      .then(() => ({ id: resource, status: "success" }))
}
