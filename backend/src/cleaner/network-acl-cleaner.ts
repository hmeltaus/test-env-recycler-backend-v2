import {
  EC2,
  NetworkAcl,
  paginateDescribeNetworkAcls,
} from "@aws-sdk/client-ec2"
import { AwsCleaner, CleanResult } from "./aws-cleaner"

export class NetworkAclCleaner extends AwsCleaner<EC2, NetworkAcl> {
  static readonly resourceType = "NetworkAcl"
  readonly resourceType = NetworkAclCleaner.resourceType
  readonly depends = []

  constructor(regions: string[]) {
    super((props) => new EC2(props), regions)
  }

  protected getResourcesToClean = async (client: EC2): Promise<NetworkAcl[]> =>
    this.paginate(
      paginateDescribeNetworkAcls({ client }, {}),
      (response) => response.NetworkAcls!,
    ).then((acls) => acls.filter((a) => !a.IsDefault))

  protected cleanResource = async (
    client: EC2,
    resource: NetworkAcl,
  ): Promise<CleanResult> =>
    client
      .deleteNetworkAcl({ NetworkAclId: resource.NetworkAclId })
      .then(() => ({ id: resource.NetworkAclId!, status: "success" }))
}
