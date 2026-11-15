import { lazy, Suspense } from "react";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";

import { Loading } from "./components/Loading";
import { AuthProvider } from "./contexts/AuthContext";
import { DesktopUpdateProvider } from "./contexts/DesktopUpdateContext";
import { ProtectedRoute, PublicOnlyRoute } from "./components/ProtectedRoute";

import Login from "./pages/auth/LoginPage";
import Register from "./pages/auth/RegisterPage";
import Dashboard from "./pages/home/DashboardPage";
import Profile from "./pages/profile/ProfilePage";
import ErrorScreen from "./pages/error/ErrorScreen";
import Library from "./pages/library/LibraryPage";
import Upload from "./pages/library/UploadPage";
import CreateVolume from "./pages/library/CreateVolumePage";
import Reader from "./pages/reader/ReaderPage";
import VolumeReader from "./pages/reader/VolumeReaderPage";
import LocalReader from "./pages/reader/LocalReaderPage";

const Download = lazy(() => import("./pages/download/DownloadPage"));

export default function App() {
  const Router = window.librioDesktop ? HashRouter : BrowserRouter;

  return (
    <>
      <DesktopUpdateProvider>
        <AuthProvider>
          <Router>
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
              <Route path="/volumes/new" element={<CreateVolume />} />
              <Route
                path="/download"
                element={
                  <Suspense fallback={<Loading />}>
                    <Download />
                  </Suspense>
                }
              />
              <Route path="/reader/:bookId" element={<Reader />} />
              <Route
                path="/local-reader/:bookId"
                element={<LocalReader />}
              />
              <Route path="/volume/:volumeId" element={<VolumeReader />} />
            </Route>
            <Route path="*" element={<ErrorScreen />} />
            </Routes>
          </Router>
        </AuthProvider>
      </DesktopUpdateProvider>
    </>
  );
}
