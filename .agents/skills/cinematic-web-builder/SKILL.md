---
name: cinematic-web-builder
description: Plan, build, and visually verify cinematic landing pages and hero sections with motion or background media. Use for requests such as 여행 예고편 같은 첫 화면, 시네마틱 랜딩, or cinematic hero redesign. Apply the repository's existing UI and deployment conventions.
---

# Cinematic web builder

1. Read the repository instructions and identify the target page, its current UI components, and its primary action. Record a brief with the audience, desired mood, primary action, selected design reference, media, and motion.
2. Select a direction from the recipes below or an explicit user reference. Use the reference for composition and pacing. Write original copy and reuse existing site components and styles where practical.
3. Check project-owned media or user-approved sources. Track source, permitted use, orientation, focal point, and fallback image. Prefer a landscape wide shot for a background and a portrait-safe focal point for mobile. If permitted footage is unavailable, use an approved still or a CSS gradient. Keep the primary action legible on every frame.
4. Implement in the requested scope. Keep the existing primary button behavior and authentication flow. Use a poster or separate still for slow loading and failed playback. Provide a pause mechanism for persistent moving content where required and render a still when reduced motion is requested. Keep optional motion separate from essential content.
5. Run relevant repository checks and open a local or preview build in an available browser. Capture screenshots at representative mobile and desktop widths, such as 390 and 1440 CSS pixels. Inspect text contrast, clipping, horizontal overflow, the primary action above the fold, media crop and fallback. Exercise the primary button, media failure, and reduced-motion behavior. Fix observed issues and repeat the affected checks. Report blocked checks explicitly when a browser or runtime is unavailable.
6. Return the preview location, verified results, selected media and its source, and any remaining work. Deploy only on request.

## Design recipes

| Direction | Composition | Media and motion |
| --- | --- | --- |
| Travel trailer | Full-width scenery, short left-aligned headline, one primary button | Wide establishing shot or scenic still. Slow scale and a static dark overlay |
| Editorial product | Oversized headline beside a framed product photo, small detail line beneath | A still with space around the product. One short entrance |
| Guided discovery | Headline and button above a row of destination cards, clear mobile stack | Three stills with a consistent crop. Small card lift on hover and keyboard focus |

## Motion examples

Use classes selectively and place the scale animation on a visual layer whose parent clips overflow. Keep text and buttons on a separate layer. Adapt duration and color to the project.

```css
@media (prefers-reduced-motion: no-preference) {
  .scenic-still {
    animation: scenic-scale 7s ease-out both;
  }

  .intro-copy {
    animation: copy-enter 450ms ease-out both;
  }

  .destination-card {
    transition: transform 180ms ease-out;
  }

  .destination-card:hover,
  .destination-card:focus-within {
    transform: translateY(-4px);
  }
}

@keyframes scenic-scale {
  from { transform: scale(1); }
  to { transform: scale(1.06); }
}

@keyframes copy-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

For KMovement, start with the home page hero and test the existing 코스 만들기 behavior. Keep the video choice optional so a locally available still can support the first preview.
