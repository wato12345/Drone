export function formatPlaceNameFromProps(props) {
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

export function formatPlaceNameFromPhoton(data) {
  return formatPlaceNameFromProps(data?.features?.[0]?.properties)
}

export function formatDisplayNameFromProps(props) {
  if (!props) return ''
  return [
    props.name,
    props.street,
    props.locality || props.district,
    props.city,
    props.county,
    props.state,
    props.country,
  ]
    .filter(Boolean)
    .filter((part, index, arr) => part !== arr[index - 1])
    .join(', ')
}
