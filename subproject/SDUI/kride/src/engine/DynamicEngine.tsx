'use client';
import React from "react";
import { DynamicEngine as CoreDynamicEngine, webPrimitives } from "@kride/core";
import type { DynamicEngineProps } from "@kride/core";
import { componentMap } from "./componentMap";

/**
 * Web entrypoint for the shared SDUI engine. Thin wrapper that injects the web
 * primitive registry and the web-owned componentMap into the platform-neutral
 * core engine (packages/core). Traversal/repeater/visibility/modal logic now
 * lives in the core and is shared with the mobile app.
 */
const DynamicEngine: React.FC<DynamicEngineProps> = (props) => (
  <CoreDynamicEngine primitives={webPrimitives} componentMap={componentMap} {...props} />
);

export default DynamicEngine;
