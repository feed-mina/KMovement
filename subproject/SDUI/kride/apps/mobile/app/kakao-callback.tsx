import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useSessionStore } from '@kride/core';

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? '' : value ?? '';

/**
 * Deep-link target for Kakao OAuth: the server's /api/kakao/callback answers
 * `state=app` logins with a 302 to `kride://kakao-callback?accessToken=…`,
 * which lands here. Persist the session, then continue into the app.
 */
export default function KakaoCallback() {
  const params = useLocalSearchParams<{
    accessToken?: string | string[];
    refreshToken?: string | string[];
    role?: string | string[];
  }>();
  const accessToken = first(params.accessToken);
  const refreshToken = first(params.refreshToken);
  const role = first(params.role);
  const [stored, setStored] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void useSessionStore
      .getState()
      .setSession({ accessToken, refreshToken: refreshToken || null, role: role || null })
      .finally(() => {
        if (!cancelled) setStored(true);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshToken, role]);

  if (!accessToken) return <Redirect href="/LOGIN_PAGE" />;
  if (!stored) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>카카오 로그인 처리 중…</Text>
      </View>
    );
  }
  return <Redirect href="/MAIN_PAGE" />;
}
