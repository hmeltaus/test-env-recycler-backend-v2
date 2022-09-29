import { paginateListTopics, SNS, Topic } from "@aws-sdk/client-sns"
import { AwsCleaner, CleanResult } from "./aws-cleaner"

export class SnsTopicCleaner extends AwsCleaner<SNS, Topic> {
  static readonly resourceType = "SnsTopic"
  readonly resourceType = SnsTopicCleaner.resourceType
  readonly depends = []

  constructor(regions: string[]) {
    super((props) => new SNS(props), regions)
  }

  protected getResourcesToClean = async (client: SNS): Promise<Topic[]> =>
    this.paginate(
      paginateListTopics({ client }, {}),
      (response) => response.Topics!,
    )

  protected cleanResource = async (
    client: SNS,
    resource: Topic,
  ): Promise<CleanResult> =>
    client
      .deleteTopic({ TopicArn: resource.TopicArn })
      .then(() => ({ id: resource.TopicArn!, status: "success" }))
}
