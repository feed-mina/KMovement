import type { ComponentType } from "react";

export type RefId = string | number | null;

export interface ScreenControllerProps {
    screenId: string;
    refId: RefId;
}

export type ScreenController = ComponentType<ScreenControllerProps>;
