import React, { forwardRef, useImperativeHandle } from 'react'
import { View, Text } from 'react-native'
import type { StayMapHandle, StayMapProps } from './StayMap.types'

const StayMap = forwardRef<StayMapHandle, StayMapProps>(function StayMap({ webMessage }, ref) {
  useImperativeHandle(ref, () => ({ animateToRegion: () => undefined }), [])
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <Text style={{ textAlign: 'center' }}>{webMessage}</Text>
  </View>
})

export default StayMap
