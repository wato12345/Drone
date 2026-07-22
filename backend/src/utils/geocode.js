export function formatPlaceNameFromPhoton(data) {
  const props = data?.features?.[0]?.properties
  if (!props) {
    return '未知位置'
  }

  const parts = [
    props.name,
    props.locality || props.district,
    props.city || props.state,
  ].filter(Boolean)

  const unique = parts.filter((part, index) => part !== parts[index - 1])
  if (unique.length > 0) {
    return unique.slice(0, 2).join(' · ')
  }

  return props.country || '未知位置'
}
