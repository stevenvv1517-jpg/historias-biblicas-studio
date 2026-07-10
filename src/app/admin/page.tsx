"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface UserStats {
  email: string;
  name: string;
  firstSignIn: string;
  lastSignIn: string;
  subscription: string;
  totalVideos: number;
}

interface Stats {
  totalUsers: number;
  newUsersThisMonth: number;
  totalVideos: number;
  videosThisMonth: number;
  subscribers: number;
  users: UserStats[];
}

export default function AdminPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) {
          if (res.status === 401) setError("No autorizado");
          else setError("Error al cargar");
          return;
        }
        const data = await res.json();
        setStats(data);
      } catch {
        setError("Error de conexión");
      }
    };
    fetchStats();
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <div className="h-16 w-16 rounded-2xl bg-red-500/20 grid place-items-center text-red-400 text-3xl">
            ⚠
          </div>
          <h1 className="text-2xl font-bold">Acceso restringido</h1>
          <p className="text-studio-muted">{error}</p>
          <a
            href="/"
            className="px-4 py-2 rounded-lg bg-studio-accent text-white font-semibold"
          >
            Volver al inicio
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            ⚙ Admin Panel
          </h1>
          <p className="text-sm text-studio-muted">
            {session?.user?.email}
          </p>
        </div>
        <a
          href="/"
          className="text-xs px-3 py-1.5 rounded-lg border border-studio-border hover:border-studio-accent transition"
        >
          ← Volver
        </a>
      </header>

      {!stats ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <p className="text-studio-muted">Cargando estadísticas…</p>
        </div>
      ) : (
        <>
          {/* Tarjetas de resumen */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <div className="rounded-2xl border border-studio-border bg-studio-panel/40 p-5">
              <p className="text-xs text-studio-muted uppercase tracking-wide mb-1">
                Usuarios totales
              </p>
              <p className="text-3xl font-bold">{stats.totalUsers}</p>
            </div>
            <div className="rounded-2xl border border-studio-border bg-studio-panel/40 p-5">
              <p className="text-xs text-studio-muted uppercase tracking-wide mb-1">
                Nuevos este mes
              </p>
              <p className="text-3xl font-bold">{stats.newUsersThisMonth}</p>
            </div>
            <div className="rounded-2xl border border-studio-border bg-studio-panel/40 p-5">
              <p className="text-xs text-studio-muted uppercase tracking-wide mb-1">
                Videos generados
              </p>
              <p className="text-3xl font-bold">{stats.totalVideos}</p>
            </div>
          </div>

          {/* Stats del mes */}
          <div className="rounded-2xl border border-studio-border bg-studio-panel/40 p-6 mb-10">
            <h2 className="font-semibold mb-4">Este mes</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-studio-muted mb-1">Nuevos usuarios</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{stats.newUsersThisMonth}</span>
                  <span className="text-xs text-studio-muted">
                    de {stats.totalUsers} totales
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-studio-muted mb-1">Videos generados</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{stats.videosThisMonth}</span>
                  <span className="text-xs text-studio-muted">
                    de {stats.totalVideos} totales
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de usuarios */}
          <div className="rounded-2xl border border-studio-border bg-studio-panel/40 p-6">
            <h2 className="font-semibold mb-4">Usuarios</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-studio-muted border-b border-studio-border">
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Nombre</th>
                    <th className="pb-3 pr-4">Primer ingreso</th>
                    <th className="pb-3 pr-4">Último ingreso</th>
                    <th className="pb-3 text-right">Videos</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.users.map((user) => (
                    <tr
                      key={user.email}
                      className="border-b border-studio-border/50"
                    >
                      <td className="py-3 pr-4 text-studio-text/80">
                        {user.email}
                      </td>
                      <td className="py-3 pr-4">{user.name}</td>
                      <td className="py-3 pr-4 text-studio-muted">
                        {new Date(user.firstSignIn).toLocaleDateString("es-ES")}
                      </td>
                      <td className="py-3 pr-4 text-studio-muted">
                        {new Date(user.lastSignIn).toLocaleDateString("es-ES")}
                      </td>
                      <td className="py-3 text-right font-mono">
                        {user.totalVideos}
                      </td>
                    </tr>
                  ))}
                  {stats.users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-studio-muted">
                        No hay usuarios registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
