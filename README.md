# 맞팔체커

Instagram 팔로우 관계를 브라우저에서 확인하는 로컬 웹 서비스와 Chrome Companion입니다.
공식 JSON ZIP 분석뿐 아니라 Instagram 웹 화면에서 현재 팔로워·팔로잉을 수집해 맞팔 아닌 명단을 만들 수 있습니다.

- 서비스: https://unfollow.lavalabs.co.kr
- 운영: Lava Labs
- 현재 운영: 무료 베타
- 서버로 보내지 않는 정보: Instagram ZIP, 관계 분석 결과, 팔로워·팔로잉 스캔 명단, 팔로우 취소 작업 상태
- 지원 환경: 웹 분석은 최신 브라우저, 웹 스캔·작업 실행은 PC Chrome 또는 Edge

## v23 주요 기능

### 현재 관계 웹 스캔

Chrome Companion이 로그인한 계정의 내 Instagram 프로필에서 화면에 표시되는 목록을 읽습니다.

- 팔로워 명단
- 팔로잉 명단
- 맞팔 아닌 명단: `팔로잉 - 팔로워`
- 아이디 검색과 프로필 열기
- 명단별 CSV 저장
- 맞팔 아닌 명단을 팔로우 취소 작업 목록으로 전환
- 목록 로딩 중단과 일부 수집 경고
- 스캔 중지와 로컬 상태 보관

스캐너는 비밀번호, 인증 코드, 쿠키, 세션 토큰, DM, 게시물 내용 또는 Instagram 비공개 API를 읽지 않습니다. 내 프로필이 확인된 경우에만 팔로워·팔로잉 목록을 열며 로그인·보안 확인·목록 창 닫힘을 감지하면 중지합니다.

### 공식 ZIP 분석

- 맞팔, 나만 팔로우 중, 나를 팔로우 중인 계정 분류
- 이전 ZIP과 최신 ZIP의 관계 변화 비교
- 나를 언팔했고 최신 시점에도 내가 팔로우 중인 계정 계산
- 작업공간, 검색, 메모, CSV와 진단 파일
- ZIP 원본과 분석 결과는 웹 브라우저에서만 처리

### 선택 팔로우 취소 작업

- 웹 스캔 또는 ZIP 분석 명단에서 작업 대상 선택
- 별도 확인란과 사용자의 시작 버튼 필요
- 한 번에 최대 30개
- 계정 사이 임의 대기와 정기 휴식
- 일시정지, 재개와 즉시 중지
- 이미 팔로우하지 않는 계정 건너뜀
- 로그인·챌린지와 2회 연속 오류 시 안전 중지
- 성공·실패·건너뜀 상태를 확장 프로그램 로컬 저장소에 저장

## 서비스 운영 기능

- 문의 센터: 문의 저장, 접수번호, 운영자 이메일 알림
- 문의 관리자: 검색, 상태 변경, 답장과 삭제
- 희망자 뉴스레터: 신청, 해지와 동의 기록
- 프리미엄 수요조사
- 뉴스레터 캠페인 초안·대기열·발송 관리
- 개인정보 처리방침, 데이터 처리 안내와 이용약관
- PWA, 반응형 UI, 다크 모드와 키보드 접근성

## 페이지

- `/` — ZIP 분석, 관계 스캔 결과와 작업 목록
- `/guide/` — Companion 설치, 웹 스캔과 ZIP 비교 사용법
- `/help/` — 스캔·분석·작업 문제 해결
- `/premium/` — 예정 기능과 수요조사
- `/newsletter/` — 뉴스레터 신청과 해지
- `/contact/` — 서비스 문의
- `/data/` — 로컬·서버 데이터 처리 흐름
- `/privacy/` — 개인정보 처리방침
- `/terms/` — 이용약관
- `/admin/newsletter/` — 운영 관리자

## 로컬 데이터 구조

### 웹 브라우저

