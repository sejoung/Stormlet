# ADR 0014: Google Analytics 사용 통계

- 상태: 채택
- 날짜: 2026-11-09
- 관련: [계층형 로컬 우선 구조](0001-layered-local-first.md), [진단](0009-diagnostics.md), [Google Drive 동기화](0010-google-drive-sync.md)

## 배경

배포한 사이트를 몇 명이 쓰는지, 어떤 기능을 쓰는지, 사용자 쪽에서 어떤 오류가 나는지 알 방법이 없다. 진단 로그(ADR 0009)는 사용자가 복사해 보내야만 밖으로 나간다. 반면 이 앱은 로컬 우선이라 보드 내용은 어디로도 보내지 않는다는 원칙이 있다.

## 결정

1. **GA4에 직접 연결한다**: `gtag.js`를 GA4 측정 ID(`VITE_GA_MEASUREMENT_ID`)로 불러온다. GTM은 쓰지 않는다. 이벤트는 코드가 정하므로 GTM에서 따로 할 트리거 설정이 없고, 저장소 밖에서 사이트에 코드를 넣을 경로도 생기지 않는다. 측정 ID는 공개 값이라 Drive 설정처럼 `.env.local`과 Actions 변수에 둔다. 값이 없거나 `G-…` 형식이 아니면 이 기능 없이 빌드한다.
2. **동의한 뒤에만 불러온다**: 처음 방문하면 보드를 가리지 않는 배너로 묻는다. 허용하기 전에는 Google 스크립트를 불러오지 않고 아무것도 보내지 않는다. 선택은 `stormlet.usage-stats`에 저장하고, **설정 → 사용 통계 보내기**에서 바꾼다. 거부하면 전송을 멈추고(`ga-disable-<ID>`, consent `denied`) `_ga` 쿠키를 지운다. 광고 저장소·광고 개인화·Google 신호는 항상 끈다.
3. **진단 로그에서 골라 보낸다**: 앱 코드는 GA를 모른다. 기능을 쓰면 진단 로그에 남기고(`files.exported` 등), 어댑터가 로그를 구독해 목록에 있는 이벤트만 GA 이벤트(`image_exported` 등)로 바꿔 보낸다. 세부 값도 목록에 있는 것만, 짧은 코드 단어나 숫자일 때만 보낸다. 오류 수준 로그는 `app_error`로 보내되 이벤트 이름만 보내고 메시지는 보내지 않는다. 메시지에 사용자가 입력한 내용이 들어갈 수 있기 때문이다. 오류 이벤트는 페이지마다 20개까지만 보낸다.
4. **주소에서 내용을 뺀다**: `page_location`은 origin과 경로만 쓴다. 주소의 해시(`#new=<보드 이름>`)와 쿼리는 보내지 않는다. 페이지 제목은 항상 `Stormlet`이다.
5. **CSP는 측정 ID가 있는 빌드에서만 연다**: 빌드할 때 Vite 플러그인(`scripts/analytics-csp.ts`)이 GA에 필요한 origin만 `script-src`·`connect-src`·`img-src`에 더한다. 인라인 스크립트와 `eval`은 계속 막는다. E2E와 설명서 캡처는 측정 ID를 비운 빌드로 실행해 GA에 닿지 않는다.

## 보내는 이벤트

| GA 이벤트         | 언제                     | 함께 보내는 값                   |
| ----------------- | ------------------------ | -------------------------------- |
| `page_view`       | 허용한 뒤 페이지를 열 때 | origin과 경로                    |
| `board_created`   | 새 보드                  |                                  |
| `file_opened`     | `.stormlet` 파일 열기    |                                  |
| `file_downloaded` | `.stormlet` 내려받기     |                                  |
| `image_exported`  | PNG·SVG 내보내기         | `format` (`png` 또는 `svg`)      |
| `app_error`       | 오류 수준 로그           | `error_event` (로그 이벤트 이름) |

이벤트를 더하려면 진단 로그에 남기고 `src/adapters/analytics/usage-events.ts`의 목록에 넣는다.

## 결과

허용한 사용자만 집계되므로 실제 사용자 수보다 적게 잡힌다. GA4는 쿠키를 쓰므로 EU 등 동의가 필요한 지역을 생각해 배너를 둔다. 설명서의 [사용 통계](../../public/manual/index.html#privacy) 절에 무엇을 보내는지 적어 둔다.
