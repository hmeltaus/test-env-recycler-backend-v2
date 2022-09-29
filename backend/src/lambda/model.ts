export interface AccountItem {
  id: string
}

export interface ReservationCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}

export interface ReservationResponse {
  id: string
  timestamp: number
  accountCount: number
  name: string
  ready: boolean
  accounts: ReadonlyArray<AccountItem>
  credentials?: ReservationCredentials
}
