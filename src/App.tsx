import type { ComponentType } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Login from "./pages/auth/LoginPage";
import Register from "./pages/auth/RegisterPage";
import Dashboard from "./pages/home/DashboardPage";
import Profile from "./pages/profile/ProfilePage";
import ErrorScreen from "./pages/error/ErrorScreen";

const DashboardPage = Dashboard as unknown as ComponentType<any>;
const ProfilePage = Profile as unknown as ComponentType<any>;

export default function App() {
  return (
    <>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* Rotas protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<ErrorScreen />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </>
  );
}
