This is a [Next.js](https://nextjs.org) project bootstrapped with [
`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## KRIDE Focus Maps

The Focus route map can render with Kakao Maps or Google Maps. Add these values to `.env.local` when testing the native providers:

```env
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_KRIDE_MAP_DEFAULT_PROVIDER=kakao
```

If the provider key is missing, the Focus map falls back to the existing Leaflet/OpenStreetMap renderer so the page remains usable locally.

## SEO and privacy-safe analytics

Set these values in the deployment environment. Analytics scripts are not loaded until the visitor grants statistics consent; missing IDs keep analytics disabled.

```env
NEXT_PUBLIC_SITE_URL=https://example.com
NEXT_PUBLIC_SITE_ENV=production
GOOGLE_SITE_VERIFICATION=
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_CLARITY_ID=
```

Configure the GA4 tag inside the GTM container with a Data Layer Variable named `ga_measurement_id`; the application supplies `NEXT_PUBLIC_GA_MEASUREMENT_ID` through that variable. Preview and staging deployments should set `NEXT_PUBLIC_SITE_ENV=staging` so `robots.txt` blocks indexing. After deployment, submit `/sitemap.xml` in Google Search Console and verify GTM Preview, GA4 DebugView, and the Clarity consent state.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically
optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions
are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use
the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)
from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for
more details.
