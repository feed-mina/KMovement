import { Pressable, Text, View } from 'react-native';
import type { PrimitiveRegistry } from '@kride/core';

const CLASS_MAP: Record<string, string> = {
  'engine-container': 'w-full',
  'content-area': 'w-full gap-4',
  'flex-row-layout': 'flex-row flex-wrap',
  'flex-col-layout': 'flex-col',
  'text-field': 'text-base text-gray-900',
  'btn-field': 'min-h-12 items-center justify-center rounded-xl px-4 py-3',
  'content-btn': 'min-h-12 items-center justify-center rounded-xl px-4 py-3',

  MAIN_SECTION: 'min-h-full w-full items-center justify-center gap-3',
  LOGIN_SECTION: 'w-full gap-4',
  SNS_SECTION: 'mt-4 w-full gap-3',
  EMAIL_SUB_GROUP: 'w-full gap-2',
  PW_SUB_GROUP: 'w-full gap-2',
  'group-LOGIN_SECTION': 'w-full gap-4',
  'group-SNS_SECTION': 'mt-4 w-full gap-3',
  'group-EMAIL_SUB_GROUP': 'w-full gap-2',
  'group-PW_SUB_GROUP': 'w-full gap-2',

  label_email: 'text-sm font-semibold text-gray-700',
  label_pw: 'text-sm font-semibold text-gray-700',
  login_form: 'w-full gap-3',
  'login_form-input': 'w-full',
  login_form_button: 'mt-2 bg-kride',
  'signup-nav': 'mt-3 border border-kride bg-transparent',
  'kakao-button': 'mt-3 bg-[#FEE500]',

  'main-bento': 'w-full flex-row flex-wrap gap-3 bg-[#fff7f2] p-4',
  'bento-card': 'min-h-36 rounded-2xl p-5',
  'bento-card-appointment': 'border border-gray-200 bg-white',
  'bento-card-no-goal': 'items-center justify-center gap-3 border border-[#f5d9d2] bg-[#fff7f2]',
  'bento-card-content': 'justify-between bg-kride',
  'bento-card-login': 'justify-between bg-[#8B0610]',
  'bento-card-dark': 'justify-between bg-gray-950',
  'bento-card-title': 'text-lg font-bold text-white',
  'bento-card-desc': 'text-sm text-white/80',
  'bento-card-icon': 'text-2xl text-white',
  'bento-card-arrow': 'mt-3 self-start rounded-full bg-white/20 px-3 py-2',
  'bento-card-tag': 'self-start rounded-full bg-white/15 px-3 py-1',
  'col-span-2': 'w-full',
  'col-span-3': 'w-full',

  // MAIN_PAGE KRIDE hero card (V51). The web renders these via custom CSS in
  // metadata-project/app/styles/pages.css, which NativeWind can't read — so the
  // card fell back to unstyled black-on-white text. Translate to utilities here.
  // The web background is a red-glow gradient on near-black; a multi-stop
  // gradient isn't expressible as a className, so approximate with a solid dark
  // fill. (`bento-card` already supplies rounded corners, min height, padding.)
  'bento-card-kride': 'justify-center bg-[#1a0a0c]',
  'bento-card-kride__kicker': 'font-mono text-[11px] uppercase tracking-widest text-kride',
  'bento-card-kride__title': 'my-1 text-3xl font-extrabold leading-tight text-white',
  'bento-card-kride__desc': 'text-[13px] leading-relaxed text-white/70',
  'bento-card-kride__cta': 'mt-4 self-start rounded-full bg-kride px-[18px] py-[10px]',

  'diary-nav1': 'my-2 w-full max-w-[300px] bg-kride',
  'diary-nav2': 'my-2 w-full max-w-[300px] border border-kride bg-white',
  'diary-btn-primary': 'mb-3 w-[250px] bg-kride',
  'diary-btn-secondary': 'mb-3 w-[250px] border border-kride bg-white',
};

const translateClassName = (className?: string) => {
  if (!className) return undefined;
  const translated = className
    .split(/\s+/)
    .flatMap((name) => (CLASS_MAP[name] || name).split(/\s+/))
    .filter(Boolean);
  return Array.from(new Set(translated)).join(' ');
};

const buttonTextClassName = (className?: string) => {
  const names = new Set((className || '').split(/\s+/).filter(Boolean));
  if (names.has('kakao-button') || names.has('signup-nav') || names.has('diary-nav2') || names.has('diary-btn-secondary')) {
    return 'text-center font-bold text-gray-950';
  }
  return 'text-center font-bold text-white';
};

/**
 * React Native implementations of the platform-neutral primitive contract.
 * className is resolved by NativeWind, keeping the server's `css_class` contract
 * identical to the web renderer.
 */
export const rnPrimitives: PrimitiveRegistry = {
  Box: ({ className, children, onPress, testID }) =>
    onPress ? (
      <Pressable className={translateClassName(className)} onPress={onPress} testID={testID}>
        {children}
      </Pressable>
    ) : (
      <View className={translateClassName(className)} testID={testID}>
        {children}
      </View>
    ),
  Txt: ({ className, children, testID }) => (
    <Text className={translateClassName(className)} testID={testID}>
      {children}
    </Text>
  ),
  Btn: ({ className, children, onPress, testID }) => (
    <Pressable className={translateClassName(className)} onPress={onPress} testID={testID}>
      <Text className={buttonTextClassName(className)}>{children}</Text>
    </Pressable>
  ),
};
