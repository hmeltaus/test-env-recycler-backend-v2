import { ScheduledHandler } from "aws-lambda"
import { RESERVATION_MAX_AGE_IN_MILLIS } from "../contants"
import { reservationsDb } from "../db/reservations-db"
import { removeReservation } from "./remove-reservation"

export const handler: ScheduledHandler = async (): Promise<void> => {
  const now = Date.now()
  const reservations = await reservationsDb.list()
  const expiredReservations = reservations.filter(
    (reservation) =>
      reservation.timestamp + RESERVATION_MAX_AGE_IN_MILLIS < now,
  )

  for (const reservation of expiredReservations) {
    console.log(`Expire reservation ${reservation.id}`)
    await removeReservation(reservation.id)
  }
}
