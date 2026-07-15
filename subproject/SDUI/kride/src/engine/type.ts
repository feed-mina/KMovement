// SDUI 엔진 타입은 @kride/core가 단일 원본(source of truth)이다.
// 웹 앱은 core 타입을 재수출해서 사용한다. (로컬 중복 정의 제거)
export type { Metadata, DynamicEngineProps } from "@kride/core";
