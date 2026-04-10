import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "../components/Layout";
import { useAuth } from "../contexts/AuthContext";

interface ProviderGame {
  id: number;
  symbol: string;
  provider: string;
  name: string;
  gameType: string;
  volatility: string | null;
  lines: number | null;
  ways: number | null;
  active: boolean;
  importedAt: string;
  updatedAt: string;
}

interface ImportJob {
  id: number;
  provider: string;
  status: string;
  gamesImported: number;
  gamesUpdated: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export default function AdminGames() {
  const { user } = useAuth();
  const [games, setGames] = useState<ProviderGame[]>([]);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");

  const token = localStorage.getItem("bettopia_token");
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  async function fetchData() {
    setLoading(true);
    try {
      const [gRes, jRes] = await Promise.all([
        fetch("/api/admin/games", { headers }),
        fetch("/api/admin/import/jobs", { headers }),
      ]);
      if (gRes.ok) setGames(await gRes.json());
      if (jRes.ok) setJobs(await jRes.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  async function triggerImport() {
    setImporting(true);
    setImportMsg("");
    try {
      const res = await fetch("/api/admin/import/run", {
        method: "POST",
        headers,
        body: JSON.stringify({ provider: "pragmaticplay" }),
      });
      const data = await res.json();
      if (res.ok) {
        const r = data.result;
        setImportMsg(`Done: ${r.imported} new, ${r.updated} updated via ${r.source}${r.error ? ` (note: ${r.error})` : ""}`);
      } else {
        setImportMsg(`Error: ${data.error}`);
      }
      await fetchData();
    } catch (e: any) {
      setImportMsg(`Error: ${e.message}`);
    }
    setImporting(false);
  }

  async function toggleGame(id: number, active: boolean) {
    await fetch(`/api/admin/games/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ active }),
    });
    setGames(prev => prev.map(g => g.id === id ? { ...g, active } : g));
  }

  const filtered = games.filter(g =>
    activeFilter === "all" ? true : activeFilter === "active" ? g.active : !g.active
  );

  const statusColor = (s: string) => s === "done" ? "text-green-400" : s === "failed" ? "text-red-400" : s === "running" ? "text-yellow-400" : "text-muted-foreground";

  if (!user) return (
    <Layout>
      <div className="flex items-center justify-center h-60 text-muted-foreground">
        <p>Please <Link href="/login" className="text-primary hover:underline">log in</Link> as admin.</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Game Catalog Admin</h1>
            <p className="text-sm text-muted-foreground">{games.length} games across all providers</p>
          </div>
          <button
            onClick={triggerImport}
            disabled={importing}
            className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-all"
          >
            {importing ? "Importing..." : "▶ Run Import Now"}
          </button>
        </div>

        {importMsg && (
          <div className={`p-3 rounded-lg text-sm border ${importMsg.startsWith("Error") ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-green-500/30 bg-green-500/10 text-green-400"}`}>
            {importMsg}
          </div>
        )}

        {/* Import job history */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/20 border-b border-border">
            <h2 className="font-semibold text-sm">Recent Import Jobs</h2>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No imports run yet. Click "Run Import Now" to start.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-4 py-2">Provider</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">New</th>
                    <th className="text-left px-4 py-2">Updated</th>
                    <th className="text-left px-4 py-2">Started</th>
                    <th className="text-left px-4 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id} className="border-b border-border/50 hover:bg-muted/10">
                      <td className="px-4 py-2 font-medium capitalize">{j.provider}</td>
                      <td className={`px-4 py-2 font-semibold capitalize ${statusColor(j.status)}`}>{j.status}</td>
                      <td className="px-4 py-2 text-green-400">+{j.gamesImported}</td>
                      <td className="px-4 py-2 text-blue-400">~{j.gamesUpdated}</td>
                      <td className="px-4 py-2 text-muted-foreground">{new Date(j.startedAt).toLocaleString()}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs max-w-xs truncate">{j.error || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Game list */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center justify-between gap-3">
            <h2 className="font-semibold text-sm">Game Catalog ({filtered.length})</h2>
            <div className="flex gap-2">
              {(["all", "active", "inactive"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1 rounded text-xs font-semibold capitalize border transition-all ${activeFilter === f ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground p-4">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No games found. Run an import to populate the catalog.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-4 py-2">Game</th>
                    <th className="text-left px-4 py-2">Symbol</th>
                    <th className="text-left px-4 py-2">Provider</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left px-4 py-2">Volatility</th>
                    <th className="text-left px-4 py-2">Lines/Ways</th>
                    <th className="text-left px-4 py-2">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(g => (
                    <tr key={g.id} className="border-b border-border/50 hover:bg-muted/10">
                      <td className="px-4 py-2 font-medium">{g.name}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{g.symbol}</td>
                      <td className="px-4 py-2 capitalize">{g.provider}</td>
                      <td className="px-4 py-2 capitalize">{g.gameType}</td>
                      <td className="px-4 py-2 capitalize">{g.volatility?.replace("-", " ") || "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {g.ways ? `${g.ways.toLocaleString()} ways` : g.lines ? `${g.lines} lines` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => toggleGame(g.id, !g.active)}
                          className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${g.active ? "bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400" : "bg-red-500/20 text-red-400 hover:bg-green-500/20 hover:text-green-400"}`}
                        >
                          {g.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
