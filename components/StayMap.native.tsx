import React, { forwardRef } from 'react';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { StayMapProps } from './StayMap.types';
export default forwardRef<MapView, StayMapProps>(function StayMap(props, ref) {
  const { latitude, longitude, radius, color, onSelect } = props;
  const coordinate = latitude != null && longitude != null ? { latitude, longitude } : null;
  return <MapView ref={ref} style={{ flex: 1 }} region={{ latitude: latitude ?? 37.5665, longitude: longitude ?? 126.978, latitudeDelta: 0.01, longitudeDelta: 0.01 }} onPress={e => onSelect(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}>
    {coordinate && <><Marker coordinate={coordinate} draggable onDragEnd={e => onSelect(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)} /><Circle center={coordinate} radius={radius} strokeColor={color} fillColor="rgba(0,122,255,0.1)" /></>}
  </MapView>;
});
