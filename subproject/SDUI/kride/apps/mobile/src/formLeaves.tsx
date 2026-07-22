import type React from 'react';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { SduiLeafProps } from '@kride/core';

const EMAIL_DOMAINS = ['naver.com', 'gmail.com', 'nate.com', 'hanmail.net'];

const textValue = (value: unknown) => (value == null ? '' : String(value));

const truthyReadonly = (meta: any) =>
  meta?.isReadonly === true ||
  meta?.isReadonly === 'true' ||
  meta?.is_readonly === true ||
  meta?.is_readonly === 'true';

const fieldKey = (id: string | undefined, meta: any) =>
  String(meta?.ref_data_id || meta?.refDataId || meta?.componentId || meta?.component_id || id || '');

const labelFor = (meta: any, fallback: string) =>
  textValue(meta?.placeholder || meta?.labelText || meta?.label_text || fallback);

const inputClassName =
  'min-h-12 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-950';

type MobileInputLeafProps = SduiLeafProps & {
  formData?: Record<string, unknown>;
};

export const InputLeaf: React.FC<MobileInputLeafProps> = ({ id, meta, data, formData, onChange }) => {
  const key = fieldKey(id, meta);
  const value = textValue(formData?.[key] ?? (data && typeof data === 'object' ? data[key] : data));
  const isReadonly = truthyReadonly(meta);
  const isEmail = key.toLowerCase().includes('email');
  const isPhone = key.toLowerCase().includes('phone');

  return (
    <TextInput
      className={`${inputClassName} ${isReadonly ? 'bg-gray-100 text-gray-500' : ''}`}
      value={value}
      editable={!isReadonly}
      placeholder={labelFor(meta, 'Enter value')}
      placeholderTextColor="#9ca3af"
      autoCapitalize="none"
      keyboardType={isEmail ? 'email-address' : isPhone ? 'phone-pad' : 'default'}
      textContentType={isEmail ? 'emailAddress' : isPhone ? 'telephoneNumber' : 'none'}
      onChangeText={(next) => {
        if (!isReadonly) onChange?.(key, next);
      }}
    />
  );
};

export const PasswordLeaf: React.FC<MobileInputLeafProps> = ({ id, meta, data, formData, onChange, onAction }) => {
  const key = fieldKey(id, meta);
  const value = textValue(formData?.[key] ?? (data && typeof data === 'object' ? data[key] : data));
  const isReadonly = truthyReadonly(meta);
  const [visible, setVisible] = useState(false);

  return (
    <View className="w-full flex-row items-center rounded-xl border border-gray-300 bg-white">
      <TextInput
        className="min-h-12 flex-1 px-4 py-3 text-base text-gray-950"
        value={value}
        editable={!isReadonly}
        secureTextEntry={!visible}
        placeholder={labelFor(meta, 'Password')}
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        textContentType="password"
        onChangeText={(next) => {
          if (!isReadonly) onChange?.(key, next);
        }}
        onSubmitEditing={() => {
          if (!isReadonly) onAction?.(meta);
        }}
      />
      {!isReadonly ? (
        <Pressable
          className="px-4 py-3"
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          onPress={() => setVisible((current) => !current)}
        >
          <Text className="text-sm font-semibold text-kride">{visible ? 'Hide' : 'Show'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

/**
 * EMAIL_SELECT deliberately ignores `is_readonly`, matching the web's
 * EmailSelectField which never reads it. The LOGIN_PAGE seed marks
 * `user_email_domain` readonly, which would otherwise leave the domain
 * unselectable and make login unreachable.
 */
export const EmailSelectLeaf: React.FC<MobileInputLeafProps> = ({ id, meta, formData, onChange }) => {
  const key = fieldKey(id, meta);
  const value = textValue(formData?.[key]);
  const [custom, setCustom] = useState(value && !EMAIL_DOMAINS.includes(value));

  const choose = (next: string) => {
    setCustom(false);
    onChange?.(key, next);
  };

  return (
    <View className="w-full gap-2">
      {/* Users kept typing the whole address into the ID field and then also
          picking a domain, producing `id@naver.com@naver.com` → a 401 that
          looks like a wrong password. The hint + leading "@" make it clear the
          ID field holds only the local part and the domain is chosen here. */}
      <Text className="text-xs text-gray-500">아이디는 @ 앞부분만 입력하세요</Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="px-1 text-base font-semibold text-gray-500">@</Text>
        {EMAIL_DOMAINS.map((domain) => {
          const selected = value === domain;
          return (
            <Pressable
              key={domain}
              className={`rounded-full border px-3 py-2 ${selected ? 'border-kride bg-kride' : 'border-gray-300 bg-white'}`}
              accessibilityRole="button"
              onPress={() => choose(domain)}
            >
              <Text className={`text-sm ${selected ? 'font-semibold text-white' : 'text-gray-700'}`}>{domain}</Text>
            </Pressable>
          );
        })}
        <Pressable
          className={`rounded-full border px-3 py-2 ${custom ? 'border-kride bg-kride' : 'border-gray-300 bg-white'}`}
          accessibilityRole="button"
          onPress={() => {
            setCustom(true);
            if (EMAIL_DOMAINS.includes(value)) onChange?.(key, '');
          }}
        >
          <Text className={`text-sm ${custom ? 'font-semibold text-white' : 'text-gray-700'}`}>직접 입력</Text>
        </Pressable>
      </View>
      {custom ? (
        <TextInput
          className={inputClassName}
          value={EMAIL_DOMAINS.includes(value) ? '' : value}
          placeholder="예: kakao.com"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(next) => onChange?.(key, next)}
        />
      ) : null}
    </View>
  );
};

export const ActionButtonLeaf: React.FC<SduiLeafProps> = ({ meta, data, onAction }) => {
  const label = textValue(meta?.labelText || meta?.label_text || 'Continue');
  const cssClass = textValue(meta?.cssClass || meta?.css_class);
  const isReadonly = truthyReadonly(meta);
  const isKakao = cssClass.includes('kakao');
  const isOutline = cssClass.includes('signup') || cssClass.includes('secondary');
  const containerClassName = [
    'min-h-12 w-full items-center justify-center rounded-xl px-4 py-3',
    isKakao ? 'bg-[#FEE500]' : isOutline ? 'border border-kride bg-white' : 'bg-kride',
    isReadonly ? 'opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      className={containerClassName}
      disabled={isReadonly}
      accessibilityRole="button"
      onPress={() => {
        if (!isReadonly) onAction?.(meta, data);
      }}
    >
      <Text className={`text-center font-bold ${isKakao || isOutline ? 'text-gray-950' : 'text-white'}`}>{label}</Text>
    </Pressable>
  );
};
