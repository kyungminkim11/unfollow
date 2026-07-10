# 맞팔체커

Instagram에서 내려받은 관계 데이터 ZIP을 브라우저에서 직접 분석하는 로컬 웹 서비스입니다.
로그인 정보나 비밀번호를 요구하지 않으며, 선택한 ZIP과 분석 결과를 서버로 전송하지 않습니다.

- 서비스: https://unfollow.lavalabs.co.kr
- 운영: Lava Labs
- 지원 데이터: Instagram JSON 형식의 팔로워 및 팔로잉 ZIP
- 자동 언팔: 제공하지 않음
- 현재 운영: 무료 베타

## v17 서비스 구성

- **분석**: 맞팔, 나만 팔로우 중, 나를 팔로우 중인 계정 분류
- **관계 변화 비교**: 이전 ZIP과 최신 ZIP의 팔로워·팔로잉·맞팔 변화 비교
- **작업공간**: 브라우저 로컬 저장, 이름 변경, 개별·전체 백업 및 삭제
- **결과 활용**: 검색, 상태 기록, 아이디 복사, CSV 저장
- **무료 베타 배너**: 현재 무료 상태와 향후 프리미엄 기능 계획 안내
- **희망자 뉴스레터**: 회원가입 없이 프리미엄 출시와 중요 업데이트 이메일 수신 신청
- **수신 해지**: 이메일 입력 시 구독 정보와 연결된 동의 기록 삭제
- **프리미엄 수요조사**: 희망 기능, 가격대, 운영 계정 수와 추가 의견 수집·갱신·삭제
- **관리자 대시보드**: 이메일 매직링크 인증, 구독자·수요 통계, 검색, CSV 내보내기, 삭제
- **정책 페이지**: 개인정보 처리방침, 이용약관, 데이터 처리 안내, 프리미엄 예정 기능
- **접근성·반응형**: 데스크톱·태블릿·모바일, 다크모드, 키보드 탐색 지원
- **오프라인 사용**: 설치형 웹앱(PWA)과 일반 페이지별 오프라인 캐시 지원. 관리자 화면은 네트워크 전용

## 페이지

- `/` — 분석 서비스와 무료 베타 배너
- `/guide/` — Instagram 데이터 준비 및 사용 가이드
- `/help/` — 오류 해결과 자주 묻는 질문
- `/premium/` — 현재 무료 범위, 향후 프리미엄 기능과 수요조사
- `/newsletter/` — 희망자 뉴스레터 신청 및 수신 해지
- `/data/` — ZIP 분석과 선택 신청 정보 처리 흐름
- `/privacy/` — 개인정보 처리방침
- `/terms/` — 무료 베타 이용약관
- `/admin/newsletter/` — 검색 노출을 차단한 라바랩스 관리자 대시보드

## 개인정보와 안전

ZIP 파일은 사용자의 브라우저 메모리에서만 읽습니다. 작업 기록과 설정은 현재 브라우저의 로컬 저장소에 보관되며 사용자가 삭제하거나 백업할 수 있습니다. 작업공간 연결에는 사용자 아이디 원문 대신 브라우저에서 계산한 비식별 해시 스케치만 저장됩니다.

뉴스레터를 신청한 경우에만 이메일과 동의 기록을 Supabase 서울 리전 데이터베이스에 저장합니다. 프리미엄 수요조사에 참여한 경우 이메일, 선택 기능, 희망 가격, 계정 수 범위와 추가 의견을 별도 테이블에 저장합니다. 두 기능 모두 온라인에서 직접 삭제할 수 있으며 ZIP 원본·분석 결과와 결합하지 않습니다.

공개 브라우저에서는 데이터베이스를 직접 읽거나 쓸 수 없습니다. 공개 신청 함수는 허용 Origin, 요청 크기, 이메일 형식, 필수 동의와 허니팟을 검증합니다. 관리자 API는 유효한 Supabase 사용자 JWT와 관리자 허용 이메일을 모두 확인합니다.

맞팔체커는 Instagram 또는 Meta와 제휴하거나 공식적으로 운영되는 서비스가 아닙니다. Instagram 화면에서 직접 팔로우를 변경하기 전에는 계정 상태와 변경 대상을 다시 확인해야 합니다.

## 무료 베타와 유료화

