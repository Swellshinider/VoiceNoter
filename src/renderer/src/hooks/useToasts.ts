import { useCallback, useState } from "react";
import type { ToastEntry } from "../components/ui";

export function useToasts() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const addToast = useCallback((entry: Omit<ToastEntry, "id">) => {
    setToasts((previous) => [...previous, { ...entry, id: crypto.randomUUID() }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

