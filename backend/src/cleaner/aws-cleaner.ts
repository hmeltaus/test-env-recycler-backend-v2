import {
  fromEnv,
  fromTemporaryCredentials,
} from "@aws-sdk/credential-providers"
import { CredentialProvider, Paginator } from "@aws-sdk/types"
import { Account } from "../db/model"
import { sleep } from "../util"
import { Cleaner } from "./cleaner"

export const randomInt = (min: number, max: number): number => {
  const minC = Math.ceil(min)
  const maxF = Math.floor(max)
  return Math.floor(Math.random() * (maxF - minC + 1) + minC)
}

export interface CleanResult {
  id: string
  status: "success" | "retry" | "error"
}

export interface ClientProps {
  credentials: CredentialProvider
  region: string
}

export type ClientProvider<C> = (props: ClientProps) => C

export abstract class AwsCleaner<C, A> implements Cleaner {
  abstract readonly resourceType: string
  abstract readonly depends: string[]

  protected constructor(
    readonly clientProvider: ClientProvider<C>,
    readonly regions: string[],
  ) {
    this.clientProvider = clientProvider
    this.regions = regions
  }

  private credentialProviderForRole = async (
    iamRoleArn: string,
  ): Promise<CredentialProvider> =>
    fromTemporaryCredentials({
      masterCredentials: fromEnv(),
      params: {
        RoleSessionName: "test-env-recycler",
        RoleArn: iamRoleArn,
        DurationSeconds: 60 * 30,
      },
    })

  protected getClient = async (
    accountId: string,
    region: string,
  ): Promise<C> => {
    const credentials = await this.credentialProviderForRole(
      `arn:aws:iam::${accountId}:role/${process.env.EXECUTION_ROLE_NAME}`,
    )

    return this.clientProvider({ credentials, region })
  }

  private cleanResourceInternal = async (
    client: C,
    resource: A,
    region: string,
  ): Promise<string> => {
    console.log(
      `About to clean resource of type '${
        this.resourceType
      }' from region ${region}:\n\n${JSON.stringify(resource)}`,
    )
    const { id, status } = await this.cleanResource(client, resource)
    switch (status) {
      case "retry":
        await sleep(1000)
        const refreshed = await this.refreshResource(client, resource)
        if (!refreshed) {
          return id
        }
        return this.cleanResourceInternal(client, refreshed, region)
      case "success":
        return id
      default:
        throw new Error(
          `Unsupported result status '${status}' when cleaning resource '${id}' of type ${this.resourceType}`,
        )
    }
  }

  clean = async (account: Account): Promise<boolean> => {
    await Promise.all(
      this.regions.map(async (region) => {
        console.log(`About to clean region ${region} of account ${account.id}`)
        const client = await this.getClient(account.id, region)
        const resources = await this.getResourcesToClean(client, region)
        console.log(
          `Found ${resources.length} resources of type ${this.resourceType} from region ${region}`,
        )

        const ids = []
        for (const resource of resources) {
          const id = await this.cleanResourceInternal(client, resource, region)
          ids.push(id)
          console.log(
            `Cleaned resource ${id} of type ${this.resourceType} from region ${region}`,
          )
        }

        console.log(
          `Cleaned ${ids.length} resources of type ${this.resourceType} from region ${region}`,
        )
      }),
    )

    return true
  }

  protected abstract getResourcesToClean(
    client: C,
    region: string,
  ): Promise<A[]>

  protected abstract cleanResource(client: C, resource: A): Promise<CleanResult>

  protected refreshResource = async (
    // @ts-ignore
    client: C,
    resource: A,
  ): Promise<A | undefined> => resource

  protected paginate = async <R, T>(
    paginator: Paginator<R>,
    extract: (result: R) => T[] | undefined,
  ): Promise<T[]> => {
    const results = new Array<T>()

    for await (const page of paginator) {
      const r = extract(page) ?? []
      results.push(...r)
    }

    return results
  }
}
