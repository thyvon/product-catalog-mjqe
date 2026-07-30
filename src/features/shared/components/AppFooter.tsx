export default function AppFooter() {
  return (
    <footer className="shrink-0 border-t px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
      <span>&copy; {new Date().getFullYear()} PROCUREMENT - Vun Thy - Procurement Officer</span>
      <span>v1.0.0</span>
    </footer>
  );
}