공식 ZIP은 메모리에서 읽습니다. 작업공간 이름, 검토 상태, 화면 설정과 비식별 해시 스케치는 웹 로컬 저장소에 보관할 수 있습니다.

### Chrome Companion

`chrome.storage.local`에 다음을 보관합니다.

- 로그인한 계정의 프로필 아이디
- 팔로워, 팔로잉과 맞팔 아닌 아이디 명단
- 스캔 완료 여부, 시각과 경고
- 선택 팔로우 취소 큐
- 처리 상태, 오류와 실행 설정

새로 스캔하거나 확장 프로그램 저장 데이터를 삭제하면 갱신·삭제할 수 있습니다. 이 정보는 라바랩스 서버, 문의 또는 뉴스레터 데이터베이스로 전송하지 않습니다.

## 서버 업무 정보

문의, 뉴스레터와 수요조사에 이용자가 직접 제출한 정보만 Supabase 기반 업무 데이터베이스에 저장합니다. 신규 문의와 뉴스레터 신청은 Formspree 폴백을 통해 운영자에게 알릴 수 있습니다. 문의자 확인 메일과 실제 뉴스레터 발송은 Resend 연결 시 사용합니다.

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_REPLY_TO
CONTACT_NOTIFY_EMAIL
FORMSPREE_ENDPOINT
```

## 확장 프로그램 권한

Manifest V3이며 다음 권한만 사용합니다.

```json
{
  "permissions": ["storage", "tabs", "sidePanel"],
  "host_permissions": [
    "https://www.instagram.com/*",
    "https://unfollow.lavalabs.co.kr/*"
  ]
}
```

- `storage`: 스캔 명단, 작업 목록과 진행 상태
- `tabs`: 내 프로필과 선택한 작업 대상 프로필 이동
- `sidePanel`: 관계 스캔과 작업 제어 UI
- Instagram 호스트: 현재 화면의 프로필 링크와 버튼 확인
- 맞팔체커 호스트: 웹과 확장 프로그램 사이의 로컬 메시지 연결

## 빌드와 검증

`main`에 반영되면 GitHub Actions가 정적 사이트와 Companion ZIP을 생성합니다.

- 기존 ZIP 분석과 A·B 비교 회귀 검사
- Manifest V3, 최소 권한과 호스트 제한
- 스캐너의 쿠키·비공개 API 미사용 정적 검사
- 내 프로필 확인과 로그인·챌린지 안전 중지 검사
- DOM fixture를 이용한 팔로워·팔로잉 수집 검사
- 맞팔 아닌 차집합과 작업 큐 연결 검사
- 데스크톱·모바일 웹 결과 UI
- 가로 넘침과 Axe critical/serious 접근성 검사
- 기존 뉴스레터, 관리자, 캠페인과 모바일 UI 회귀 검사

## 주요 파일

- `extension/instagram-scan.js` — 내 프로필 확인, 목록 창 수집과 스크롤
- `extension/sidepanel.*` — 관계 스캔 결과와 작업 실행 UI
- `extension/background.js` — 로컬 상태와 웹 메시지 처리
- `extension/content-bridge.js` — 웹과 Companion 관계 상태 연결
- `assets/relationship-scan-v23.*` — 웹 관계 스캔 결과 UI
- `assets/automation-v22.*` — ZIP 분석 결과 작업 목록 UI
- `assets/automation-parser-v22.js` — A·B 비교 자동화 대상 계산
- `scripts/relationship-scan-v23-smoke.mjs` — 스캐너·웹 UI 자동 검사
- `scripts/build-v13.mjs` — 정적 페이지 결합과 v23 자산 검증
- `sw.js` — PWA 캐시와 네트워크 우선 업데이트

## 주의

맞팔체커는 Instagram 또는 Meta가 공식 제공하거나 제휴한 서비스가 아닙니다. Instagram 화면 구조와 정책은 변경될 수 있습니다. 스캔 결과를 검토하고 처음에는 소수 계정으로 시험한 뒤 사용해야 합니다.