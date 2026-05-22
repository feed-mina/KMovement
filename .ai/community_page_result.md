# K-Ride Community Page Result

## Summary

Implemented a frontend community page flow for K-Ride using the existing community backend API.

Routes now supported:

- `/view/COMMUNITY_LIST`
- `/view/COMMUNITY_WRITE`
- `/view/COMMUNITY_DETAIL/{postId}`
- `/view/COMMUNITY_MODIFY/{postId}`

Main features:

- Community post list with thumbnail preview
- Post create/edit form
- Multiple image upload with preview
- Existing image display on detail page
- Existing image retention/removal on edit page
- Like, report, follow, edit, and delete actions
- Sidebar link to the community page

## Main Code

Frontend page:

- `subproject/SDUI/metadata-project/components/community/CommunityPage.tsx`

Route wiring:

- `subproject/SDUI/metadata-project/app/view/[...slug]/page.tsx`
- `subproject/SDUI/metadata-project/components/constants/screenMap.ts`

API helper:

- `subproject/SDUI/metadata-project/services/communityService.ts`

Style:

- `subproject/SDUI/metadata-project/app/styles/pages.css`

Navigation:

- `subproject/SDUI/metadata-project/components/layout/Sidebar.tsx`

## Backend Already Used

The backend community API already supports multipart image upload:

- `POST /api/v1/community/posts`
- `PATCH /api/v1/community/posts/{postId}`
- `GET /api/v1/community/posts/{postId}`

Image URLs are returned in:

```ts
post.images[].storageUrl
```

This can later be used as input for the image-to-video AI model.

## Verification

Passed frontend community service tests:

- `tests/services/communityService.test.ts`
- `tests/services/communityServiceFormData.test.ts`

Result:

- 2 test suites passed
- 11 tests passed

Browser verification was also run with the local backend and Next app:

- Backend API: `http://localhost:8080/api/v1/community/posts?page=0&size=5`
- Frontend page: `http://localhost:3000/view/COMMUNITY_LIST`
- Playwright config: `subproject/SDUI/metadata-project/playwright.community.config.ts`
- Playwright test: `subproject/SDUI/metadata-project/tests/e2e/community-visual-check.test.ts`

Result:

- 2 Playwright tests passed
- List and detail read an image-backed post from the local backend DB
- Write form image picker preview was verified with a mocked `/api/auth/me` session
- Modify form retained-image display was verified with a mocked `/api/auth/me` session

Screenshots:

- `.ai/screenshots/community-list-playwright.png`
- `.ai/screenshots/community-detail-playwright.png`
- `.ai/screenshots/community-write-upload-preview.png`
- `.ai/screenshots/community-modify-retained-image.png`

Note: full authenticated submit could not be completed because local login currently fails with Redis unavailable (`RedisConnectionFailureException`). Docker Compose build/up was not run or changed during this check.
