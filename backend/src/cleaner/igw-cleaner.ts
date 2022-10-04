import {
  EC2,
  InternetGateway,
  paginateDescribeInternetGateways,
} from "@aws-sdk/client-ec2"
import { AwsCleaner, CleanResult } from "./aws-cleaner"

export class IgwCleaner extends AwsCleaner<EC2, InternetGateway> {
  static readonly resourceType = "Igw"
  readonly resourceType = IgwCleaner.resourceType
  readonly depends = []

  constructor(regions: string[]) {
    super((props) => new EC2(props), regions)
  }

  protected getResourcesToClean = async (
    client: EC2,
    region: string,
  ): Promise<InternetGateway[]> =>
    this.paginate(
      paginateDescribeInternetGateways({ client }, {}),
      (res) => res.InternetGateways,
    )

  protected cleanResource = async (
    client: EC2,
    resource: InternetGateway,
  ): Promise<CleanResult> => {
    console.log(`About to clean IGW:\n\n${JSON.stringify(resource, null, 2)}`)

    const attached = resource.Attachments!.filter(
      (a) => a.State === "available",
    )
    if (attached.length > 0) {
      console.log(
        `Internet gateway ${resource.InternetGatewayId} has ${attached.length} attached VPCs`,
      )
      await Promise.all(
        attached.map(async (a) => {
          console.log(
            `Detach VPC ${a.VpcId} from internet gateway ${resource.InternetGatewayId}`,
          )
          return client.detachInternetGateway({
            InternetGatewayId: resource.InternetGatewayId,
            VpcId: a.VpcId,
          })
        }),
      )
      return { status: "retry", id: resource.InternetGatewayId! }
    }

    return client
      .deleteInternetGateway({
        InternetGatewayId: resource.InternetGatewayId!,
      })
      .then(() => ({ id: resource.InternetGatewayId!, status: "success" }))
  }

  protected refreshResource = async (
    client: EC2,
    resource: InternetGateway,
  ): Promise<InternetGateway | undefined> =>
    client
      .describeInternetGateways({
        InternetGatewayIds: [resource.InternetGatewayId!],
      })
      .then((res) =>
        res.InternetGateways!.length > 0 ? res.InternetGateways![0] : undefined,
      )
}
