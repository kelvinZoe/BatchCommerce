import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireWorkspace } from "@/lib/auth/session";

export default async function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  const context = await requireWorkspace();
  return <WorkspaceShell context={context}>{children}</WorkspaceShell>;
}
