import {
  paginateDescribeParameters,
  ParameterMetadata,
  SSM,
} from "@aws-sdk/client-ssm"
import { AwsCleaner, CleanResult } from "./aws-cleaner"

export class SsmParameterCleaner extends AwsCleaner<SSM, ParameterMetadata> {
  static readonly resourceType = "SsmParameter"
  readonly resourceType = SsmParameterCleaner.resourceType
  readonly depends = []

  constructor(regions: string[]) {
    super((props) => new SSM(props), regions)
  }

  protected getResourcesToClean = async (
    client: SSM,
    region: string,
  ): Promise<ParameterMetadata[]> =>
    this.paginate(
      paginateDescribeParameters({ client }, {}),
      (response) => response.Parameters!,
    )

  protected cleanResource = async (
    client: SSM,
    resource: ParameterMetadata,
  ): Promise<CleanResult> =>
    client
      .deleteParameter({ Name: resource.Name })
      .then(() => ({ id: resource.Name!, status: "success" }))
}
