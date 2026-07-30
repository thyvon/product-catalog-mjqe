import { useTheme } from "next-themes";

export function useDarkMode() {
  const { resolvedTheme, setTheme } = useTheme();
  const darkMode = resolvedTheme === "dark";
  const toggleDarkMode = () => setTheme(darkMode ? "light" : "dark");
  return { darkMode, toggleDarkMode };
}