현재 결제되는 유료 상품과 자동 갱신 구독은 없습니다. 향후 프리미엄은 분석 결과를 가리는 방식보다 분석 이력, 여러 계정, 고급 비교, 리포트, 기기 동기화 같은 관리 기능을 중심으로 검토합니다. 수요조사 결과는 개발 우선순위와 가격 검토 자료이며 확정된 계약 조건이 아닙니다.

실제 판매 전에는 가격, 이용 기간, 환불, 자동 갱신 여부, 회원가입과 클라우드 저장 항목을 별도로 고지합니다.

## 빌드와 검증

`main` 브랜치에 반영되면 GitHub Actions가 다음 순서로 정적 사이트를 생성하고 검증합니다.

```text
v9/part*.txt
   ↓ scripts/build-pages.mjs
   ↓ scripts/build-release.mjs
   ↓ scripts/build-v13.mjs
   ↓ v15 서비스 UI + v16 베타·뉴스레터 + v17 수요조사·관리자 페이지 결합
   ↓ 기존 분석·비교·접근성·반응형·신청 API·관리자 UI 회귀 검사
   ↓ GitHub Pages
https://unfollow.lavalabs.co.kr
```

주요 검증 항목:

- ZIP 용량·파일 수·압축률·JSON 크기 안전 제한
- 기존 분석과 작업 기록 기능 회귀 검사
- 두 시점 비교 기능 검사
- 1536·1280·900·390px 레이아웃 검사
- Axe 기반 critical/serious 접근성 오류 검사
- 무료 베타 배너, 뉴스레터와 정책 링크 검사
- 뉴스레터 실제 신청 후 해지·삭제 API 왕복 검사
- 프리미엄 수요조사 실제 저장 후 갱신·삭제 API 왕복 검사
- 관리자 API 비로그인 차단과 관리자 화면의 모의 인증·통계·검색·CSV 검사
- 개인정보·이용약관·데이터·프리미엄 페이지의 CSP·SEO·가로 넘침 검사

## 주요 파일

- `scripts/build-pages.mjs`: 압축 원본 복원, 안전 패치, SEO·PWA 구성
- `scripts/build-release.mjs`: CSP 및 외부 의존성 정리
- `scripts/build-v13.mjs`: 내용 기반 작업공간 연결과 정적 페이지 결합
- `assets/v13-features.js`: 관계 변화 비교, 작업공간, 진단 리포트
- `assets/design-v14.*`: 기존 시각 레이어
- `assets/service-v15.*`: 서비스형 정보 구조, 문구, 접근성, 반응형 UI
- `assets/monetization-v16.*`: 무료 베타 배너와 뉴스레터 대화상자
- `assets/newsletter-page-v16.js`: 신청·해지 폼 처리
- `assets/premium-interest-v17.js`: 프리미엄 수요조사 저장·삭제 처리
- `assets/admin-v17.*`: 관리자 매직링크 인증과 운영 대시보드
- `pages/*`: 가이드, 도움말, 프리미엄, 뉴스레터, 데이터, 개인정보, 이용약관, 관리자
- `scripts/newsletter-v16-smoke.mjs`: 베타 배너·정책·뉴스레터 API 통합 검사
- `scripts/admin-v17-smoke.mjs`: 수요조사 API와 관리자 화면·보안 검사
- `sw.js`: 앱 및 페이지별 오프라인 캐시와 관리자 네트워크 전용 처리

## Supabase 백엔드

### 공개 뉴스레터

- Edge Function: `unfollow-newsletter`
- Tables: `unfollow_newsletter_subscribers`, `unfollow_newsletter_consent_events`

### 프리미엄 수요조사

- Edge Function: `unfollow-premium-interest`
- Table: `unfollow_premium_interest`

### 관리자

- Edge Function: `unfollow-newsletter-admin` (`verify_jwt=true`)
- Tables: `unfollow_admin_allowlist`, `unfollow_admin_audit_log`
- 로그인: Supabase Auth 이메일 매직링크
- 현재 허용 관리자: `lavalabs.ceo@gmail.com`

모든 업무 테이블은 RLS를 사용하고 공개 직접 접근 정책을 두지 않습니다. 공개 신청은 검증된 Edge Function으로만 처리하며 관리자 조회·삭제는 유효한 JWT와 허용 이메일 확인을 모두 통과해야 합니다.
