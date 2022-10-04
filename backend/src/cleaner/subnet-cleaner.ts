import { EC2, paginateDescribeSubnets, Subnet } from "@aws-sdk/client-ec2"
import { AwsCleaner, CleanResult } from "./aws-cleaner"
import { NetworkAclCleaner } from "./network-acl-cleaner"

export class SubnetCleaner extends AwsCleaner<EC2, Subnet> {
  static readonly resourceType = "Subnet"
  readonly resourceType = SubnetCleaner.resourceType
  readonly depends = [NetworkAclCleaner.resourceType]

  constructor(regions: string[]) {
    super((props) => new EC2(props), regions)
  }

  protected getResourcesToClean = async (
    client: EC2,
    region: string,
  ): Promise<Subnet[]> =>
    this.paginate(
      paginateDescribeSubnets({ client }, {}),
      (response) => response.Subnets!,
    )

  protected cleanResource = async (
    client: EC2,
    resource: Subnet,
  ): Promise<CleanResult> =>
    client
      .deleteSubnet({ SubnetId: resource.SubnetId })
      .then(() => ({ id: resource.SubnetId!, status: "success" }))
}
