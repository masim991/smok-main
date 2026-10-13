// Explicit local test build flag. Production release validation rejects this flag.
export const localTestMode = process.env.EXPO_PUBLIC_LOCAL_TEST_MODE === 'true';
export const LOCAL_TEST_USER_ID = 'local-test';
export const LOCAL_BUILD_KIND = process.env.EXPO_PUBLIC_LOCAL_TEST_MODE === 'true' ? 'SMOK_LOCAL_TEST_ONLY' : 'SMOK_SERVER_BUILD';
