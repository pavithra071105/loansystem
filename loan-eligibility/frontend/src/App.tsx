import { MotionConfig } from "framer-motion";
import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageLoader } from "@/components/Feedback";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/lib/types";
import { LoginPage, RegisterPage } from "@/pages/AuthPages";

const Dashboard = lazy(() => import("@/pages/DashboardPage"));
const Apply = lazy(() => import("@/pages/ApplyPage"));
const Result = lazy(() => import("@/pages/ResultPage"));
const History = lazy(() => import("@/pages/HistoryPage"));
const Calculators = lazy(() => import("@/pages/CalculatorsPage"));
const Admin = lazy(() => import("@/pages/AdminPage"));

function Guard({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return <>{children}</>;
}

function Home() {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader />;
  return <Navigate to={!user ? "/login" : user.role === "admin" ? "/admin" : "/dashboard"} replace />;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<Guard><AppLayout /></Guard>}>
            <Route path="/dashboard" element={<Guard role="applicant"><Dashboard /></Guard>} />
            <Route path="/apply" element={<Guard role="applicant"><Apply /></Guard>} />
            <Route path="/history" element={<Guard role="applicant"><History /></Guard>} />
            <Route path="/results/:id" element={<Result />} />
            <Route path="/calculators" element={<Calculators />} />
            <Route path="/admin" element={<Guard role="admin"><Admin /></Guard>} />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </MotionConfig>
  );
}
