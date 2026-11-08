# Google Drive 연결

Drive 연결은 선택 기능이다. 아래 세 값을 넣고 빌드한 경우에만 툴바에 Google Drive 버튼이 나타나고, 값이 없으면 앱은 지금처럼 브라우저 저장과 파일 내려받기만으로 동작한다. 설계 결정은 [ADR 0010](adr/0010-google-drive-sync.md)에 있다.

## 설정

1. Google Cloud 프로젝트에서 **Google Drive API**와 **Google Picker API**를 활성화한다.
2. OAuth 동의 화면을 만들고 범위에 `https://www.googleapis.com/auth/drive.file`만 추가한다. 테스트 모드라면 사용할 계정을 테스트 사용자로 등록한다. `drive.file`은 앱이 만들었거나 사용자가 Picker로 고른 파일에만 접근하는 범위다.
3. **웹 애플리케이션** OAuth 클라이언트를 만들고 승인된 JavaScript 원본에 `http://127.0.0.1:5173`과 배포 origin(예: `https://<계정>.github.io`)을 등록한다. origin에는 경로를 넣지 않는다.
4. 브라우저용 API 키를 만들고 아래 [API 키 제한](#api-키-제한)을 적용한다.
5. `.env.example`을 `.env.local`로 복사해 Client ID, API 키, 프로젝트 번호(App ID)를 넣고 개발 서버를 다시 시작하거나 다시 빌드한다. 세 값은 번들에 들어가는 공개 설정이다. **client secret은 절대 넣지 않는다.**

```sh
VITE_GOOGLE_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=AIza...
VITE_GOOGLE_APP_ID=1234567890
```

### API 키 제한

API 키는 Picker의 개발자 키로만 쓴다. Drive 파일 읽기·쓰기는 OAuth 액세스 토큰으로 요청하고 API 키를 보내지 않는다.

| 설정                        | 값                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------ |
| 애플리케이션 제한(웹사이트) | `http://127.0.0.1:5173/*`, `https://<계정>.github.io/*`, `https://docs.google.com/*` |
| API 제한                    | Google Picker API                                                                    |

- `index.html`의 referrer 정책 때문에 Google에는 origin만 전달된다. 웹사이트 제한에 하위 경로(`https://<계정>.github.io/Stormlet/*`)를 쓰면 일치하지 않는다.
- Picker는 `docs.google.com` iframe 안에서 키를 다시 쓰므로 `https://docs.google.com/*`가 필요하다. 빠지면 Picker에 "API 개발자 키가 잘못되었습니다"가 표시된다.
- 제한 변경은 반영까지 몇 분 걸린다. 콘솔의 `Cross-Origin-Opener-Policy policy would block the window.closed call` 경고는 Google 로그인 팝업에서 정상적으로 나오는 경고다.

## 동작

- **연결**: 툴바의 Drive 버튼 → `Google Drive 연결`. 대화상자를 열 때 Google 스크립트를 미리 불러와, 버튼을 누르는 즉시 로그인 팝업이 열린다(팝업은 사용자 동작 안에서만 열 수 있다).
- **Drive 폴더에 저장**: Picker로 폴더를 고르면 현재 보드를 `<보드 이름>.stormlet` 파일로 만들고, 이후 그 파일과 동기화한다. Drive에서 미리 발급받은 ID로 만들어, 응답이 유실되어 다시 시도해도 파일은 하나만 생긴다. 응답을 받기 전에 페이지를 닫거나 새로고침해도, 다음에 연결할 때 그 ID로 만들어진 파일을 찾아 다시 연결하고 그사이 편집을 저장한다(`stormlet.drive.creating`에 폴더·파일 ID만 기억). 연결된 상태에서는 `다른 폴더에 사본 저장`으로 새 파일을 만들어 그쪽으로 옮겨 갈 수 있다.
- **Drive에서 열기**: Picker로 고른 파일을 보드로 연다. 실행 취소할 수 있는 편집이며, 연 파일에 다시 쓰지 않는다. 지금 파일에 저장되지 않은 변경이 있으면 먼저 저장하고, 저장할 수 없으면 열지 않는다.
- **자동 저장**: 편집이 2초 멈추면 저장하고, 계속 편집해도 최대 10초마다 저장한다. 툴바 버튼이 `저장 중…`, `저장됨` 등 상태를 보여 준다. 보드 이름을 바꾸면 파일 이름도 함께 바뀐다.
- **다른 곳의 변경**: 저장 직전에 파일 버전을 확인한다. 다른 곳에서 바뀌었으면 파일을 다시 읽어, 마지막으로 동기화한 보드를 기준으로 3방향 병합한다. 서로 다른 포스트잇·프레임·연결선, 같은 항목의 다른 필드는 자동으로 합치고, 합친 원격 변경은 실행 취소 기록에 넣지 않고 화면에 반영한다. 같은 필드를 양쪽에서 다르게 바꿨거나 한쪽이 지운 항목을 다른 쪽이 고친 경우만 `충돌`로 표시하고, 항목마다 내 변경과 Drive 변경 중 하나를 고르게 한다.
- **탭 간 공유**: 액세스 토큰은 메모리에만 있다. localStorage·sessionStorage·쿠키에 쓰지 않는다. 대신 연결된 탭이 열려 있으면 새 탭이나 새로고침한 탭이 `BroadcastChannel`(`stormlet:auth:<Client ID>`)로 남은 수명만큼 토큰을 받아 로그인 창 없이 이어서 저장한다. 받는 탭은 자기 시계로 만료 시각을 계산해 Google이 정한 만료를 늘리지 않는다. 한 탭의 연결 해제는 모든 탭에 적용되고, Drive가 거부한(401) 토큰은 그 토큰을 가진 탭에서만 지운다. 연결된 탭이 하나도 없으면 `다시 연결`을 눌러야 한다.
- **탭 간 연결 파일**: 한 탭에서 다른 파일을 열거나 새로 만들거나 동기화를 멈추면, 열린 다른 탭도 `storage` 이벤트로 곧바로 같은 연결을 따른다. 이전 파일로 보내던 요청의 결과는 버리고, 이후 편집은 새 파일에 저장한다. 한 탭이 저장하면 다른 탭도 그 버전과 기준 보드를 이어받아, 같은 내용을 다시 저장하거나 버전 충돌을 겪지 않는다.
- **만료 전 연장**: 토큰은 약 1시간 유효하다. 만료 10분 전부터 버튼이 `연장`으로 바뀌고, 이때 앱 아무 곳이나 클릭하면 Google 팝업으로 토큰을 다시 받는다. 이미 동의한 계정이면 팝업이 바로 닫힌다. 팝업은 사용자 동작 안에서만 열 수 있어 타이머로 연장하지 않고, 키 입력은 팝업이 포커스를 가져가므로 쓰지 않는다. 팝업을 닫거나 차단해 실패하면 그 토큰이 끝날 때까지 클릭 연장을 멈추고 `연장` 버튼만 남긴다. 연장한 토큰은 다른 탭에도 전달된다.
- **만료 후**: 연장하지 않으면 버튼이 `다시 연결`로 바뀌고 자동 저장을 멈춘다. 그동안의 편집은 브라우저에 남고, 다시 연결하면 그사이 원격 변경을 합친 뒤 밀린 편집을 저장한다.
- **실패**: 네트워크 오류와 요청 한도 초과(403 `rateLimitExceeded`·`userRateLimitExceeded`, 429)는 5초·15초·60초 뒤 다시 시도하고, 새 편집이 있으면 그때도 시도한다. 권한 거절(403), Drive 저장 공간 부족(403 `storageQuotaExceeded`), 파일 삭제(404), 읽을 수 없는 파일은 `저장 안 됨`으로 멈추고 Drive 대화상자에서 `다시 시도`할 수 있다. 실패는 진단 로그(`drive.*`)에 남는다.
- **동기화 중지·연결 해제**: `동기화 중지`는 파일 연결만 끊는다. 보드와 Drive 파일은 그대로 남는다. 로컬 `.stormlet` 파일을 열어도 동기화가 멈춘다. `Google Drive 연결 해제`는 동기화를 멈추고 Google 권한을 철회한다. 철회가 확인되지 않으면 Google 계정의 서드파티 액세스 설정에서 지울 수 있다.

브라우저에는 연결한 파일의 ID·이름·버전과 마지막으로 동기화한 보드(`stormlet.drive.file`, `stormlet.drive.base`), 응답을 기다리는 생성의 폴더·파일 ID(`stormlet.drive.creating`)만 저장한다. 토큰은 저장하지 않는다. 브라우저의 보드 저장본이 손상되어 읽을 수 없으면([ADR 0009](adr/0009-diagnostics.md)) 마지막으로 동기화한 보드에서 다시 시작한다. 빈 보드가 '모두 삭제'로 Drive에 저장되지 않게 하기 위해서다.

## 한계

- 실시간 공동 편집이 아니다. 저장할 때 다른 곳의 변경을 합치는 방식이다.
- 버전 확인과 쓰기는 별도 요청이다. Google이 ETag를 주면 `If-Match`로 막지만, 주지 않으면 그 사이의 동시 쓰기를 원자적으로 막지 못한다.
- 브라우저당 연결 파일은 하나다. 같은 브라우저의 여러 탭은 같은 파일을 따른다.
- 연결된 탭이 모두 닫히면 토큰도 사라져 다시 로그인해야 한다. Google token model에는 refresh token이 없다.

## 보안

CSP는 Google 로그인·Picker·Drive API origin만 추가로 허용한다(`index.html`).

브라우저는 저장소와 탭 간 채널을 경로가 아니라 **origin**(`https://<계정>.github.io`) 단위로 나눈다. GitHub Pages의 프로젝트 페이지(`/Stormlet`, `/Maplet` 등)는 모두 같은 origin이므로 서로 다음을 볼 수 있다.

- **localStorage·sessionStorage·IndexedDB**: Stormlet이 저장한 보드(`stormlet.board`), Drive 연결 파일과 기준 보드(`stormlet.drive.*`), 설정을 같은 origin의 다른 페이지 스크립트가 읽고 쓸 수 있다. 키 이름이 달라 우연히 섞이지는 않지만 막혀 있지도 않다. 저장 공간 한도(보통 origin당 약 5MB)도 함께 쓴다.
- **`BroadcastChannel`**: 같은 origin의 페이지는 Stormlet의 채널에 `request`를 보내 연결된 탭의 액세스 토큰을 받을 수 있다. 이 토큰으로 Stormlet이 접근할 수 있는 Drive 파일(`drive.file`: Stormlet이 만들었거나 Stormlet으로 연 파일)을 읽고 쓸 수 있다.

그 origin의 다른 페이지를 모두 신뢰할 수 없다면 Drive를 켜는 배포는 **Stormlet 전용 origin**에 올린다. 사용자 지정 도메인, 또는 별도 GitHub 조직의 `<조직>.github.io` 같은 방법이 있다. 메모리 토큰도 연결 중에 실행되는 XSS나 악성 확장 프로그램으로부터 완전히 격리되지는 않는다.

## 테스트

단위 테스트는 병합 규칙(`tests/unit/domain/merge.test.ts`), 동기화 일정·충돌·실패(`tests/unit/application/drive-sync.test.ts`), REST 계약과 로그인(`tests/unit/adapters/drive`), 화면 흐름(`tests/unit/app/drive`)을 검사한다. E2E(`tests/e2e/drive.spec.ts`)는 Google 스크립트와 Drive REST를 브라우저 안에서 흉내 내 연결·저장·자동 저장·새로고침 후 재연결·병합·열기를 확인한다. 실제 계정의 OAuth·Picker·권한 철회는 배포 origin에서 따로 확인해야 한다.
