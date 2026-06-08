import { useEffect } from "react";

export function useDocumentTheme(theme: "light" | "dark") {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
  }, [theme]);
}
