import {
  EC2,
  paginateDescribeRouteTables,
  RouteTable,
} from "@aws-sdk/client-ec2"
import { AwsCleaner, CleanResult } from "./aws-cleaner"
import { SubnetCleaner } from "./subnet-cleaner"

export class RouteTableCleaner extends AwsCleaner<EC2, RouteTable> {
  static readonly resourceType = "RouteTable"
  readonly resourceType = RouteTableCleaner.resourceType
  readonly depends = [SubnetCleaner.resourceType]

  constructor(regions: string[]) {
    super((props) => new EC2(props), regions)
  }

  protected getResourcesToClean = async (client: EC2): Promise<RouteTable[]> =>
    this.paginate(
      paginateDescribeRouteTables({ client }, {}),
      (response) => response.RouteTables!,
    )

  protected cleanResource = async (
    client: EC2,
    resource: RouteTable,
  ): Promise<CleanResult> =>
    client
      .deleteRouteTable({ RouteTableId: resource.RouteTableId })
      .then(() => ({ id: resource.RouteTableId!, status: "success" }))
}
