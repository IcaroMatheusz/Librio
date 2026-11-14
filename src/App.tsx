import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Loading } from "./components/Loading";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, PublicOnlyRoute } from "./components/ProtectedRoute";

import Login from "./pages/auth/LoginPage";
import Register from "./pages/auth/RegisterPage";
import Dashboard from "./pages/home/DashboardPage";
import Profile from "./pages/profile/ProfilePage";
import ErrorScreen from "./pages/error/ErrorScreen";
import Library from "./pages/library/LibraryPage";
import Upload from "./pages/library/UploadPage";
import Reader from "./pages/reader/ReaderPage";

const Download = lazy(() => import("./pages/download/DownloadPage"));

export default function App() {
  return (
    <>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Rotas públicas */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
            {/* Rotas protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/library" element={<Library />} />
              <Route path="/upload" element={<Upload />} />
              <Route
                path="/download"
                element={
                  <Suspense fallback={<Loading />}>
                    <Download />
                  </Suspense>
                }
              />
              <Route path="/reader/:bookId" element={<Reader />} />
            </Route>
            <Route path="*" element={<ErrorScreen />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </>
  );
}
