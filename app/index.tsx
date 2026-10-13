import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Loading session" /></View>;

  if (isAuthenticated) {
    return <Redirect href={{ pathname: '/(tabs)/dashboard' } as any} />;
  }

  return <Redirect href={{ pathname: '/auth/login' } as any} />;
}
