import { WORKSPACE_ROUTES } from "./resources";

const protectedRoots = [
  ...WORKSPACE_ROUTES.map(({ href }) => href),
  "/access-denied"
] as const;

export function isProtectedWorkspacePath(pathname: string): boolean {
  return protectedRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}
