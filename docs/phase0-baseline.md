# Phase 0 조사 기록

기준 커밋: `336abd42e9a5b3e777faf2c7673a9c3f46e4ffa7`. 작업 시작 시 원본 폴더에 `.git`이 없어 브랜치/커밋을 직접 확인할 수 없었습니다. 원격 `main` HEAD가 기준 커밋이고, 원본의 추적 파일 100개는 줄 끝을 정규화하면 기준과 일치했습니다. Git 메타데이터를 복구한 뒤의 브랜치는 `main`입니다.

## 구성 및 참조

- `README.md`: 기준 버전은 `smok`만 포함. `package.json`: Expo Router 진입점, Expo 54, React 19, React Native 0.81, Supabase, AsyncStorage, 위치/알림/오디오/센서 의존성. 별도 테스트 도구 및 ESLint 설정 없음.
- `app/`: 실제 Expo Router 경로. 인증 화면, 탭 화면, `app/dashboard.tsx` 추가 경로. `app/(tabs)/map.tsx`는 네이티브 지도 재수출, `.web.tsx`는 UI 미리보기.
- `contexts/`: 루트에서 사용하는 인증·설정·테마·위치 체류 Context. `components/contexts/DataContext.tsx`는 실제 데이터 공급자. 같은 디렉터리의 Auth/Settings/Theme/Notification Context는 현재 루트에서 사용하지 않는 별도 구현.
- `components/services/`: AsyncStorage와 메모리 캐시, 알림, 백그라운드 위치, 오디오/웨어러블 감지. `lib/supabase.ts`는 앱 설정의 URL과 anon 키로 클라이언트를 생성하고 인증을 AsyncStorage에 보존. `utils/`는 위치·알림 보조 코드.
- `components/app/`은 Expo Router 루트 밖의 복제 라우트 후보. 현행 import 검색으로 이 경로를 참조하는 실제 `app/` 파일은 없지만 삭제 근거로 보지 않음.

## 기준 코드의 확인된 위험

- 초기 터미널 출력에서는 `DataContext`의 주석과 `useEffect`가 한 줄처럼 보였으나 실제 UTF-8 원문은 별도 줄이며 구문 오류가 아님. 기준 타입 검사에서 확인한 오류는 `components/LoginScreen.tsx`와 `components/components/LoginScreen.tsx`의 `login` 참조 2건임.
- 원격 `entries`/`goals` 조회 성공 시 빈 배열도 로컬 상태와 저장소를 덮어씀. 로그인 직후 오프라인 기록이나 미동기화 데이터가 사라질 수 있음. 계정별 로컬 저장 키가 분리되어 있지 않음.
- Supabase `upsert`/`delete`의 반환 `error`를 확인하지 않음. 원격 실패가 성공처럼 보일 수 있음. 원격 변경의 버전·충돌 규칙과 삭제 tombstone이 없음.
- `Date#toISOString().split('T')[0]`와 `entry.date.startsWith(...)`로 현지 날짜를 비교. UTC와 다른 시간대의 자정 근처에서 기록/통계가 다른 날로 집계될 수 있음.
- 빈 기록에서 목표 진행률을 계산하지 않는 경로가 있으며, 이번 주의 아직 지나지 않은 날을 금연일로 셈. `streak`은 자동 갱신 분기가 없고 `milestone` 템플릿의 12시 제한은 일수 계산과 의미가 다름. 목표 화면과 DataContext가 일일 한도 진행률을 서로 다르게 계산함.
- 히스토리 통계는 기록이 비면 이전 상태를 초기화하지 않으며, 연속일은 최대 2일로 계산. 월 추세 종료일이 자정이어서 종료일 당일 기록이 빠질 수 있음.
- 앱에는 `entries`, `goals`, `profiles`, `triggers`, `smoking_zones` 테이블 및 `delete-user` 함수를 호출하는 코드가 있지만 스키마/RLS/함수 정의는 저장소에 없음. 필요한 서버 변경은 스키마와 정책을 먼저 확보한 뒤 별도 검증해야 함.

## 검증 결과

| 명령 | 기준 커밋 결과 | 변경 후 결과 |
| --- | --- | --- |
| `npm ci` | 기준 잠금 파일로 956개 패키지 설치 성공 | 테스트/린트 의존성이 잠금 파일에 추가됨 |
| `npx tsc --noEmit` / `npm run typecheck` | `components/LoginScreen.tsx`, `components/components/LoginScreen.tsx`의 `login` 속성 오류 2건 | 동일한 2건. 신규 타입 오류 없음 |
| `npm run lint` | 설정 부재로 Expo가 ESLint 설치를 자동 시도하여 최초 실행 실패 | 설정 추가 후 4 errors, 48 warnings. 4 errors는 기존 파일 `app/+not-found.tsx`, `components/app/(tabs)/index.tsx`, `components/app/(tabs)/settings.tsx`, `components/app/+not-found.tsx`의 이스케이프되지 않은 따옴표 |
| `npm test` | 기준 명령 없음 | 5개 재현 테스트 중 1개 통과, 4개 실패: 현지 날짜, 미래 금연일, 원격 빈 결과, 동일 ID 충돌 |
| `npm run build:web` | `react-native-maps`의 네이티브 내부 모듈을 웹 번들에서 가져와 실패 (`app/(tabs)/map.native.tsx` 참조) | 앱 소스를 수정하지 않았으므로 같은 실패가 예상됨. 재실행하지 않음 |

테스트는 `DataProvider`의 기존 동작을 직접 렌더링해 검사합니다. 실패는 의도적으로 남겨둔 재현 결과이며, 실제 데이터 변경이나 서버 호출은 하지 않습니다. 테스트의 `react-test-renderer` 지원 중단 경고는 별도 테스트 기반 개선 과제입니다. 웹 빌드 실패는 웹 라우트 해석/네이티브 import 경로를 확인해야 해결됩니다.

Android/iOS 실제 기기 검증은 아직 수행하지 않았습니다. 정확도·동기화 변경은 이 문서의 위험을 재현하는 테스트와 실제 계정의 데이터 보존 확인이 선행되어야 합니다.
