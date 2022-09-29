import { IAM, paginateListUsers, User } from "@aws-sdk/client-iam"
import { AwsCleaner, CleanResult } from "./aws-cleaner"

export class UserCleaner extends AwsCleaner<IAM, User> {
  static readonly resourceType = "User"
  readonly resourceType = UserCleaner.resourceType
  readonly depends = []

  constructor(regions: string[]) {
    super((props) => new IAM(props), regions)
  }

  protected getResourcesToClean = async (client: IAM): Promise<User[]> =>
    this.paginate(
      paginateListUsers({ client }, {}),
      (response) => response.Users!,
    )

  protected cleanResource = async (
    client: IAM,
    resource: User,
  ): Promise<CleanResult> =>
    client
      .deleteUser({ UserName: resource.UserName })
      .then(() => ({ id: resource.UserName!, status: "success" }))
}
