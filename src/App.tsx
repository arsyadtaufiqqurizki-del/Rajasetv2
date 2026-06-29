/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Maintenance from "./pages/Maintenance";
import Reports from "./pages/Reports";
import MasterData from "./pages/MasterData";
import Settings from "./pages/Settings";
import AIAssistant from "./pages/AIAssistant";
import Guide from "./pages/Guide";
import Login from "./pages/Login";
import { AssetProvider } from "./contexts/AssetContext";
import { MaintenanceProvider } from "./contexts/MaintenanceContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="master-data" element={<MasterData />} />
        <Route path="reports" element={<Reports />} />
        <Route path="ai-assistant" element={<AIAssistant />} />
        <Route path="guide" element={<Guide />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AssetProvider>
        <MaintenanceProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </MaintenanceProvider>
      </AssetProvider>
    </AuthProvider>
  );
}
