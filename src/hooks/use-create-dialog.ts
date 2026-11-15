import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/** Reopen quick-create even when the user is already on the destination page. */
export function useCreateDialog(requested: boolean) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(requested);
  useEffect(() => { if (requested) setOpen(true); }, [requested]);
  useEffect(() => {
    const handle = (event: Event) => {
      if ((event as CustomEvent<string>).detail === pathname) setOpen(true);
    };
    window.addEventListener("bsm:quick-create", handle);
    return () => window.removeEventListener("bsm:quick-create", handle);
  }, [pathname]);
  return [open, setOpen] as const;
}