# Cart - Development Log

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | Cart (쇼핑 리스트 PWA) |
| 목적 | 광고 없는 개인용 쇼핑 리스트 앱 |
| 기술 스택 | Vanilla JS, Firebase (Auth + Firestore), PWA |
| 호스팅 | GitHub Pages (superrmoon/cart, Private) |
| URL | https://superrmoon.github.io/cart/ |
| Firebase | cart-f42c2 (Spark 무료 플랜) |

---

## 핵심 기능

### 1. 쇼핑 리스트 관리
- 목록 생성 / 수정 / 삭제
- 품목 추가 (이름, 날짜, 금액)
- 품목 완료 체크 (체크박스)
- 완료 품목 숨김/보이기 토글
- 목록별 총금액 표시 (미완료 품목 합계)

### 2. 기기 간 동기화
- Google 계정 로그인
- Firestore 실시간 동기화 (iPhone, iPad, Mac)
- 오프라인 지원 (Firestore persistence)

### 3. URL API (토큰 기반)
- 로그인 없이 URL 호출로 품목 추가 가능
- iOS Shortcuts 연동 지원
- API inbox 패턴으로 보안 유지

---

## 파일 구조

```
cart/
├── index.html          # Single page HTML
├── style.css           # Stylesheet
├── app.js              # App logic (UI, events, URL API)
├── firebase-config.js  # Firebase initialization
├── firebase-auth.js    # Google OAuth (direct redirect)
├── firebase-db.js      # Firestore CRUD + token + inbox
├── firestore.rules     # Firestore security rules
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (cache + offline)
├── docs/               # Documentation
│   └── development-log.md
└── icons/
    ├── icon.svg
    ├── icon-192.png
    └── icon-512.png
```

---

## 기술 결정 사항

### PWA 선택 (vs 네이티브 앱)
- Apple Developer 등록 불필요 (연 $99 절약)
- 7일 재설치 제한 없음
- Safari 홈 화면 추가로 앱처럼 사용

### Firebase 선택 (동기화 서비스)
- 무료 플랜으로 개인 사용 충분 (읽기 5만/일, 쓰기 2만/일)
- 서버 운영 불필요
- 실시간 동기화 지원

### Google OAuth Direct Redirect 방식
- Firebase 내장 signInWithRedirect/signInWithPopup은 iOS Safari ITP 정책으로 동작 불가
- Google OAuth 2.0 Implicit Flow로 직접 구현
- redirect_uri 하드코딩: `https://superrmoon.github.io/cart/`
- CSRF 보호: state 파라미터 + sessionStorage 검증

### API Inbox 패턴
- URL API 호출 시 Firestore에 직접 쓰기 불가 (인증 없음)
- `api_inbox` 컬렉션에 임시 저장 → 로그인 시 실제 목록으로 이동
- 보안 규칙: 유효한 토큰이 존재하는 경우에만 inbox 생성 허용

---

## 개발 이력

### Phase 1: 기본 PWA (2026-03-23)
- `03e9c99` 초기 Shopping List PWA 구현
- HTML/CSS/JS로 기본 쇼핑 리스트 기능 구현
- Service Worker + localStorage 오프라인 지원
- GitHub Pages 배포

### Phase 2: Firebase 연동 (2026-03-23)
- `5b1717a` Firebase Auth (Google) + Firestore 통합
- `a252ff8` 중복 데이터 입력 버그 수정 (localStorage + Firestore 이중 저장 문제)
- `8c2fad1` 더블 클릭 중복 방지 (isSaving flag)

### Phase 3: iOS Safari 인증 해결 (2026-03-23 ~ 03-25)
- Firebase signInWithRedirect → iOS Safari ITP로 인해 실패
- Firebase signInWithPopup → iOS에서 새 탭 열림, 결과 미전달
- Google Identity Services (GIS) → 팝업 차단
- **최종 해결**: Google OAuth 2.0 Implicit Flow 직접 구현
- `d9a32eb` direct OAuth redirect 방식 적용
- `e93a688` redirect_uri 하드코딩으로 iOS mismatch 해결

### Phase 4: 코드 리뷰 및 보완 (2026-03-25)
- `db7b489` 전체 코드 리뷰 기반 수정
  - Service Worker: navigation network-first 전략
  - 입력값 검증 (금액 음수 방지)
  - iOS 텍스트 선택 방지 (-webkit-user-select: none)
  - 에러 피드백 UI 추가
- `88467c2` 추가 리뷰 항목 수정

### Phase 5: URL API + 토큰 (2026-03-25)
- `1754ac0` 토큰 기반 URL API 구현
  - 설정 모달 (토큰 생성/삭제/복사)
  - URL 파라미터 처리 (action, token, list, name, amount, date)
- `51248fb` API inbox 패턴 도입 (인증 없이 항목 추가)
- `9b95283` API 호출 시 enablePersistence 건너뛰기 (행 방지)

---

## iOS Shortcuts 연동

### Automation: Auto Pay to Cart

자동납부 문자 수신 시 Cart에 자동 등록하는 단축어.

**트리거**: Message Contains `자동납부`

**문자 형식**:
```
[Web발신]
[현대카드] 자동납부 승인 문*식님 인천도시가스자동이체 137,330원
```

**정규식**: `님 (.+?) ([\d,]+)원`
- Group 1: 품목명 (인천도시가스자동이체)
- Group 2: 금액 (137,330)

**URL 호출**:
```
https://superrmoon.github.io/cart/?token={TOKEN}&action=add&list=자동납부&name={ItemName}&amount={Amount}
```

---

## Firestore 데이터 구조

```
users/{uid}/
├── lists/{listId}
│   ├── name: string
│   ├── createdAt: string (YYYY-MM-DD)
│   ├── updatedAt: serverTimestamp
│   └── items: array
│       └── { id, name, date, amount, completed }
└── tokens/{tokenId}
    ├── token: string
    └── createdAt: serverTimestamp

tokens/{tokenValue}
├── uid: string
└── createdAt: serverTimestamp

api_inbox/{docId}
├── token: string
├── uid: string
├── listName: string
├── item: { id, name, date, amount, completed }
└── createdAt: serverTimestamp
```

---

## 보안 규칙 요약

| 컬렉션 | 읽기 | 쓰기 | 조건 |
|--------|------|------|------|
| `users/{uid}/lists` | 본인만 | 본인만 | auth.uid == userId |
| `users/{uid}/tokens` | 본인만 | 본인만 | auth.uid == userId |
| `tokens/{id}` | 누구나 | 본인만 | 생성/삭제 시 auth 필요 |
| `api_inbox/{id}` | 본인만 | 누구나 | 생성 시 유효 토큰 필요 |

---

## 알려진 제한 사항

1. **PWA 캐시**: 코드 업데이트 시 홈 화면 PWA 삭제 → 재설치 필요할 수 있음
2. **Safari ITP**: Firebase 내장 인증 방식 사용 불가, direct OAuth만 동작
3. **오프라인 동기화**: Firestore persistence에 의존, 별도 Background Sync 없음
4. **동시 편집**: Last-write-wins 방식, 충돌 해결 없음
5. **API inbox**: 로그인 후 앱 열어야 inbox 항목이 실제 목록으로 이동
