import { ScheduledHandler } from "aws-lambda"
import { reservationsDb } from "../db/reservations-db"
import { removeReservation } from "./remove-reservation"

const reservationMaxAgeInMillis = 1000 * 60 * 20 // 20 minutes

export const handler: ScheduledHandler = async (): Promise<void> => {
  const now = Date.now()
  const reservations = await reservationsDb.list()
  const expiredReservations = reservations.filter(
    (reservation) => reservation.timestamp + reservationMaxAgeInMillis < now,
  )

  for (const reservation of expiredReservations) {
    console.log(`Expire reservation ${reservation.id}`)
    await removeReservation(reservation.id)
  }
}
