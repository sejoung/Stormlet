# ADR 0001: 로컬 우선 계층 구조

- 상태: 채택
- 날짜: 2026-11-06
- 관련: Maplet ADR 0001, 0020, 0021 (같은 구조를 가져옴)

## 배경

Stormlet은 Maplet과 같은 사람이 같은 방식으로 관리한다. 정적 호스팅에서 서버 없이 동작하고, 보드는 사용자의 파일과 브라우저에 있다. Maplet에서 검증한 계층 규칙과 테스트로 강제하는 방식을 처음부터 적용한다.

## 결정

의존 방향은 `domain ← application / engine / adapters ← components ← app`이다. 계층 지도는 `scripts/architecture.cjs` 한 곳에 두고 dependency-cruiser와 아키텍처 테스트가 함께 읽는다.

- **domain**: 보드 모델, 패치, 명령, 저장소 인터페이스. 패키지와 브라우저 API를 쓰지 않는다. ID는 호출자가 넘긴다.
- **application**: 편집 세션과 실행 취소처럼 React 없이 테스트할 유스케이스 규칙.
- **engine**: 뷰포트, 스티키 크기, 격자 같은 화면 기하.
- **adapters**: `.stormlet` 포맷, 브라우저 저장소, 파일 다운로드. 상태를 가진 어댑터는 `main.tsx`에서만 만든다.
- **components**: 화면만 그린다. 어댑터를 모른다.
- **app**: 조립과 수명 주기.

파일은 400줄, 폴더는 파일 10개를 넘지 않는다(`npm run lint`).

## 결과

`tests/architecture`가 계층, 패키지, 순환, 고아 모듈, 순수 계층의 브라우저 전역 사용, 어댑터 생성 위치를 검사한다. 규칙을 바꾸려면 이 ADR과 `scripts/architecture.cjs`를 함께 고친다.
