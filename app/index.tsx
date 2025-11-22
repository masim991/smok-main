import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'expo-router';

export default function Index() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href={{ pathname: '/(tabs)/dashboard' } as any} />;
  }

  return <Redirect href={{ pathname: '/auth/login' } as any} />;
}