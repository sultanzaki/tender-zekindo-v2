"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { TopNav } from "./TopNav";

const Navigation = dynamic(() =>
  import("./TopNav").then((module) => module.TopNav),
);
export function WorkspaceShell(props: ComponentProps<typeof TopNav>) {
  return <Navigation {...props} />;
}
