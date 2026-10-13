if (process.env.EAS_BUILD_PROFILE === 'production' && process.env.EXPO_PUBLIC_LOCAL_TEST_MODE === 'true') {
  throw new Error('Local test mode cannot be used for production builds.');
}
