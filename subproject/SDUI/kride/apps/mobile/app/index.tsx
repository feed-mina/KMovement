import { Redirect } from 'expo-router';

// The dynamic `[screenId]` route matches `/<screenId>` but not the root `/`.
// Send the initial launch to MAIN_PAGE so the app lands on a real screen.
export default function Index() {
  return <Redirect href="/MAIN_PAGE" />;
}
