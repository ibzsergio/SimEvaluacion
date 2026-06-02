import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import LoginPage from "./pages/LoginPage";
import TeacherPage from "./pages/TeacherPage";
import StudentPage from "./pages/StudentPage";

function Protected({ role, children }: { role?: "TEACHER" | "STUDENT"; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "TEACHER" ? "/docente" : "/alumno"} replace />;
  }
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={user.role === "TEACHER" ? "/docente" : "/alumno"} replace />
          ) : (
            <LoginPage allowModeSwitch={!import.meta.env.PROD} />
          )
        }
      />
      <Route
        path="/ingresar-docente"
        element={user ? <Navigate to="/docente" replace /> : <LoginPage initialMode="teacher" allowModeSwitch />}
      />
      <Route
        path="/docente"
        element={
          <Protected role="TEACHER">
            <TeacherPage />
          </Protected>
        }
      />
      <Route
        path="/alumno"
        element={
          <Protected role="STUDENT">
            <StudentPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
