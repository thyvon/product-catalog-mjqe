import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import {AuthProvider} from '@/features/auth/AuthContext';
import {ToastProvider} from '@/features/shared/components/Toast';
import {RequireAuth} from '@/App';
import Layout from '@/features/shared/components/Layout';
import LoginPage from '@/features/auth/pages/LoginPage';
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import CatalogPage from '@/features/products/pages/CatalogPage';
import SupplierDocsPage from '@/features/suppliers/pages/SupplierDocsPage';
import SupplierRegisterPage from '@/features/suppliers/pages/SupplierRegisterPage';
import LandingPage from '@/features/products/pages/LandingPage';
import DebitNoteListPage from '@/features/debit-notes/pages/DebitNoteListPage';
import DebitNoteEmailsPage from '@/features/debit-notes/pages/DebitNoteEmailsPage';
import StockIssueItemsPage from '@/features/stock/pages/StockIssueItemsPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
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
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
