/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import PageLoader from "./components/ui/PageLoader";
import { AssetProvider } from "./contexts/AssetContext";
import { MaintenanceProvider } from "./contexts/MaintenanceContext";
import { ReclassificationProvider } from "./contexts/ReclassificationContext";
import { ReportProvider } from "./contexts/ReportContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Reclassification = lazy(() => import("./pages/Reclassification"));
const Reports = lazy(() => import("./pages/Reports"));
const MasterData = lazy(() => import("./pages/MasterData"));
const Settings = lazy(() => import("./pages/Settings"));
const AIAssistant = lazy(() => import("./pages/AIAssistant"));
const Guide = lazy(() => import("./pages/Guide"));
const Login = lazy(() => import("./pages/Login"));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="reclassification" element={<Reclassification />} />
            <Route path="master-data" element={<MasterData />} />
            <Route path="reports" element={<Reports />} />
            <Route path="ai-assistant" element={<AIAssistant />} />
            <Route path="guide" element={<Guide />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AssetProvider>
        <MaintenanceProvider>
          <ReclassificationProvider>
            <ReportProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </ReportProvider>
          </ReclassificationProvider>
        </MaintenanceProvider>
      </AssetProvider>
    </AuthProvider>
  );
}
