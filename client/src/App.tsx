import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ToastProvider from "./components/toast/ToastProvider.tsx";
import AuthPage from "./features/auth/AuthPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
