import React, { ReactNode } from "react";
import ReactQueryProvider from "../(afterLogin)/_component/react-query-provider";

// /kpop/* 페이지들은 useUiScreen/useKpopPageData(react-query)를 쓰는데,
// QueryClientProvider가 (afterLogin) 그룹 레이아웃에만 있어 이 트리에서는
// 프리렌더와 브라우저 런타임 모두 "No QueryClient set"으로 죽었다.
export default function KpopLayout({ children }: { children: ReactNode }) {
  return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
