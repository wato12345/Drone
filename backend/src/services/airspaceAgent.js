import { moonshotChat, parseJsonContent } from './moonshot.js'

const INTENT_SYSTEM = `You are the intent recognition module in a low-altitude drone flight assistant.
Based on user input, determine intent and output JSON only:
{
  "intent": "airspace_restrictions" | "path_planning" | "weather" | "other",
  "confidence": number from 0 to 1,
  "reason": "brief English explanation"
}
Rules:
- Questions about addresses, no-fly zones, flight restrictions, airspace, whether flying is allowed, control zones, clearance, airport proximity → airspace_restrictions
- Questions about path planning, routes, how to fly there → path_planning
- Questions about weather, wind speed, visibility → weather
- Everything else → other
All string values in the JSON must be in English.`

const AIRSPACE_SYSTEM = `You are a drone airspace advisor for global locations, with strong coverage of United States FAA rules.
Given a location, describe likely airspace restrictions nearby and output JSON only:
{
  "locationName": "specific place name (neighborhood, city, state/country)",
  "canFly": true or false or null,
  "canFlyLabel": "Can fly" | "Cannot fly" | "Uncertain" | "LAANC / authorization may be required",
  "airspaceType": "e.g. Class B / Class D / Class G / Controlled / Restricted / Unknown",
  "permitRequired": true or false,
  "documents": ["required credentials / apps / authorizations"],
  "riskLevel": "Low" | "Medium" | "High" | "Unknown",
  "summary": "English summary with location-specific advice",
  "restrictions": [
    {
      "type": "no-fly zone|restricted zone|airport clearance|populated area|temporary control|national park|stadium TFR|other",
      "title": "short title",
      "description": "explanation tied to this place when possible",
      "advice": "recommended action",
      "sourceHint": "e.g. FAA Part 107 / LAANC / B4UFLY / sectional chart / local ordinance"
    }
  ],
  "checklist": ["pre-flight items to confirm"],
  "disclaimer": "Disclaimer: for reference only; verify with official sources before flight"
}
Requirements:
- Infer country/region from coordinates. For the United States, apply FAA recreational and Part 107 framework:
  controlled airspace (Class B/C/D/E), airports and heliports, LAANC / Airspace Authorization, B4UFLY / FAA app checks,
  Remote ID, National Parks / military bases / stadium TFRs, and typical city ordinances.
- Name nearby major airports or landmarks when coordinates are near known US metros (e.g. NYC/JFK/LGA/EWR, SFO/OAK, LAX, DCA/IAD/BWI, ORD/MDW, SEA, ATL, DEN, DFW, BOS).
- For non-US locations, use the relevant national rules (e.g. EASA, CAAC) instead of inventing FAA IDs.
- Be specific and actionable for the city/neighborhood. When uncertain, riskLevel "Unknown" and canFly null; do not invent precise regulation numbers.
- At least 2 restrictions and at least 3 checklist items.
- For US locations, documents should typically include items like FAA TRUST / Part 107 certificate, drone registration, Remote ID compliance, and B4UFLY or LAANC check when relevant.
All string values in the JSON must be in English.`

function buildLocationText({ lat, lng, placeName, message }) {
  const parts = []
  if (placeName) parts.push(`Place name: ${placeName}`)
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    parts.push(`Coordinates: latitude ${lat}, longitude ${lng}`)
    if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) {
      parts.push('Region hint: coordinates are within the contiguous United States — prioritize FAA / US airspace guidance.')
    }
  }
  if (message) parts.push(`User question: ${message}`)
  return parts.join('\n') || 'No specific location provided'
}

export async function recognizeIntent({ message, lat, lng, placeName }) {
  const userContent = buildLocationText({ lat, lng, placeName, message })
  const { content, model, usage } = await moonshotChat({
    messages: [
      { role: 'system', content: INTENT_SYSTEM },
      { role: 'user', content: userContent },
    ],
    temperature: 0.1,
  })
  const parsed = parseJsonContent(content)
  const intent =
    parsed?.intent === 'airspace_restrictions' ||
    parsed?.intent === 'path_planning' ||
    parsed?.intent === 'weather' ||
    parsed?.intent === 'other'
      ? parsed.intent
      : 'other'

  return {
    intent,
    confidence: Number.isFinite(Number(parsed?.confidence)) ? Number(parsed.confidence) : 0.5,
    reason: typeof parsed?.reason === 'string' ? parsed.reason : '',
    model,
    usage,
  }
}

function defaultUsDocuments() {
  return [
    'FAA TRUST or Part 107 remote pilot certificate',
    'FAA drone registration (as required)',
    'Remote ID compliance',
    'B4UFLY / LAANC airspace authorization check',
  ]
}

export async function queryAirspaceRestrictions({ message, lat, lng, placeName }) {
  const userContent = [
    buildLocationText({ lat, lng, placeName, message }),
    'Return JSON describing airspace restrictions for this location.',
  ].join('\n')

  const { content, model, usage } = await moonshotChat({
    messages: [
      { role: 'system', content: AIRSPACE_SYSTEM },
      { role: 'user', content: userContent },
    ],
    temperature: 0.2,
  })

  const parsed = parseJsonContent(content)
  const inContiguousUs =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 24 &&
    lat <= 50 &&
    lng >= -125 &&
    lng <= -66

  return {
    locationName: typeof parsed?.locationName === 'string' ? parsed.locationName : placeName ?? null,
    canFly: typeof parsed?.canFly === 'boolean' ? parsed.canFly : null,
    canFlyLabel: typeof parsed?.canFlyLabel === 'string' ? parsed.canFlyLabel : undefined,
    airspaceType: typeof parsed?.airspaceType === 'string' ? parsed.airspaceType : undefined,
    permitRequired: typeof parsed?.permitRequired === 'boolean' ? parsed.permitRequired : undefined,
    documents: Array.isArray(parsed?.documents)
      ? parsed.documents.filter((item) => typeof item === 'string' && item.trim())
      : inContiguousUs
        ? defaultUsDocuments()
        : [
            'Drone registration',
            'Pilot license/certification',
            'Local airspace authorization as required',
          ],
    riskLevel: typeof parsed?.riskLevel === 'string' ? parsed.riskLevel : 'Unknown',
    summary: typeof parsed?.summary === 'string' ? parsed.summary : '',
    restrictions: Array.isArray(parsed?.restrictions) ? parsed.restrictions : [],
    checklist: Array.isArray(parsed?.checklist) ? parsed.checklist : [],
    disclaimer:
      typeof parsed?.disclaimer === 'string'
        ? parsed.disclaimer
        : 'Results are for reference only; verify with official sources (e.g. FAA B4UFLY / LAANC) before flight',
    model,
    usage,
  }
}

/**
 * Agent entry: intent recognition, then airspace query when needed.
 */
export async function runAirspaceAgent({ message, lat, lng, placeName, forceAirspace = false }) {
  const intentResult = forceAirspace
    ? {
        intent: 'airspace_restrictions',
        confidence: 1,
        reason: 'Forced airspace restriction query',
        model: null,
        usage: null,
      }
    : await recognizeIntent({ message, lat, lng, placeName })

  if (intentResult.intent !== 'airspace_restrictions') {
    return {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      reason: intentResult.reason,
      airspace: null,
      model: intentResult.model,
    }
  }

  const airspace = await queryAirspaceRestrictions({ message, lat, lng, placeName })
  return {
    intent: 'airspace_restrictions',
    confidence: intentResult.confidence,
    reason: intentResult.reason,
    airspace,
    model: airspace.model,
  }
}
