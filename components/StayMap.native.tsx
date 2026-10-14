import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import MapView, { Marker, Circle, type MapPressEvent } from 'react-native-maps'
import type { StayMapHandle, StayMapProps } from './StayMap.types'

const StayMap = forwardRef<StayMapHandle, StayMapProps>(function StayMap(props, ref) {
  const mapRef = useRef<MapView | null>(null)
  useImperativeHandle(ref, () => ({
    animateToRegion: (region, duration) => mapRef.current?.animateToRegion(region, duration),
  }), [])
  return (
    <MapView
      style={{ flex: 1 }}
      ref={mapRef}
      initialRegion={{
        latitude: props.latitude ?? 37.5665,
        longitude: props.longitude ?? 126.978,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      onPress={(e: MapPressEvent) => {
        const { latitude, longitude } = e.nativeEvent.coordinate
        props.onSelect(latitude, longitude)
      }}
    >
      {props.latitude != null && props.longitude != null && <>
        <Marker
          coordinate={{ latitude: props.latitude, longitude: props.longitude }}
          draggable
          onDragEnd={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate
            props.onSelect(latitude, longitude)
          }}
        />
        <Circle
          center={{ latitude: props.latitude, longitude: props.longitude }}
          radius={props.radius}
          strokeColor={props.color}
          fillColor={props.theme === 'redMean' ? 'rgba(255,0,0,0.1)' : 'rgba(0,122,255,0.1)'}
        />
      </>}
    </MapView>
  )
})

export default StayMap
