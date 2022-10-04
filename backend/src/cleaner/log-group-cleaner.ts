import {
  CloudWatchLogs,
  LogGroup,
  paginateDescribeLogGroups,
} from "@aws-sdk/client-cloudwatch-logs"
import { AwsCleaner, CleanResult } from "./aws-cleaner"

export class LogGroupCleaner extends AwsCleaner<CloudWatchLogs, LogGroup> {
  static readonly resourceType = "LogGroup"
  readonly resourceType = LogGroupCleaner.resourceType
  readonly depends = []
  readonly excludeLogGroupsWithPrefix = "/aws/"

  constructor(regions: string[]) {
    super((props) => new CloudWatchLogs(props), regions)
  }

  protected getResourcesToClean = async (
    client: CloudWatchLogs,
    region: string,
  ): Promise<LogGroup[]> =>
    this.paginate(
      paginateDescribeLogGroups({ client }, {}),
      (response) => response.logGroups!,
    ).then((resources) =>
      resources.filter(
        (r) => !r.logGroupName!.startsWith(this.excludeLogGroupsWithPrefix),
      ),
    )

  protected cleanResource = async (
    client: CloudWatchLogs,
    resource: LogGroup,
  ): Promise<CleanResult> =>
    client
      .deleteLogGroup({ logGroupName: resource.logGroupName })
      .then(() => ({ id: resource.logGroupName!, status: "success" }))
}
