import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createStudentPassword,
  devSeed,
  getApiErrorMessage,
  isPasswordNotSetError,
  loginStudent,
  loginTeacher,
} from "../lib/api";
import { useAuth } from "../lib/auth";

type Mode = "teacher" | "student";

export default function LoginPage({
  initialMode,
  allowModeSwitch = true,
}: {
  initialMode?: Mode;
  allowModeSwitch?: boolean;
}) {
  const { login: saveAuth } = useAuth();
  const navigate = useNavigate();
  const defaultMode = useMemo<Mode>(() => {
    if (initialMode) return initialMode;
    return import.meta.env.PROD ? "student" : "teacher";
  }, [initialMode]);
  const [mode, setMode] = useState<Mode>(defaultMode);

  const [email, setEmail] = useState("seribamont@gmail.com");
  const [teacherPassword, setTeacherPassword] = useState("c4l1f1c4c10n3s***");

  const [controlNumber, setControlNumber] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupMode, setSetupMode] = useState(false);
  const [setupName, setSetupName] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function handleTeacherSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginTeacher(email, teacherPassword);
      saveAuth(data);
      navigate("/docente");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleStudentSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const pwd = studentPassword.trim();
      const data = await loginStudent(controlNumber, pwd.length >= 4 ? pwd : undefined);
      saveAuth(data);
      navigate("/alumno");
    } catch (err) {
      if (isPasswordNotSetError(err)) {
        setSetupMode(true);
        setSetupName(err.response.data.student.displayName);
        setControlNumber(err.response.data.student.controlNumber ?? controlNumber.trim());
        setStudentPassword("");
        setError("");
      } else {
        setError(getApiErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleFirstTime(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginStudent(controlNumber);
    } catch (err) {
      if (isPasswordNotSetError(err)) {
        setSetupMode(true);
        setSetupName(err.response.data.student.displayName);
        setControlNumber(err.response.data.student.controlNumber ?? controlNumber.trim());
        setError("");
      } else {
        setError(getApiErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await createStudentPassword(
        controlNumber.trim(),
        newPassword,
        confirmPassword,
      );
      saveAuth(data);
      navigate("/alumno");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setError("");
    try {
      await devSeed();
      alert("Docente listo: seribamont@gmail.com / c4l1f1c4c10n3s***. Importa alumnos por Excel.");
    } catch {
      setError("No se pudo crear datos demo. ¿Está el backend encendido?");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.25),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.18),transparent_35%)]" />
      <div className="glass relative w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-3xl shadow-lg">
            🏆
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">SimEvaluación</h1>
          {!allowModeSwitch ? (
            <p className="mt-2 text-sm text-slate-400">Acceso alumnos</p>
          ) : null}
        </div>

        {allowModeSwitch ? (
          <div className="mb-6 flex rounded-xl bg-slate-900/60 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("teacher");
                setSetupMode(false);
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                mode === "teacher" ? "bg-indigo-500 text-white" : "text-slate-400"
              }`}
            >
              Docente
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("student");
                setSetupMode(false);
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                mode === "student" ? "bg-cyan-500 text-slate-950" : "text-slate-400"
              }`}
            >
              Alumno
            </button>
          </div>
        ) : null}

        {mode === "teacher" ? (
          <form onSubmit={handleTeacherSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Correo
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Contraseña
              </span>
              <input
                type="password"
                value={teacherPassword}
                onChange={(e) => setTeacherPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white"
                required
              />
            </label>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 py-3 font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Iniciar sesión"}
            </button>
          </form>
        ) : setupMode ? (
          <form onSubmit={handleCreatePassword} className="space-y-4">
            <p className="rounded-xl bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
              Hola <strong>{setupName}</strong>. Es tu primera vez: crea tu contraseña.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Número de control</span>
              <input
                value={controlNumber}
                readOnly
                className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-slate-300"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Nueva contraseña</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white"
                minLength={4}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Confirmar contraseña</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white"
                minLength={4}
                required
              />
            </label>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-slate-950 disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Crear contraseña y entrar"}
            </button>
            <button
              type="button"
              className="w-full text-xs text-slate-400 hover:text-slate-200"
              onClick={() => setSetupMode(false)}
            >
              Volver al inicio de sesión
            </button>
          </form>
        ) : (
          <form onSubmit={handleStudentSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Número de control
              </span>
              <input
                value={controlNumber}
                onChange={(e) => setControlNumber(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white"
                placeholder="Ej. 25415082630002"
                inputMode="numeric"
                autoComplete="username"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Contraseña (si ya la creaste)
              </span>
              <input
                type="password"
                value={studentPassword}
                onChange={(e) => setStudentPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-white"
                placeholder="Déjala vacía si es tu primera vez"
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            <button
              type="button"
              disabled={loading || !controlNumber.trim()}
              onClick={handleFirstTime}
              className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/15 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-60"
            >
              {loading ? "Verificando..." : "Primera vez — crear mi contraseña"}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-slate-950 disabled:opacity-60"
            >
              Ya tengo contraseña — entrar
            </button>
          </form>
        )}

        {import.meta.env.DEV ? (
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="mt-4 w-full rounded-xl border border-dashed border-white/15 py-2 text-xs text-slate-400"
          >
            {seeding ? "Creando..." : "Crear docente demo"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
