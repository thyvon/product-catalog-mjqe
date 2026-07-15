import {StrictMode, lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AuthProvider} from '@/features/auth/AuthContext';
import {ToastProvider} from '@/features/shared/components/Toast';
import ErrorBoundary from '@/features/shared/components/ErrorBoundary';
import {RequireAuth} from '@/App';
import Layout from '@/features/shared/components/Layout';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <Suspense fallback={<div className="flex items-center justify-center h-screen text-slate-400 text-xs font-mono">Loading...</div>}>
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
                  <Route path="/supplier-register" element={<SupplierRegisterPage />} />
                  <Route path="/supplier-docs" element={<SupplierDocsPage />} />
                  <Route path="/debit-notes" element={<DebitNoteListPage />} />
                  <Route path="/debit-note-emails" element={<DebitNoteEmailsPage />} />
                  <Route path="/stock-issue-items" element={<StockIssueItemsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
              </Suspense>
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
