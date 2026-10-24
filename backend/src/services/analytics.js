import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index.js'

const SEGMENT = /^[a-z0-9][a-z0-9-]{0,31}$/
const ACTOR_ID = /^[A-Za-z0-9_-]{8,64}$/

export function isTrackEventKey(value) {
  if (typeof value !== 'string') return false
  const parts = value.split('.')
  return parts.length === 4 && parts.every((part) => SEGMENT.test(part))
}

export function isActorId(value) {
  return typeof value === 'string' && ACTOR_ID.test(value)
}

export async function recordTrackEvent(eventKey, actorId) {
  await getDb().query(
    `
      INSERT INTO analytics_events (id, event_key, actor_id)
      VALUES (:id, :eventKey, :actorId)
    `,
    { id: randomUUID(), eventKey, actorId },
  )
}

/**
 * Compare two click positions. People counts use each actor's latest event,
 * so one person is either show or hide, not both.
 */
export async function compareClickPreference(showEvent, hideEvent) {
  const [clickRows] = await getDb().query(
    `
      SELECT event_key AS eventKey, COUNT(*) AS clicks
      FROM analytics_events
      WHERE event_key IN (:showEvent, :hideEvent)
      GROUP BY event_key
    `,
    { showEvent, hideEvent },
  )

  const [peopleRows] = await getDb().query(
    `
      SELECT latest.event_key AS eventKey, COUNT(*) AS people
      FROM (
        SELECT actor_id, SUBSTRING_INDEX(
          GROUP_CONCAT(event_key ORDER BY created_at DESC, id DESC),
          ',',
          1
        ) AS event_key
        FROM analytics_events
        WHERE event_key IN (:showEvent, :hideEvent)
        GROUP BY actor_id
      ) latest
      GROUP BY latest.event_key
    `,
    { showEvent, hideEvent },
  )

  const clicks = Object.fromEntries(clickRows.map((row) => [row.eventKey, Number(row.clicks)]))
  const people = Object.fromEntries(peopleRows.map((row) => [row.eventKey, Number(row.people)]))
  const showPeople = people[showEvent] ?? 0
  const hidePeople = people[hideEvent] ?? 0

  return {
    showEvent,
    hideEvent,
    showClicks: clicks[showEvent] ?? 0,
    hideClicks: clicks[hideEvent] ?? 0,
    showPeople,
    hidePeople,
    defaultPosition: hidePeople > showPeople ? hideEvent.split('.')[3] : showEvent.split('.')[3],
  }
}
