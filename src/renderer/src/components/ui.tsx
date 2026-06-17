import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle, Info } from "lucide-react";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:brightness-95",
    secondary: "border border-border bg-card text-foreground hover:bg-secondary",
    ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
    danger: "bg-destructive text-destructive-foreground hover:brightness-95",
  };
  return (
    <button
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring ${className}`}
      {...props}
    />
  );
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "success" | "warning" | "danger" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-emerald-500/15 text-emerald-300",
    warning: "bg-amber-500/15 text-amber-300",
    danger: "bg-red-500/15 text-red-300",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-md border border-border bg-card ${className}`}>{children}</section>;
}

export function Modal({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-5 py-4">
          <div className="text-base font-semibold">{title}</div>
          {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
        </div>
        <div className="min-h-0 overflow-auto p-5">{children}</div>
        {footer ? <div className="border-t border-border px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export type ToastEntry = {
  id: string;
  variant: "success" | "error" | "info";
  title: string;
  message: string;
  technicalDetails?: string;
};

export function Toast({ toast, onDismiss }: { toast: ToastEntry; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle className="size-4 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="size-4 text-destructive shrink-0" />,
    info: <Info className="size-4 text-primary shrink-0" />,
  };

  return (
    <div
      className={`w-80 rounded-md border bg-card p-3 shadow-lg transition-all ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      } ${toast.variant === "error" ? "border-destructive" : "border-border"}`}
    >
      <div className="flex items-start gap-2">
        {icons[toast.variant]}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{toast.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{toast.message}</div>
          {toast.technicalDetails && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">Technical details</summary>
              <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted p-2 text-xs">{toast.technicalDetails}</pre>
            </details>
          )}
        </div>
        <button
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setVisible(false);
            setTimeout(() => onDismiss(toast.id), 300);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Toaster({ toasts, onDismiss }: { toasts: ToastEntry[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-10 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <div className={`animate-spin rounded-full border-2 border-muted border-t-primary h-4 w-4 ${className}`} />;
}
