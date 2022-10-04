import {
  paginateListSecrets,
  SecretListEntry,
  SecretsManager,
} from "@aws-sdk/client-secrets-manager"
import { AwsCleaner, CleanResult } from "./aws-cleaner"

export class SecretCleaner extends AwsCleaner<SecretsManager, SecretListEntry> {
  static readonly resourceType = "Secret"
  readonly resourceType = SecretCleaner.resourceType
  readonly depends = []

  constructor(regions: string[]) {
    super((props) => new SecretsManager(props), regions)
  }

  protected getResourcesToClean = async (
    client: SecretsManager,
    region: string,
  ): Promise<SecretListEntry[]> =>
    this.paginate(
      paginateListSecrets({ client }, {}),
      (response) => response.SecretList!,
    ).then((resources) =>
      resources.filter((r) =>
        r.Tags!.some((t) => t.Key === "test-resource" && t.Value === "true"),
      ),
    )

  protected cleanResource = async (
    client: SecretsManager,
    resource: SecretListEntry,
  ): Promise<CleanResult> =>
    client
      .deleteSecret({
        SecretId: resource.ARN,
        ForceDeleteWithoutRecovery: true,
      })
      .then(() => ({ id: resource.ARN!, status: "success" }))
}
