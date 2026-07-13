import React from 'react';

export type PrimitiveProps = {
  className?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
};

/** Platform-neutral primitive contract. Web adapters render HTML; RN adapters render View/Text/Pressable. */
export type PrimitiveRegistry = {
  Box: React.ComponentType<PrimitiveProps>;
  Txt: React.ComponentType<PrimitiveProps>;
  Btn: React.ComponentType<PrimitiveProps>;
};

export const webPrimitives: PrimitiveRegistry = {
  Box: ({ className, children, onPress, testID }) => <div className={className} onClick={onPress} data-testid={testID}>{children}</div>,
  Txt: ({ className, children, testID }) => <span className={className} data-testid={testID}>{children}</span>,
  Btn: ({ className, children, onPress, testID }) => <button className={className} onClick={onPress} data-testid={testID}>{children}</button>,
};
