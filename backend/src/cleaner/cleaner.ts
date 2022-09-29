import { Account } from "../db/model"

export interface Cleaner {
  readonly resourceType: string
  readonly depends: string[]
  clean: (account: Account) => Promise<boolean>
}
