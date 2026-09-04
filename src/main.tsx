import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from 'next-themes';
import {AuthProvider} from '@/features/auth/AuthContext';
import {ToastProvider} from '@/features/shared/components/Toast';
import {TooltipProvider} from '@/components/ui/tooltip';
import ErrorBoundary from '@/features/shared/components/ErrorBoundary';
import {RequireAuth} from '@/App';
import Layout from '@/features/shared/components/Layout';
import '@fontsource-variable/geist';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const CatalogPage = lazy(() => import('@/features/products/pages/CatalogPage'));
const SupplierDocsPage = lazy(() => import('@/features/suppliers/pages/SupplierDocsPage'));
const SupplierRegisterPage = lazy(() => import('@/features/suppliers/pages/SupplierRegisterPage'));
const LandingPage = lazy(() => import('@/features/products/pages/LandingPage'));
const DebitNoteListPage = lazy(() => import('@/features/debit-notes/pages/DebitNoteListPage'));
const DebitNoteEmailsPage = lazy(() => import('@/features/debit-notes/pages/DebitNoteEmailsPage'));
const StockIssueItemsPage = lazy(() => import('@/features/stock/pages/StockIssueItemsPage'));
const ProductManagementPage = lazy(() => import('@/features/product-management/pages/ProductManagementPage'));
const PmProductFormPage = lazy(() => import('@/features/product-management/pages/PmProductFormPage'));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));
const ContactsPage = lazy(() => import('@/features/debit-notes/pages/ContactsPage'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <TooltipProvider>
            <AuthProvider>
              <Suspense fallback={<div className="flex items-center justify-center h-screen text-muted-foreground text-xs font-mono">Loading...</div>}>
                <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/product-list" element={<LandingPage />} />
                <Route
                  element={
                    <RequireAuth>
                      <Layout />
                    </RequireAuth>
                  }
                >
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />
                  <Route path="/catalog" element={<CatalogPage />} />
                  <Route path="/product-management" element={<ProductManagementPage />} />
                  <Route path="/product-management/products/new" element={<PmProductFormPage />} />
                  <Route path="/product-management/products/:id/edit" element={<PmProductFormPage />} />
                  <Route path="/supplier-register" element={<SupplierRegisterPage />} />
                  <Route path="/supplier-docs" element={<SupplierDocsPage />} />
                  <Route path="/debit-notes" element={<DebitNoteListPage />} />
                  <Route path="/debit-note-emails" element={<DebitNoteEmailsPage />} />
                  <Route path="/contacts" element={<ContactsPage />} />
                  <Route path="/stock-issue-items" element={<StockIssueItemsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
              </Suspense>
            </AuthProvider>
            </TooltipProvider>
          </ToastProvider>
        </QueryClientProvider>
      </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
