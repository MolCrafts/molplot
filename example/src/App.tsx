import { defineMolplotChart } from "@molcrafts/molplot";
import { createElement, useEffect, useState } from "react";

defineMolplotChart();

const ENERGY_SPEC = JSON.stringify({
  mark: { type: "line", point: true },
  data: {
    values: [
      { step: 0, energy: 1 },
      { step: 1, energy: 0.66 },
      { step: 2, energy: 0.48 },
      { step: 3, energy: 0.35 },
      { step: 4, energy: 0.29 },
    ],
  },
  encoding: {
    x: {
      field: "step",
      type: "quantitative",
      title: "Simulation step",
    },
    y: {
      field: "energy",
      type: "quantitative",
      title: "Energy (a.u.)",
    },
  },
});

export function App() {
  const [preset, setPreset] = useState("molplot");
  const [dark, setDark] = useState(false);
  const [interactive, setInteractive] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const foreground = dark ? "#e8eee9" : "#14271d";
  const background = dark ? "#101813" : "#f5f7f5";
  const surface = dark ? "#17231b" : "#ffffff";
  const rule = dark ? "#385044" : "#cad5ce";

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: "32px 20px",
        background,
        color: foreground,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div style={{ width: "min(100%, 760px)", margin: "0 auto" }}>
        <header style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.58,
            }}
          >
            Local development
          </div>
          <h1 style={{ margin: "6px 0 4px", fontSize: 26 }}>
            MolPlot Web Component Example
          </h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.68 }}>
            This page imports <code>core/src</code> directly. Changes hot-reload
            without an npm release.
          </p>
        </header>

        <section
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            marginBottom: 16,
            padding: "10px 12px",
            border: `1px solid ${rule}`,
            borderRadius: 8,
            background: surface,
          }}
        >
          <label style={{ fontSize: 13 }}>
            Preset{" "}
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value)}
            >
              <option value="molplot">molplot</option>
              <option value="molplot-paper">molplot-paper</option>
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            <input
              type="checkbox"
              checked={interactive}
              onChange={(event) => setInteractive(event.target.checked)}
            />{" "}
            interactive
          </label>
          <label style={{ fontSize: 13 }}>
            <input
              type="checkbox"
              checked={dark}
              onChange={(event) => setDark(event.target.checked)}
            />{" "}
            dark
          </label>
        </section>

        <section
          style={{
            padding: 6,
            border: `1px solid ${rule}`,
            borderRadius: 10,
            background: surface,
          }}
        >
          {createElement("molplot-chart", {
            preset,
            theme: dark ? "dark" : "light",
            interactive: String(interactive),
            spec: ENERGY_SPEC,
          })}
        </section>

        <p style={{ margin: "12px 2px 0", fontSize: 12, opacity: 0.62 }}>
          Drag to pan · wheel over an axis to zoom · Shift + wheel zooms both
          axes · double-click resets.
        </p>
      </div>
    </main>
  );
}
