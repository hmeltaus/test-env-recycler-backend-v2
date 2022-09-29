import { EC2, paginateDescribeVpcs, Vpc } from "@aws-sdk/client-ec2"
import { AwsCleaner, CleanResult } from "./aws-cleaner"
import { SecurityGroupCleaner } from "./security-group-cleaner"
import { SubnetCleaner } from "./subnet-cleaner"

export class VpcCleaner extends AwsCleaner<EC2, Vpc> {
  static readonly resourceType = "Vpc"
  readonly resourceType = VpcCleaner.resourceType
  readonly depends = [
    SubnetCleaner.resourceType,
    SecurityGroupCleaner.resourceType,
  ]

  constructor(regions: string[]) {
    super((props) => new EC2(props), regions)
  }

  protected getResourcesToClean = async (client: EC2): Promise<Vpc[]> =>
    this.paginate(
      paginateDescribeVpcs({ client }, {}),
      (response) => response.Vpcs!,
    )

  protected cleanResource = async (
    client: EC2,
    resource: Vpc,
  ): Promise<CleanResult> =>
    client
      .deleteVpc({ VpcId: resource.VpcId })
      .then(() => ({ id: resource.VpcId!, status: "success" }))
}
