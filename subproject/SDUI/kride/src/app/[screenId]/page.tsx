import { notFound, redirect } from "next/navigation";

const SCREEN_ROUTES: Record<string, string> = {
  KRIDE_INTRO1: "/browse",
  KRIDE_INTRO2: "/movies",
  KRIDE_INTRO3: "/latest",
  KRIDE_INTRO4: "/intro4",
  KRIDE_INTRO5: "/intro5",
  KRIDE_FOCUS: "/focus",
  KRIDE_MY_LIST: "/my-list",
  KPOP_EXPLORE: "/kpop",
  KPOP_ARTIST_DETAIL: "/kpop/artists",
  KPOP_EVENTS: "/kpop/events",
  KPOP_EVENT_DETAIL: "/kpop/event",
};

export default function ScreenIdPage({
  params,
}: {
  params: { screenId: string };
}) {
  const route = SCREEN_ROUTES[params.screenId];

  if (!route) {
    notFound();
  }

  redirect(route);
}
