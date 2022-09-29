export interface Reservation {
  id: string
  timestamp: number
  accountCount: number
  name: string
}

export type AccountStatus = "ready" | "dirty" | "reserved" | "in-cleaning"

export interface Account {
  id: string
  status: AccountStatus
  reservationId?: string
  version: string
}
