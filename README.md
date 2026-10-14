# Smok 개발 및 검증

Expo 54 / React Native 0.81 앱입니다. Android와 iOS가 우선 대상입니다. 기준 README에는 `smok` 한 줄만 있었습니다.

## 기준선 (2026-10-14)

- 분석 기준: `336abd42e9a5b3e777faf2c7673a9c3f46e4ffa7` (작업 시작 시 원격 `main` HEAD).
- 전달된 폴더에는 `.git`이 없었습니다. 별도 복제한 기준 저장소와 추적 파일 100개를 비교했고, 줄 끝 차이를 제외하면 모두 일치했습니다. 원래 폴더의 브랜치와 커밋은 확인할 수 없어 이후 작업 추적용으로 기준 저장소의 Git 메타데이터를 복구했습니다.
- 최초 코드에는 테스트 명령, 테스트 파일, ESLint 설정 및 Supabase 스키마/RLS/Edge Function 정의가 없습니다. 서버 구조와 정책은 검증되지 않았습니다.

## 참조 관계

```mermaid
flowchart TD
  Root[app/_layout.tsx] --> Theme[contexts/ThemeContext]
  Root --> Auth[contexts/AuthContext]
  Root --> Settings[contexts/SettingsContext]
  Root --> Data[components/contexts/DataContext]
  Root --> Stay[contexts/LocationStayContext]
  Auth --> Supabase[lib/supabase.ts]
  Data --> Supabase
  Data --> Store[components/services/storage/LocalMemoryStorage.ts]
  Store --> Async[AsyncStorage]
  Data --> Notifications[components/services/notifications/LocalNotifications.ts]
  Stay --> Data
  Stay --> Location[utils/location.ts]
  Tabs[app/(tabs)/*] --> Theme
  Tabs --> Auth
  Tabs --> Settings
  Tabs --> Data
  Tabs --> Stay
  Tabs --> Detection[components/services/detection/*]
  Tabs --> Background[components/services/location/BackgroundLocation.ts]
```

Expo Router는 `app/`을 라우트 루트로 사용합니다. `app/index.tsx`는 인증 상태에 따라 로그인 또는 대시보드로 이동하며, `app/(tabs)/_layout.tsx`에 대시보드·기록·목표·히스토리·지도·설정 탭이 있습니다. `app/(tabs)/map.tsx`가 플랫폼별 지도 컴포넌트를 참조합니다. `components/app/`은 복제 라우트 후보지만 현재 라우트 루트가 아니므로 삭제하지 않습니다. `components/contexts/DataContext.tsx`는 루트와 여러 화면에서 직접 사용합니다.

기존 로컬 키 `@SmokeTracker:entries`, `@SmokeTracker:goals`와 인증 키 `@SmokeTracker:supabase-auth`는 유지합니다. Phase 1은 계정별 스냅샷을 별도 키에 저장하며 기존 로컬 기록은 설정에서 명시적으로 가져올 수 있습니다. 동기화 및 서버 검증 조건은 [Phase 1 결과](docs/phase1-safety.md)와 [서버 계약](docs/server-contract.md)에 있습니다.

## VS Code 터미널 명령

저장소 루트에서 Node.js 24와 npm을 사용합니다. Windows PowerShell의 실행 정책이 `npm.ps1`을 차단하면 아래 명령에서 `npm` 대신 `npm.cmd`를 사용합니다.

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build:web
npm start
```

Phase 1 기준 `npm test`는 29개 테스트가 통과합니다. 기기와 실제 서버 검증은 아직 필요합니다.

Android 에뮬레이터 또는 연결된 기기에서는 `npm run android`, macOS의 iOS 시뮬레이터에서는 `npm run ios`를 사용합니다. 위치·알림·오디오 권한 검증에는 실제 기기가 필요할 수 있습니다. `build:web`은 정적 웹 번들 확인이며 네이티브 빌드를 대신하지 않습니다.

## Android/iOS 수동 검증표

| 영역 | 각 플랫폼에서 확인할 절차 |
| --- | --- |
| 계정 | 기존 계정 로그인, 로그아웃, 재로그인 후 각 계정의 기록과 목표 분리 |
| 기록 | 추가·삭제 후 재시작, 오프라인 추가 후 재연결, 자정 전후 및 시간대 변경 시 날짜와 합계 |
| 목표 | 빈 기록에서 진행률, 일일 한도 초과, 연속 금연일, 완료 후 재시작과 동기화 |
| 통계 | 빈 기록, 주·월 경계, 같은 날 여러 건, 선택일과 차트 수치 |
| 동기화 | 두 기기에서 순차 및 동시 수정, 네트워크 오류 시 로컬 기록 보존 |
| 위치 | 전경/백그라운드 권한 거부·허용, 체류 알림, 배터리 소비와 오탐 |
| 알림·감지 | 알림·마이크 권한 거부·허용, 오디오·웨어러블 자동 기록의 오탐과 중복 |
| 지도 | 위치 권한 및 구역 조회·등록·편집·삭제. 서버 RLS 확인 전에는 테스트 계정 사용 |

## 웹 지원 범위

웹용 지도 화면은 Android/iOS 전용 기능이라는 안내만 표시하며 지도/구역 저장 조작을 제공하지 않습니다. 위치 백그라운드 작업, 네이티브 알림, 오디오 및 웨어러블 감지는 웹 지원으로 확인되지 않았습니다. Phase 2에서 `npm run build:web`은 통과했지만 브라우저 실사용 검증은 아직 필요합니다. 조사와 검증 결과는 [Phase 0 조사](docs/phase0-baseline.md)에 기록합니다.
