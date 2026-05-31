# CSS를 이용한 아티스트 이미지 강제 적용 가이드 (방법 B)

본 문서는 백엔드 데이터베이스를 수정할 수 없는 상황에서 오직 **프론트엔드의 CSS**만을 이용해 INTRO2 화면의 아티스트 동그라미에 이미지를 강제로 입히는 방법을 안내합니다.

> [!WARNING]
> 이 방식은 CSS의 `:nth-child` 속성을 이용해 **현재 보여지는 순서대로** 배경 이미지를 덮어씌우는 방식입니다. 향후 백엔드 데이터베이스에서 아티스트 목록의 순서가 변경되거나 항목이 추가/삭제될 경우, 엉뚱한 아티스트에게 이미지가 적용될 수 있으므로 유지보수에 각별한 주의가 필요합니다.

---

## 1. 적용 위치
- **파일 경로:** `G:\kride-project\subproject\SDUI\metadata-project\app\styles\KRIDE.css`
- **수정 방법:** 파일의 가장 하단(맨 끝)에 아래의 CSS 코드를 복사하여 붙여넣으세요.

## 2. CSS 적용 코드

현재 `public/artists` 폴더에 존재하는 이미지 파일명과, 실제 앱 화면에 노출되는 아티스트 순서를 1:1로 매칭한 CSS 코드입니다.

```css
/* ========================================================
   INTRO2 화면 아티스트 이미지 강제 적용 (CSS Fallback)
   ======================================================== */

/* 1. BTS */
.kride-artist-grid > div:nth-child(1) .card-image-wrapper {
    background-image: url('/artists/BTS.png');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(1) .card-image-wrapper span { display: none; }

/* 2. BLACKPINK */
.kride-artist-grid > div:nth-child(2) .card-image-wrapper {
    background-image: url('/artists/BLACKPINK.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(2) .card-image-wrapper span { display: none; }

/* 3. EXO */
.kride-artist-grid > div:nth-child(3) .card-image-wrapper {
    background-image: url('/artists/EXO.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(3) .card-image-wrapper span { display: none; }

/* 4. TWICE */
.kride-artist-grid > div:nth-child(4) .card-image-wrapper {
    background-image: url('/artists/TWICE.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(4) .card-image-wrapper span { display: none; }

/* 5. SEVENTEEN */
.kride-artist-grid > div:nth-child(5) .card-image-wrapper {
    background-image: url('/artists/SEVENTEEN.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(5) .card-image-wrapper span { display: none; }

/* 7. Stray Kids */
.kride-artist-grid > div:nth-child(7) .card-image-wrapper {
    background-image: url('/artists/Stray Kids.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(7) .card-image-wrapper span { display: none; }

/* 8. IVE */
.kride-artist-grid > div:nth-child(8) .card-image-wrapper {
    background-image: url('/artists/IVE.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(8) .card-image-wrapper span { display: none; }

/* 11. NCT 127 (이미지 파일: NCT.jpg) */
.kride-artist-grid > div:nth-child(11) .card-image-wrapper {
    background-image: url('/artists/NCT.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(11) .card-image-wrapper span { display: none; }

/* 12. Red Velvet */
.kride-artist-grid > div:nth-child(12) .card-image-wrapper {
    background-image: url('/artists/Red Velvet.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(12) .card-image-wrapper span { display: none; }

/* 14. MAMAMOO */
.kride-artist-grid > div:nth-child(14) .card-image-wrapper {
    background-image: url('/artists/MAMAMOO.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(14) .card-image-wrapper span { display: none; }

/* 16. TXT */
.kride-artist-grid > div:nth-child(16) .card-image-wrapper {
    background-image: url('/artists/TXT.png');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(16) .card-image-wrapper span { display: none; }

/* 18. ITZY */
.kride-artist-grid > div:nth-child(18) .card-image-wrapper {
    background-image: url('/artists/ITZY.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(18) .card-image-wrapper span { display: none; }

/* 21. SHINee */
.kride-artist-grid > div:nth-child(21) .card-image-wrapper {
    background-image: url('/artists/SHINee.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(21) .card-image-wrapper span { display: none; }

/* 25. BTOB */
.kride-artist-grid > div:nth-child(25) .card-image-wrapper {
    background-image: url('/artists/BTOB.jpg');
    background-size: cover;
    background-position: center;
}
.kride-artist-grid > div:nth-child(25) .card-image-wrapper span { display: none; }
```

> [!TIP]
> 위 목록에서 누락된 번호들(예: 6번 aespa, 9번 NewJeans 등)은 현재 `public/artists` 폴더 내에 일치하는 이미지 파일이 없기 때문에 제외되었습니다. 추후 이미지가 추가된다면, 위 패턴을 응용하여 해당 순번에 맞는 코드를 추가해 주시면 됩니다.

---

## 3. 적용 확인
CSS 코드를 추가한 후 프론트엔드 프로젝트를 재실행하거나 브라우저를 새로고침하시면, 각 순서에 맞게 기존의 첫 글자(Initial)가 사라지고 배경 이미지가 노출되는 것을 확인하실 수 있습니다.
