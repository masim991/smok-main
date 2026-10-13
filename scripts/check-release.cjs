const fs = require('node:fs');
const config = JSON.parse(fs.readFileSync('app.json','utf8')).expo;
const errors=[];
if (process.env.EXPO_PUBLIC_LOCAL_TEST_MODE === 'true') errors.push('로컬 테스트 모드는 출시 빌드에 사용할 수 없습니다.');
for (const [label,value] of [['Android package', config.android.package], ['iOS bundle ID',config.ios.bundleIdentifier], ['URL scheme',config.scheme]]) {
  if (!value || /anonymous|bolt|myapp|example/.test(value)) errors.push(`${label}: 출시용 식별자를 확정해야 합니다.`);
}
for (const key of ['EXPO_PUBLIC_PRIVACY_POLICY_URL','EXPO_PUBLIC_ACCOUNT_DELETION_URL']) {
  if (!/^https:\/\/[^\s]+$/.test(process.env[key] || '')) errors.push(`${key}: 실제 공개 문서 URL이 필요합니다.`);
}
for (const key of ['SUPABASE_RLS_VERIFIED','SUPABASE_DELETE_VERIFIED','ANDROID_DEVICE_VERIFIED','IOS_DEVICE_VERIFIED','SIGNED_BUILD_VERIFIED']) {
  if (process.env[key] !== 'true') errors.push(`${key}: 실제 환경 검증 증거를 확인해야 합니다.`);
}
const manifest=fs.readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
if (manifest.includes('android:allowBackup="true"')) errors.push('Android 개인정보 백업이 활성화돼 있습니다.');
const gradle=fs.readFileSync('android/app/build.gradle','utf8');
if (/release\s*\{[^}]*signingConfig signingConfigs\.debug/.test(gradle)) errors.push('출시 빌드가 debug 서명을 사용합니다.');
try { const report=JSON.parse(fs.readFileSync('audit-report.json','utf8')); if(report.metadata.vulnerabilities.high || report.metadata.vulnerabilities.critical) errors.push('의존성 high/critical 취약점 검토와 해결이 남아 있습니다.'); }
catch { errors.push('최신 audit-report.json을 생성해 의존성을 확인해야 합니다.'); }
if(errors.length){ console.error('출시 준비 확인 실패:\n'+errors.map(x=>' - '+x).join('\n'));process.exitCode=1; }
else console.log('설정 검증 통과. 이 결과는 실기기/서버 검증 자체를 대체하지 않습니다.');
