export type StayMapHandle = {
  animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, duration: number) => void
}

export type StayMapProps = {
  latitude: number | null | undefined
  longitude: number | null | undefined
  radius: number
  color: string
  theme: string
  webMessage: string
  onSelect: (latitude: number, longitude: number) => void
}
