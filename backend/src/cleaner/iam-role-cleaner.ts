import { IAM, paginateListRoles, Role } from "@aws-sdk/client-iam"
import { AwsCleaner, CleanResult } from "./aws-cleaner"

export class IamRoleCleaner extends AwsCleaner<IAM, Role> {
  static readonly resourceType = "IamRole"
  readonly resourceType = IamRoleCleaner.resourceType
  readonly depends = []

  constructor(regions: string[]) {
    super((props) => new IAM(props), regions)
  }

  protected getResourcesToClean = async (client: IAM): Promise<Role[]> =>
    this.paginate(
      paginateListRoles({ client }, {}),
      (response) => response.Roles!,
    ).then((roles) =>
      roles.filter((role) =>
        role.Tags!.some((t) => t.Key === "test-resource" && t.Value === "true"),
      ),
    )

  protected cleanResource = async (
    client: IAM,
    resource: Role,
  ): Promise<CleanResult> =>
    client
      .deleteRole({ RoleName: resource.RoleName })
      .then(() => ({ id: resource.RoleName!, status: "success" }))
}
