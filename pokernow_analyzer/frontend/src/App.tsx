import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type PlayerStats = {
  player: string;
  hands: number;
  ["BB/100"]: number;
  ["SD BB/100"]: number;
  ["NonSD BB/100"]: number;
  ["VPIP%"]: number;
  ["PFR%"]: number;
  ["Limp%"]: number;
  ["Call Open%"]: number;
  ["Squeeze%"]: number;
  ["3BET%"]: number;
  ["4BET%"]: number;
  ["Fold to 3BET%"]: number;
  ["Fold to 4BET%"]: number;
  AF: number;
  ["AFq%"]: number;
  SawFlop: number;
  ["WTSD%"]: number;
  ["W$SD%"]: number;
  ["WWSF%"]: number;
  ["Flop Cbet%"]: number;
  ["Fold to Flop Cbet%"]: number;
  ["Turn Cbet%"]: number;
  ["Fold to Turn Cbet%"]: number;
  ["River Cbet%"]: number;
  ["Fold to River Cbet%"]: number;
  ["CR Flop%"]: number;
  ["CR Turn%"]: number;
  ["CR River%"]: number;
  ["Donk Flop%"]: number;
  ["Donk Turn%"]: number;
  ["Donk River%"]: number;
};

type ApiResponse = {
  num_files: number;
  num_log_lines: number;
  num_hands: number;
  big_blind: number;
  stats: PlayerStats[];
};

type AliasMap = Record<string, string>;
type AliasStats = PlayerStats & { alias: string };

const API_BASE = "http://127.0.0.1:8000";
type View = "upload" | "stats" | "graphs" | "ai";

