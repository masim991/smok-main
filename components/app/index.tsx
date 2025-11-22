import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'expo-router';
import LoginScreen from '@/components/LoginScreen';

export default function Index() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <LoginScreen />;
}