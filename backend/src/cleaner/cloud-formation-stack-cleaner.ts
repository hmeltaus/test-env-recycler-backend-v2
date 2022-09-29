import {
  CloudFormation,
  paginateDescribeStacks,
  Stack,
} from "@aws-sdk/client-cloudformation"
import { AwsCleaner, CleanResult } from "./aws-cleaner"
import { IamRoleCleaner } from "./iam-role-cleaner"
import { IgwCleaner } from "./igw-cleaner"
import { LogGroupCleaner } from "./log-group-cleaner"
import { NetworkAclCleaner } from "./network-acl-cleaner"
import { RouteTableCleaner } from "./route-table-cleaner"
import { S3BucketCleaner } from "./s3-bucket-cleaner"
import { SecretCleaner } from "./secret-cleaner"
import { SubnetCleaner } from "./subnet-cleaner"
import { VpcCleaner } from "./vpc-cleaner"

export class CloudFormationStackCleaner extends AwsCleaner<
  CloudFormation,
  Stack
> {
  static readonly resourceType = "CloudFormationStack"
  readonly resourceType = CloudFormationStackCleaner.resourceType
  readonly depends = [
    LogGroupCleaner.resourceType,
    VpcCleaner.resourceType,
    IgwCleaner.resourceType,
    NetworkAclCleaner.resourceType,
    SubnetCleaner.resourceType,
    RouteTableCleaner.resourceType,
    S3BucketCleaner.resourceType,
    IamRoleCleaner.resourceType,
    SecretCleaner.resourceType,
  ]

  constructor(regions: string[]) {
    super((props) => new CloudFormation(props), regions)
  }

  protected getResourcesToClean = async (
    client: CloudFormation,
  ): Promise<Stack[]> =>
    this.paginate(
      paginateDescribeStacks({ client }, {}),
      (response) => response.Stacks!,
    )

  protected cleanResource = async (
    client: CloudFormation,
    resource: Stack,
  ): Promise<CleanResult> =>
    client
      .updateTerminationProtection({
        StackName: resource.StackId!,
        EnableTerminationProtection: false,
      })
      .then(() =>
        client
          .deleteStack({ StackName: resource.StackId! })
          .then(() => ({ id: resource.StackId!, status: "success" })),
      )
}
