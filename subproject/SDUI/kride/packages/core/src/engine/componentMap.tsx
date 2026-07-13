'use client';
import React from "react";
import type { PrimitiveRegistry } from "./primitives";

/** Props every SDUI leaf component receives from the engine. Platform-neutral. */
export type SduiLeafProps = {
  id?: string;
  meta?: any;
  data?: any;
  onChange?: (id: string, value: any) => void;
  onAction?: (meta: any, data?: any) => void;
  [key: string]: any;
};

/** A platform-owned registry mapping `component_type` → leaf component. */
export type ComponentRegistry = Record<string, React.ComponentType<SduiLeafProps>>;

/**
 * Platform-neutral base leaves (GROUP/TEXT/BUTTON) built from injected primitives.
 * Web injects webPrimitives (span/button); mobile injects RN primitives (Text/Pressable).
 * Platform-specific leaves (images, maps, sliders …) are merged on top by each app.
 */
export function createBaseComponentMap(primitives: PrimitiveRegistry): ComponentRegistry {
  const { Txt, Btn } = primitives;

  const GroupComponent: React.FC<SduiLeafProps> = ({ children }) =>
    (children as React.ReactElement) ?? null;

  const TextField: React.FC<SduiLeafProps> = ({ meta, data }) => {
    const text =
      typeof data === "string"
        ? data
        : data?.[meta?.componentId || meta?.component_id] ??
          meta?.labelText ??
          meta?.label_text ??
          "";
    return <Txt className={`text-field ${meta?.cssClass || meta?.css_class || ""}`.trim()}>{text}</Txt>;
  };

  const ButtonField: React.FC<SduiLeafProps> = ({ meta, onAction }) => {
    const label = meta?.labelText || meta?.label_text || "";
    return (
      <Btn
        className={`btn-field ${meta?.cssClass || meta?.css_class || ""}`.trim()}
        onPress={() => onAction?.(meta)}
      >
        {label}
      </Btn>
    );
  };

  return {
    GROUP: GroupComponent,
    TEXT: TextField,
    BUTTON: ButtonField,
  };
}
