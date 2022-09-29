import {
  EC2,
  paginateDescribeSecurityGroups,
  SecurityGroup,
} from "@aws-sdk/client-ec2"
import { AwsCleaner, CleanResult } from "./aws-cleaner"

export class SecurityGroupCleaner extends AwsCleaner<EC2, SecurityGroup> {
  static readonly resourceType = "SecurityGroup"
  readonly resourceType = SecurityGroupCleaner.resourceType
  readonly depends = []

  constructor(regions: string[]) {
    super((props) => new EC2(props), regions)
  }

  protected getResourcesToClean = async (
    client: EC2,
  ): Promise<SecurityGroup[]> =>
    this.paginate(
      paginateDescribeSecurityGroups({ client }, {}),
      (response) => response.SecurityGroups!,
    ).then((resources) =>
      resources.filter(
        (r) =>
          r.GroupName !== "default" &&
          r.Description !== "default VPC security group",
      ),
    )

  protected cleanResource = async (
    client: EC2,
    resource: SecurityGroup,
  ): Promise<CleanResult> =>
    client
      .deleteSecurityGroup({ GroupId: resource.GroupId })
      .then(() => ({ id: resource.GroupId!, status: "success" }))
}
