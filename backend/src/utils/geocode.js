export function formatPlaceNameFromPhoton(data) {
  const props = data?.features?.[0]?.properties
  if (!props) {
    return 'Unknown location'
  }

  const parts = [
    props.name,
    props.street,
    props.locality || props.district || props.suburb,
    props.city || props.county || props.state,
    props.state && props.city && props.state !== props.city ? props.state : null,
    props.countrycode?.toUpperCase() === 'US' ? 'USA' : props.country,
  ].filter(Boolean)

  const unique = parts.filter((part, index) => part !== parts[index - 1])
  if (unique.length > 0) {
    return unique.slice(0, 3).join(' · ')
  }

  return props.country || 'Unknown location'
}
