'use client';
import React from "react";

interface Props {
  id: string;
  meta: any;
  data: any;
  isOpen?: boolean;
  children?: React.ReactNode;
}

export default function CollapseBody({ isOpen, children }: Props) {
  if (!isOpen) return null;
  return (
    <div className="collapse-body px-4 py-2 bg-gray-950 space-y-2">
      {children}
    </div>
  );
}