const App: React.FC = () => {
  const [view, setView] = useState<View>("upload");
  const [files, setFiles] = useState<FileList | null>(null);
  const [apiResult, setApiResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [minHandsFilter, setMinHandsFilter] = useState(0);

  const [aliasMap, setAliasMap] = useState<AliasMap>({});
  const [newAliasRaw, setNewAliasRaw] = useState("");
  const [newAliasCanonical, setNewAliasCanonical] = useState("");

  const [sortKey, setSortKey] = useState<keyof PlayerStats | "hands">("hands");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(e.target.files);
    }
  };

  const handleAnalyze = async () => {
    if (!files || files.length === 0) {
      setError("Please select at least one CSV file.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));

      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error: ${res.status} ${text}`);
      }
      const data: ApiResponse = await res.json();
      setApiResult(data);
      setView("stats");
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const filteredStats = useMemo(() => {
    if (!apiResult) return [];
    let arr = [...apiResult.stats];
    if (minHandsFilter > 0) {
      arr = arr.filter((s) => s.hands >= minHandsFilter);
    }
    arr.sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return arr;
  }, [apiResult, minHandsFilter, sortKey, sortAsc]);

  const aliasStats: AliasStats[] = useMemo(() => {
    if (!apiResult) return [];
    const groups: Record<string, PlayerStats[]> = {};

    for (const s of apiResult.stats) {
      const alias = aliasMap[s.player] || s.player;
      if (!groups[alias]) groups[alias] = [];
      groups[alias].push(s);
    }

    const result: AliasStats[] = [];
    for (const [alias, statsList] of Object.entries(groups)) {
      const totalHands = statsList.reduce((acc, s) => acc + s.hands, 0);
      const base = statsList[0];

      const weighted = (field: keyof PlayerStats) =>
        statsList.reduce((acc, s) => acc + s[field] * s.hands, 0) /
        (totalHands || 1);

      const agg: AliasStats = {
        ...base,
        alias,
        player: alias,
        hands: totalHands,
        ["BB/100"]: weighted("BB/100"),
        ["SD BB/100"]: weighted("SD BB/100"),
        ["NonSD BB/100"]: weighted("NonSD BB/100"),
        ["VPIP%"]: weighted("VPIP%"),
        ["PFR%"]: weighted("PFR%"),
        ["Limp%"]: weighted("Limp%"),
        ["Call Open%"]: weighted("Call Open%"),
        ["Squeeze%"]: weighted("Squeeze%"),
        ["3BET%"]: weighted("3BET%"),
        ["4BET%"]: weighted("4BET%"),
        ["Fold to 3BET%"]: weighted("Fold to 3BET%"),
        ["Fold to 4BET%"]: weighted("Fold to 4BET%"),
        AF: weighted("AF"),
        ["AFq%"]: weighted("AFq%"),
        SawFlop: statsList.reduce((acc, s) => acc + s.SawFlop, 0),
        ["WTSD%"]: weighted("WTSD%"),
        ["W$SD%"]: weighted("W$SD%"),
        ["WWSF%"]: weighted("WWSF%"),
        ["Flop Cbet%"]: weighted("Flop Cbet%"),
        ["Fold to Flop Cbet%"]: weighted("Fold to Flop Cbet%"),
        ["Turn Cbet%"]: weighted("Turn Cbet%"),
        ["Fold to Turn Cbet%"]: weighted("Fold to Turn Cbet%"),
        ["River Cbet%"]: weighted("River Cbet%"),
        ["Fold to River Cbet%"]: weighted("Fold to River Cbet%"),
        ["CR Flop%"]: weighted("CR Flop%"),
        ["CR Turn%"]: weighted("CR Turn%"),
        ["CR River%"]: weighted("CR River%"),
        ["Donk Flop%"]: weighted("Donk Flop%"),
        ["Donk Turn%"]: weighted("Donk Turn%"),
        ["Donk River%"]: weighted("Donk River%"),
      };
      result.push(agg);
    }

    result.sort((a, b) => b.hands - a.hands);
    return result;
  }, [apiResult, aliasMap]);

  const handleAddAlias = () => {
    const raw = newAliasRaw.trim();
    const canon = newAliasCanonical.trim();
    if (!raw || !canon) return;
    setAliasMap((prev) => ({ ...prev, [raw]: canon }));
    setNewAliasRaw("");
    setNewAliasCanonical("");
  };

  const handleRemoveAlias = (raw: string) => {
    setAliasMap((prev) => {
      const copy = { ...prev };
      delete copy[raw];
      return copy;
    });
  };

  const aiSummary = useMemo(() => {
  if (!apiResult) return "";

  const lines: string[] = [];

  lines.push(
    `Game summary: ${apiResult.num_hands} hands, big blind ${apiResult.big_blind}.`
  );
  lines.push("");
  lines.push(
    "Per-player full stats (grouped by general / preflop / postflop / aggression):"
  );
  lines.push("");

  for (const s of apiResult.stats) {
    lines.push(`Player: ${s.player}`);
    lines.push(
      `  General: hands=${s.hands}, BB/100=${s["BB/100"].toFixed(
        1
      )}, SD BB/100=${s["SD BB/100"].toFixed(
        1
      )}, NonSD BB/100=${s["NonSD BB/100"].toFixed(
        1
      )}, SawFlop=${s.SawFlop}`
    );

    lines.push(
      `  Preflop: VPIP=${s["VPIP%"].toFixed(1)}%, PFR=${s["PFR%"].toFixed(
        1
      )}%, Limp=${s["Limp%"].toFixed(1)}%, CallOpen=${s[
        "Call Open%"
      ].toFixed(1)}%, Squeeze=${s["Squeeze%"].toFixed(1)}%, 3BET=${s[
        "3BET%"
      ].toFixed(1)}%, 4BET=${s["4BET%"].toFixed(
        1
      )}%, FoldTo3BET=${s["Fold to 3BET%"].toFixed(
        1
      )}%, FoldTo4BET=${s["Fold to 4BET%"].toFixed(1)}%`
    );

    lines.push(
      `  Showdown / overall aggression: WTSD=${s["WTSD%"].toFixed(
        1
      )}%, W$SD=${s["W$SD%"].toFixed(1)}%, WWSF=${s["WWSF%"].toFixed(
        1
      )}%, AF=${s.AF.toFixed(2)}, AFq=${s["AFq%"].toFixed(1)}%`
    );

    lines.push(
      `  Cbet: FlopCbet=${s["Flop Cbet%"].toFixed(
        1
      )}%, TurnCbet=${s["Turn Cbet%"].toFixed(
        1
      )}%, RiverCbet=${s["River Cbet%"].toFixed(1)}%`
    );

    lines.push(
      `  Fold vs Cbet: FoldFlopCbet=${s["Fold to Flop Cbet%"].toFixed(
        1
      )}%, FoldTurnCbet=${s["Fold to Turn Cbet%"].toFixed(
        1
      )}%, FoldRiverCbet=${s["Fold to River Cbet%"].toFixed(1)}%`
    );

    lines.push(
      `  Check-raise: CRFlop=${s["CR Flop%"].toFixed(
        1
      )}%, CRTurn=${s["CR Turn%"].toFixed(
        1
      )}%, CRRiver=${s["CR River%"].toFixed(1)}%`
    );

    lines.push(
      `  Donk bets: DonkFlop=${s["Donk Flop%"].toFixed(
        1
      )}%, DonkTurn=${s["Donk Turn%"].toFixed(
        1
      )}%, DonkRiver=${s["Donk River%"].toFixed(1)}%`
    );

    lines.push(""); // blank line between players
  }

  lines.push(
    "Please analyse these stats and describe each player's style (nit, TAG, LAG, maniac, calling station, etc.), their likely leaks (preflop and postflop), and practical exploitation strategies against them."
  );

  return lines.join("\n");
}, [apiResult]);

  const handleCopyAiSummary = async () => {
    if (!aiSummary) return;
    try {
      await navigator.clipboard.writeText(aiSummary);
      alert("Summary copied. Paste it into your AI/chatbot.");
    } catch {
      alert("Failed to copy. You can still select + copy manually.");
    }
  };

  const renderSidebar = () => (
    <div
      style={{
        width: 240,
        backgroundColor: "#020617",
        color: "white",
        padding: "1.25rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>PokerNow HUD</h1>
        <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: 4 }}>
          Upload logs, see stats, prep AI analysis.
        </p>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <button
          onClick={() => setView("upload")}
          style={navButtonStyle(view === "upload")}
        >
          Upload & Summary
        </button>
        <button
          onClick={() => setView("stats")}
          style={navButtonStyle(view === "stats")}
        >
          Stats Table
        </button>
        <button
          onClick={() => setView("graphs")}
          style={navButtonStyle(view === "graphs")}
        >
          Graphs
        </button>
        <button
          onClick={() => setView("ai")}
          style={navButtonStyle(view === "ai")}
        >
          AI Helper
        </button>
      </nav>
      <div style={{ marginTop: "auto", fontSize: "0.7rem", color: "#9ca3af" }}>
        Backend: <span style={{ fontFamily: "monospace" }}>{API_BASE}</span>
      </div>
    </div>
  );

  const renderUploadView = () => (
    <div style={mainViewStyle}>
      <div style={cardStyle}>
        <h2 style={cardTitleStyle}>Upload PokerNow CSV Logs</h2>
        <p style={cardTextStyle}>
          Select one or more raw PokerNow log CSVs exported from the website.
          The server will merge them and compute per-player stats.
        </p>
        <input
          type="file"
          accept=".csv"
          multiple
          onChange={handleFileChange}
          style={{
            marginTop: "0.75rem",
            fontSize: "0.9rem",
            color: "#111827",
          }}
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !files || files.length === 0}
          style={{
            marginTop: "0.75rem",
            padding: "0.5rem 1.1rem",
            borderRadius: 999,
            border: "none",
            backgroundColor:
              loading || !files || files.length === 0 ? "#9ca3af" : "#2563eb",
            color: "white",
            fontSize: "0.9rem",
            fontWeight: 500,
            cursor:
              loading || !files || files.length === 0
                ? "not-allowed"
                : "pointer",
          }}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
        {error && (
          <div
            style={{ marginTop: "0.5rem", color: "#b91c1c", fontSize: "0.85rem" }}
          >
            Error: {error}
          </div>
        )}
      </div>

      {apiResult && (
        <div style={{ ...cardStyle, marginTop: "1.25rem" }}>
          <h3 style={cardTitleStyle}>Summary</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.5rem",
              marginTop: "0.75rem",
            }}
          >
            <SummaryItem label="Files" value={apiResult.num_files} />
            <SummaryItem label="Log lines" value={apiResult.num_log_lines} />
            <SummaryItem label="Hands" value={apiResult.num_hands} />
            <SummaryItem label="Big blind" value={apiResult.big_blind} />
            <SummaryItem label="Players" value={apiResult.stats.length} />
          </div>
        </div>
      )}
    </div>
  );

  const renderStatsTable = () => {
    if (!apiResult) {
      return (
        <div style={mainViewStyle}>
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Stats Table</h2>
            <p style={cardTextStyle}>
              No data yet. Go to <b>Upload & Summary</b> and run an analysis.
            </p>
          </div>
        </div>
      );
    }

    const headerCell = (label: string, key: keyof PlayerStats | "hands") => (
      <th
        style={headerCellStyle}
        onClick={() => {
          if (sortKey === key) setSortAsc((v) => !v);
          else {
            setSortKey(key);
            setSortAsc(false);
          }
        }}
      >
        {label}
        {sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""}
      </th>
    );

    return (
      <div style={mainViewStyle}>
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Per-Player Stats</h2>
          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              color: "#111827",
            }}
          >
            <label style={{ fontSize: "0.85rem" }}>
              Min hands:
              <input
                type="number"
                value={minHandsFilter}
                onChange={(e) =>
                  setMinHandsFilter(Number(e.target.value) || 0)
                }
                style={{
                  marginLeft: 8,
                  width: 80,
                  padding: "0.2rem 0.4rem",
                  fontSize: "0.85rem",
                  color: "#111827",
                }}
              />
            </label>
            <span style={{ fontSize: "0.8rem", color: "#4b5563" }}>
              Showing {filteredStats.length} players
            </span>
          </div>
          <div
            style={{
              marginTop: "0.75rem",
              maxWidth: "100%",
              overflowX: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          >
            <table
              style={{
                borderCollapse: "collapse",
                fontSize: "0.78rem",
                width: "100%",
              }}
            >
              <thead>
                <tr>
                {headerCell("Player", "hands")}
                {headerCell("Hands", "hands")}
                {headerCell("BB/100", "BB/100")}
                {headerCell("SD BB/100", "SD BB/100")}
                {headerCell("NonSD BB/100", "NonSD BB/100")}

                {headerCell("VPIP%", "VPIP%")}
                {headerCell("PFR%", "PFR%")}
                {headerCell("Limp%", "Limp%")}
                {headerCell("Call Open%", "Call Open%")}
                {headerCell("Squeeze%", "Squeeze%")}
                {headerCell("3BET%", "3BET%")}
                {headerCell("4BET%", "4BET%")}
                {headerCell("Fold to 3BET%", "Fold to 3BET%")}
                {headerCell("Fold to 4BET%", "Fold to 4BET%")}

                {headerCell("WTSD%", "WTSD%")}
                {headerCell("W$SD%", "W$SD%")}
                {headerCell("WWSF%", "WWSF%")}
                {headerCell("AF", "AF")}
                {headerCell("AFq%", "AFq%")}

                {headerCell("Flop Cbet%", "Flop Cbet%")}
                {headerCell("Fold Flop Cbet%", "Fold to Flop Cbet%")}
                {headerCell("Turn Cbet%", "Turn Cbet%")}
                {headerCell("Fold Turn Cbet%", "Fold to Turn Cbet%")}
                {headerCell("River Cbet%", "River Cbet%")}
                {headerCell("Fold River Cbet%", "Fold to River Cbet%")}

                {headerCell("CR Flop%", "CR Flop%")}
                {headerCell("CR Turn%", "CR Turn%")}
                {headerCell("CR River%", "CR River%")}

                {headerCell("Donk Flop%", "Donk Flop%")}
                {headerCell("Donk Turn%", "Donk Turn%")}
                {headerCell("Donk River%", "Donk River%")}
                </tr>
              </thead>
              <tbody>
                {filteredStats.map((s, idx) => (
                  <tr
                    key={s.player}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb",
                    }}
                  >
                  <td style={cellStyle}>{s.player}</td>
                  <td style={cellStyle}>{s.hands}</td>

                  <td style={cellStyle}>{s["BB/100"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["SD BB/100"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["NonSD BB/100"].toFixed(1)}</td>

                  <td style={cellStyle}>{s["VPIP%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["PFR%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["Limp%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["Call Open%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["Squeeze%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["3BET%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["4BET%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["Fold to 3BET%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["Fold to 4BET%"].toFixed(1)}</td>

                  <td style={cellStyle}>{s["WTSD%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["W$SD%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["WWSF%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s.AF.toFixed(2)}</td>
                  <td style={cellStyle}>{s["AFq%"].toFixed(1)}</td>

                  <td style={cellStyle}>{s["Flop Cbet%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["Fold to Flop Cbet%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["Turn Cbet%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["Fold to Turn Cbet%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["River Cbet%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["Fold to River Cbet%"].toFixed(1)}</td>

                  <td style={cellStyle}>{s["CR Flop%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["CR Turn%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["CR River%"].toFixed(1)}</td>

                  <td style={cellStyle}>{s["Donk Flop%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["Donk Turn%"].toFixed(1)}</td>
                  <td style={cellStyle}>{s["Donk River%"].toFixed(1)}</td>


                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Alias manager */}
          <h3 style={{ ...cardTitleStyle, marginTop: "1.5rem" }}>
            Alias Manager
          </h3>
          <p style={cardTextStyle}>
            Map different raw names to the same player (e.g. &ldquo;lks&rdquo;,
            &ldquo;luks&rdquo;, &ldquo;Lukas&rdquo; → &ldquo;Lukas&rdquo;).
            Aggregated alias stats use weighted averages by hand count.
          </p>
          <div
            style={{
              marginTop: "0.5rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <input
              placeholder="Raw name (as in log)"
              value={newAliasRaw}
              onChange={(e) => setNewAliasRaw(e.target.value)}
              style={aliasInputStyle}
            />
            <span>→</span>
            <input
              placeholder="Canonical name"
              value={newAliasCanonical}
              onChange={(e) => setNewAliasCanonical(e.target.value)}
              style={aliasInputStyle}
            />
            <button
              onClick={handleAddAlias}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: 999,
                border: "none",
                backgroundColor: "#10b981",
                color: "white",
                fontSize: "0.8rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Add mapping
            </button>
          </div>
          {Object.keys(aliasMap).length > 0 && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
              <h4 style={{ marginBottom: "0.25rem" }}>Current mappings:</h4>
              <ul
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.4rem",
                  paddingLeft: 0,
                  listStyle: "none",
                }}
              >
                {Object.entries(aliasMap).map(([raw, canon]) => (
                  <li
                    key={raw}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      backgroundColor: "#e2e8f0",
                      padding: "0.35rem 0.55rem",
                      borderRadius: 8,
                      width: "fit-content",
                      color: "#0f172a",
                    }}
                  >
                    <span>{raw}</span>
                    <span style={{ color: "#475569" }}>→</span>
                    <span style={{ fontWeight: 600 }}>{canon}</span>

                    <button
                      onClick={() => handleRemoveAlias(raw)}
                      style={{
                        marginLeft: 6,
                        fontSize: "0.75rem",
                        border: "none",
                        padding: "0.1rem 0.4rem",
                        borderRadius: 4,
                        cursor: "pointer",
                        backgroundColor: "#0f172a",
                        color: "white",
                      }}
                    >
                      x
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Alias aggregated table */}
          <h3 style={{ ...cardTitleStyle, marginTop: "1.25rem" }}>
            Alias Aggregated Stats (BB/100)
          </h3>
          <div
            style={{
              marginTop: "0.5rem",
              maxWidth: "100%",
              overflowX: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          >
            <table
              style={{
                borderCollapse: "collapse",
                fontSize: "0.78rem",
                width: "100%",
              }}
            >
              <thead>
                <tr>
                  <th style={headerCellStyle}>Alias</th>
                  <th style={headerCellStyle}>Hands</th>
                  <th style={headerCellStyle}>BB/100</th>
                  <th style={headerCellStyle}>VPIP%</th>
                  <th style={headerCellStyle}>PFR%</th>
                  <th style={headerCellStyle}>Limp%</th>
                  <th style={headerCellStyle}>Call Open%</th>
                  <th style={headerCellStyle}>Squeeze%</th>
                  <th style={headerCellStyle}>3BET%</th>
                  <th style={headerCellStyle}>4BET%</th>
                  <th style={headerCellStyle}>Fold to 3BET%</th>
                  <th style={headerCellStyle}>Fold to 4BET%</th>
                  <th style={headerCellStyle}>WTSD%</th>
                  <th style={headerCellStyle}>W$SD%</th>
                  <th style={headerCellStyle}>WWSF%</th>
                  <th style={headerCellStyle}>Flop Cbet%</th>
                  <th style={headerCellStyle}>Fold Flop Cbet%</th>
                  <th style={headerCellStyle}>Turn Cbet%</th>
                  <th style={headerCellStyle}>Fold Turn Cbet%</th>
                  <th style={headerCellStyle}>River Cbet%</th>
                  <th style={headerCellStyle}>Fold River Cbet%</th>
                  <th style={headerCellStyle}>AF</th>
                </tr>
              </thead>
              <tbody>
                {aliasStats.map((s, idx) => (
                  <tr
                    key={s.alias}
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb",
                    }}
                  >
                     <td style={cellStyle}>{s.alias}</td>
                      <td style={cellStyle}>{s.hands}</td>
                      <td style={cellStyle}>{s["BB/100"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["VPIP%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["PFR%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["Limp%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["Call Open%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["Squeeze%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["3BET%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["4BET%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["Fold to 3BET%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["Fold to 4BET%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["WTSD%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["W$SD%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["WWSF%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["Flop Cbet%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["Fold to Flop Cbet%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["Turn Cbet%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["Fold to Turn Cbet%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["River Cbet%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s["Fold to River Cbet%"].toFixed(1)}</td>
                      <td style={cellStyle}>{s.AF.toFixed(2)}</td>
                                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderGraphs = () => {
    if (!apiResult) {
      return (
        <div style={mainViewStyle}>
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Graphs</h2>
            <p style={cardTextStyle}>
              No data yet. Go to <b>Upload & Summary</b> and run an analysis.
            </p>
          </div>
        </div>
      );
    }

    const barDataRaw = apiResult.stats.map((s) => ({
      name: s.player,
      bb100: s["BB/100"],
      vpip: s["VPIP%"],
      pfr: s["PFR%"],
    }));

    const barDataAlias = aliasStats.map((s) => ({
      name: s.alias,
      bb100: s["BB/100"],
      vpip: s["VPIP%"],
      pfr: s["PFR%"],
    }));

    return (
      <div style={mainViewStyle}>
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Graphs</h2>
          <p style={cardTextStyle}>
            Quick visualisation of winrate (BB/100) and preflop style
            (VPIP/PFR). For real bankroll over time, we can later extend the
            backend to return per-hand profit curves.
          </p>

          <div style={{ marginTop: "1rem", height: 260 }}>
            <h3 style={{ fontSize: "0.95rem", marginBottom: 4, color: "#111827" }}>
              BB/100 by Player
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barDataRaw}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="bb100" name="BB/100" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: "1.5rem", height: 260 }}>
            <h3 style={{ fontSize: "0.95rem", marginBottom: 4, color: "#111827" }}>
              BB/100 by Alias
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barDataAlias}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="bb100" name="BB/100" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: "1.5rem", height: 260 }}>
            <h3 style={{ fontSize: "0.95rem", marginBottom: 4, color: "#111827" }}>
              VPIP vs PFR (Alias)
            </h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barDataAlias}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="vpip" name="VPIP%" />
                <Bar dataKey="pfr" name="PFR%" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderAiHelper = () => (
    <div style={mainViewStyle}>
      <div style={cardStyle}>
        <h2 style={cardTitleStyle}>AI Helper</h2>
        <p style={cardTextStyle}>
          This generates a text summary of the stats that you can paste into any
          AI/chatbot to get analysis of each player&apos;s style and leaks.
        </p>
        <textarea
          value={aiSummary}
          readOnly
          rows={16}
          style={{
            marginTop: "0.75rem",
            width: "100%",
            maxWidth: 800,
            fontFamily: "monospace",
            fontSize: "0.8rem",
            padding: "0.5rem",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb",
            color: "#111827",
          }}
        />
        <button
          onClick={handleCopyAiSummary}
          disabled={!aiSummary}
          style={{
            marginTop: "0.75rem",
            padding: "0.5rem 1.1rem",
            borderRadius: 999,
            border: "none",
            backgroundColor: aiSummary ? "#2563eb" : "#9ca3af",
            color: "white",
            fontSize: "0.9rem",
            fontWeight: 500,
            cursor: aiSummary ? "pointer" : "not-allowed",
            width: "fit-content",
          }}
        >
          Copy summary for AI
        </button>
        {!apiResult && (
          <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#4b5563" }}>
            (Tip: run an analysis first to populate this.)
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: "#0b1120",
      }}
    >
      {renderSidebar()}
      <div style={{ flex: 1, backgroundColor: "#e5e7eb" }}>
        {view === "upload" && renderUploadView()}
        {view === "stats" && renderStatsTable()}
        {view === "graphs" && renderGraphs()}
        {view === "ai" && renderAiHelper()}
      </div>
    </div>
  );
};

// ---------- small style helpers ----------

const navButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.45rem 0.75rem",
  borderRadius: 8,
  border: "none",
  textAlign: "left",
  backgroundColor: active ? "#2563eb" : "transparent",
  color: active ? "white" : "#e5e7eb",
  fontSize: "0.9rem",
  cursor: "pointer",
  transition: "background-color 0.15s ease, color 0.15s ease",
});

const mainViewStyle: React.CSSProperties = {
  padding: "1.5rem 2rem",
  maxWidth: 1200,
  margin: "0 auto",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: 12,
  padding: "1.25rem 1.5rem",
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 600,
  color: "#111827",
};

const cardTextStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "#1f2937",
  marginTop: 4,
};

const cellStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  whiteSpace: "nowrap",
  color: "#111827",
  backgroundColor: "#ffffff",
};

const headerCellStyle: React.CSSProperties = {
  borderBottom: "1px solid #111827",
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  whiteSpace: "nowrap",
  backgroundColor: "#111827",
  color: "#f9fafb",
  fontWeight: 700,
  fontSize: "0.8rem",
  cursor: "pointer",
};

const aliasInputStyle: React.CSSProperties = {
  padding: "0.3rem 0.5rem",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  fontSize: "0.8rem",
  color: "#111827",
};

const SummaryItem: React.FC<{ label: string; value: number | string }> = ({
  label,
  value,
}) => (
  <div
    style={{
      padding: "0.65rem 0.75rem",
      borderRadius: 10,
      backgroundColor: "#f9fafb",
      border: "1px solid #e5e7eb",
    }}
  >
    <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>{label}</div>
    <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#111827" }}>
      {value}
    </div>
  </div>
);

export default App;
