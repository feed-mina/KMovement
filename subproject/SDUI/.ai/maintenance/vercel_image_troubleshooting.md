# Vercel 이미지 표시 문제 해결 가이드

**작성일**: 2026-03-03
**대상**: 프론트엔드 개발자
**목적**: Vercel 배포 환경에서 이미지가 표시되지 않는 문제 해결

---

## 문제 현황

**증상**:
- 로컬 개발 환경(localhost:3000)에서는 이미지가 정상 표시됨
- Vercel 배포 환경(https://yerin.duckdns.org)에서는 이미지가 깨지거나 표시되지 않음

**현재 구현**:
- 이미지 위치: `metadata-project/public/img/`
- 이미지 컴포넌트: `components/fields/ImageField.tsx`
- 렌더링 방식: 표준 HTML `<img>` 태그 사용

---

## 원인 분석

### 1. 현재 ImageField 구현 확인

```typescript
// components/fields/ImageField.tsx (현재 코드)
const label = meta?.label_text || meta?.labelText || "";
const imagePath = label ? `/img/${label}` : "/img/default.png";

return (
    <div className="image-field-wrapper">
        <img
            src={imagePath}
            className={mergedClassName}
            alt={meta?.altText || "ui-element"}
            style={{ width: "100%", height: "auto", display: "block" }}
        />
    </div>
);
```

**잠재적 문제점**:
1. Next.js `<Image>` 컴포넌트가 아닌 일반 `<img>` 태그 사용
2. Vercel에서 이미지 최적화 미적용
3. 파일명에 공백이 포함된 경우 URL 인코딩 문제 가능성

### 2. CSP 설정 확인

```typescript
// next.config.ts (현재 설정)
"img-src 'self' data: blob: https:"
```

**분석**:
- `'self'`: 같은 origin의 이미지 허용 ✅
- `data:`: data URI 스킴 허용 ✅
- `blob:`: blob URL 허용 ✅
- `https:`: 모든 HTTPS 이미지 허용 ✅

CSP 설정은 문제가 없습니다.

### 3. 이미지 파일 목록 확인

```bash
# metadata-project/public/img/
alarm.wav
back.png
bird.mp3
content_body.png
default.png
deno.png
dino_content.png
dino_diary2.png
dino_diary3.png
Eye off.png       # ⚠️ 공백 포함
Eye.png
favicon.png
favicon1.png
fire.png
kakao_login_bt.png
logo.svg
tomatoEmogi.png
toy.mp3
```

**문제점**:
- `Eye off.png`: 파일명에 공백이 있어 URL 인코딩 필요
- 오디오 파일(wav, mp3)과 이미지 파일이 혼재

---

## 해결 방법

### 방법 1: Next.js Image 컴포넌트 사용 (권장)

**장점**:
- Vercel에서 자동 이미지 최적화
- Lazy loading 기본 지원
- CLS (Cumulative Layout Shift) 방지
- WebP 자동 변환

**구현**:

```typescript
// components/fields/ImageField.tsx (수정)
'use client';

import React, { memo } from 'react';
import Image from 'next/image';  // ✅ Next.js Image 컴포넌트 import
import { cn } from "@/components/utils/cn";

const ImageField = memo(({ meta, pageData, ...rest }: any) => {
    const {
        onAction,
        pwType,
        showPassword,
        className: ignoredClassName,
        ...domSafeRest
    } = rest;

    const isReadOnly = meta?.isReadonly === true || meta?.isReadonly === "true" ||
        meta?.is_readonly === true || meta?.is_readonly === "true";

    const label = meta?.label_text || meta?.labelText || "";
    const imagePath = label ? `/img/${label}` : "/img/default.png";

    // ✅ 이미지 크기 지정 (필수)
    const width = meta?.width || 800;
    const height = meta?.height || 600;

    let customStyle = {};
    try {
        customStyle = typeof meta?.inlineStyle === 'string'
            ? JSON.parse(meta.inlineStyle)
            : (meta?.inlineStyle || {});
    } catch (e) {
        customStyle = {};
    }

    const mergedClassName = cn(
        "ui-image-element",
        meta?.cssClass,
        meta?.css_class,
        rest.className,
        isReadOnly && "is-readonly"
    );

    return (
        <div style={{ ...customStyle, width: "100%", position: "relative" }} className="image-field-wrapper">
            <Image
                src={imagePath}
                alt={meta?.altText || "ui-element"}
                width={width}
                height={height}
                className={mergedClassName}
                style={{ width: "100%", height: "auto" }}
                priority={meta?.priority || false}  // LCP 이미지는 true 설정
                quality={meta?.quality || 75}       // 화질 (1-100)
            />
        </div>
    );
});

ImageField.displayName = "ImageField";
export default ImageField;
```

**주의사항**:
- `width`와 `height`는 필수 속성입니다.
- 실제 이미지 크기를 정확히 모르는 경우, `fill` 속성 사용:

```typescript
// fill 속성 사용 (부모 div가 position: relative 필요)
<Image
    src={imagePath}
    alt={meta?.altText || "ui-element"}
    fill
    className={mergedClassName}
    style={{ objectFit: "contain" }}  // or "cover"
/>
```

### 방법 2: 파일명 공백 제거

**문제 파일**:
- `Eye off.png` → `eye-off.png`
- `Eye.png` → `eye.png`

**수정 방법**:

```bash
# metadata-project/public/img/ 디렉토리에서
cd metadata-project/public/img

# 파일명 변경
mv "Eye off.png" eye-off.png
mv "Eye.png" eye.png

# Git 커밋
git add .
git commit -m "fix: Rename image files to remove spaces"
git push origin lab/claude-dev
```

**ui_metadata 업데이트**:
```sql
-- label_text에서 파일명 수정
UPDATE ui_metadata
SET label_text = 'eye-off.png'
WHERE label_text = 'Eye off.png';

UPDATE ui_metadata
SET label_text = 'eye.png'
WHERE label_text = 'Eye.png';
```

### 방법 3: URL 인코딩 추가

**현재 코드 수정**:

```typescript
// components/fields/ImageField.tsx
const label = meta?.label_text || meta?.labelText || "";

// ✅ URL 인코딩 추가
const encodedLabel = label ? encodeURIComponent(label) : "";
const imagePath = encodedLabel ? `/img/${encodedLabel}` : "/img/default.png";
```

**결과**:
- `Eye off.png` → `/img/Eye%20off.png`

### 방법 4: 이미지 경로 검증 추가

**에러 핸들링 추가**:

```typescript
'use client';

import React, { memo, useState } from 'react';
import Image from 'next/image';
import { cn } from "@/components/utils/cn";

const ImageField = memo(({ meta, pageData, ...rest }: any) => {
    const [imageError, setImageError] = useState(false);

    const label = meta?.label_text || meta?.labelText || "";
    const imagePath = label ? `/img/${label}` : "/img/default.png";
    const fallbackImage = "/img/default.png";

    const handleImageError = () => {
        console.error(`Failed to load image: ${imagePath}`);
        setImageError(true);
    };

    return (
        <div className="image-field-wrapper">
            <Image
                src={imageError ? fallbackImage : imagePath}
                alt={meta?.altText || "ui-element"}
                width={800}
                height={600}
                className={mergedClassName}
                style={{ width: "100%", height: "auto" }}
                onError={handleImageError}  // ✅ 에러 핸들러
            />
        </div>
    );
});

export default ImageField;
```

---

## 디버깅 방법

### 1. Vercel 빌드 로그 확인

```
Vercel Dashboard → Deployments → 최근 배포 클릭 → Building 섹션
```

**확인 사항**:
- `public/img/` 폴더가 빌드에 포함되었는지
- 이미지 파일 경로가 올바른지

**예상 로그**:
```
Copying static files
  - public/img/back.png
  - public/img/default.png
  - public/img/logo.svg
  ...
```

### 2. 브라우저 개발자 도구 확인

**Chrome DevTools**:
1. F12 → Network 탭
2. Img 필터 선택
3. 페이지 새로고침
4. 이미지 요청 확인:
   - 상태 코드: 200 (성공), 404 (Not Found), 403 (Forbidden)
   - 요청 URL 확인

**Console 탭 확인**:
```
F12 → Console

# CSP 에러 예시 (발생 시):
Refused to load the image 'https://yerin.duckdns.org/img/logo.svg'
because it violates the following Content Security Policy directive: "img-src 'self'"
```

### 3. 실제 이미지 URL 직접 접근

**브라우저에서 직접 접근**:
```
https://yerin.duckdns.org/img/logo.svg
https://yerin.duckdns.org/img/default.png
```

**결과 분석**:
- **200 OK**: 이미지가 정상적으로 존재 → 코드 문제
- **404 Not Found**: 이미지 파일이 빌드에 포함되지 않음
- **403 Forbidden**: 보안 설정 문제

---

## 추가 최적화

### 1. next.config.ts에 이미지 도메인 추가 (외부 이미지)

```typescript
// next.config.ts
const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',  // 모든 외부 이미지 허용 (보안 주의!)
            },
        ],
        // 또는 특정 도메인만 허용
        domains: ['example.com', 'cdn.example.com'],
    },
    // ... 기존 설정
};
```

### 2. 이미지 포맷 최적화

**Vercel 자동 최적화 활용**:
```typescript
// next.config.ts
const nextConfig: NextConfig = {
    images: {
        formats: ['image/avif', 'image/webp'],  // 최신 포맷 우선
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    },
    // ... 기존 설정
};
```

### 3. 이미지 우선순위 설정

**중요한 이미지 (LCP)**:
```typescript
<Image
    src="/img/hero-image.png"
    alt="Hero"
    width={1200}
    height={600}
    priority  // ✅ LCP 이미지는 우선 로딩
/>
```

**일반 이미지**:
```typescript
<Image
    src="/img/content.png"
    alt="Content"
    width={800}
    height={600}
    loading="lazy"  // ✅ 기본값 (생략 가능)
/>
```

---

## 테스트 체크리스트

배포 후 다음 항목을 확인하세요:

- [ ] 모든 이미지가 Vercel에서 정상 표시되는가?
- [ ] 브라우저 콘솔에 CSP 에러가 없는가?
- [ ] Network 탭에서 이미지 요청이 200 상태인가?
- [ ] 모바일에서도 이미지가 정상 표시되는가?
- [ ] 이미지 로딩 속도가 적절한가? (LCP < 2.5s)
- [ ] WebP 포맷으로 자동 변환되는가? (Next.js Image 사용 시)

---

## 권장 사항

### 즉시 적용 (우선순위 높음)

1. **파일명 공백 제거**
   ```bash
   mv "Eye off.png" eye-off.png
   mv "Eye.png" eye.png
   ```

2. **Next.js Image 컴포넌트 사용**
   - ImageField.tsx에서 `<img>` → `<Image>` 변경
   - width, height 속성 추가

### 선택적 적용

1. **에러 핸들링 추가**
   - onError 핸들러로 fallback 이미지 표시

2. **이미지 최적화 설정**
   - next.config.ts에 formats, deviceSizes 설정

---

## 참고 자료

- **Next.js Image 공식 문서**: https://nextjs.org/docs/app/api-reference/components/image
- **Vercel 이미지 최적화**: https://vercel.com/docs/image-optimization
- **CSP img-src 지시문**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/img-src

---

**문서 관리**:
 
- 최종 업데이트: 2026-03-03
- 다음 리뷰 예정일: 2026-04-03
