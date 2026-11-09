import React, { useState, useRef, useEffect } from "react";
import "./App.css";

const API_ANALYZE = "/api/analyze";
const API_DEMO = "/api/demo";

export default function App() {
  const [baselineFile, setBaselineFile] = useState(null);
  const [followupFile, setFollowupFile] = useState(null);
  const [baselinePreview, setBaselinePreview] = useState(null);
  const [followupPreview, setFollowupPreview] = useState(null);
  const [threshold, setThreshold] = useState(30);

  const [activeCategory, setActiveCategory] = useState("vegetation"); // 'vegetation' | 'water' | 'landcover'
  const [sceneView, setSceneView] = useState("followup"); // 'baseline' | 'followup' | 'split'

  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const baselineInputRef = useRef(null);
  const followupInputRef = useRef(null);

  // Auto-load sample scene on first launch so the dashboard is immediately rich & active
  useEffect(() => {
    loadDemoScene();
  }, []);

  const loadDemoScene = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(API_DEMO);
      if (!res.ok) throw new Error("Could not load demo scene");
      const data = await res.json();
      setAnalysis(data);
      setBaselinePreview(`data:image/png;base64,${data.baselineImage}`);
      setFollowupPreview(`data:image/png;base64,${data.followupImage}`);
    } catch (err) {
      console.warn("Demo load fallback:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file, target) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (target === "baseline") {
      setBaselineFile(file);
      setBaselinePreview(url);
    } else {
      setFollowupFile(file);
      setFollowupPreview(url);
    }
    setAnalysis(null);
    setErrorMsg(null);
  };

  const runAnalysis = async () => {
    if (!baselineFile || !followupFile) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const form = new FormData();
      form.append("old_image", baselineFile);
      form.append("new_image", followupFile);
      form.append("threshold", threshold.toString());

      const res = await fetch(API_ANALYZE, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Analytics server error (${res.status})`);
      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      setErrorMsg(err.message || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!analysis) return;
    const rows = [
      ["TERRAMIND GEOSPATIAL ENVIRONMENTAL REPORT"],
      ["Timestamp", new Date().toISOString()],
      ["Baseline Scene", analysis.oldFilename],
      ["Follow-up Scene", analysis.newFilename],
      ["Resolution", `${analysis.dimensions[0]} x ${analysis.dimensions[1]} px`],
      ["Detection Sensitivity", `${analysis.threshold} / 255`],
      [],
      ["CATEGORY 1: VEGETATION DYNAMICS (VARI)"],
      ["Baseline Canopy Cover (%)", analysis.vegetation.baselinePct],
      ["Follow-up Canopy Cover (%)", analysis.vegetation.followupPct],
      ["Net Canopy Shift (%)", analysis.vegetation.netChangePct],
      ["Canopy Loss / Clearing (%)", analysis.vegetation.lossPct],
      ["Canopy Gain / Reforestation (%)", analysis.vegetation.gainPct],
      [],
      ["CATEGORY 2: HYDROLOGICAL DYNAMICS (WATER)"],
      ["Baseline Water Area (%)", analysis.water.baselinePct],
      ["Follow-up Water Area (%)", analysis.water.followupPct],
      ["Net Water Shift (%)", analysis.water.netChangePct],
      ["Water Loss / Drying (%)", analysis.water.lossPct],
      ["Water Gain / Flooding (%)", analysis.water.gainPct],
      [],
      ["CATEGORY 3: LAND COVER CLASSIFICATION (EUROSAT)"],
      ["Spectral Surface Shift (%)", analysis.landCover.surfaceShiftPct],
      ["Surface Stability (%)", analysis.landCover.stabilityPct],
      ["Pre-Event Classification", analysis.landCover.baselineClass],
      ["Post-Event Classification", analysis.landCover.followupClass],
    ];

    const csvStr = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvStr], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terramind_geointel_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="platform">
      {/* ── Precision Navigation Bar ── */}
      <header className="navbar">
        <div className="nav-left">
          <div className="logo-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="logo-svg">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </div>
          <div>
            <div className="platform-title">TerraMind Earth Intelligence</div>
            <div className="platform-sub">Sentinel-2 Environmental Change Analysis Platform</div>
          </div>
        </div>

        <div className="nav-right">
          <button className="btn-ghost" onClick={loadDemoScene} title="Reload demonstration satellite scene">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Load Sample Scene
          </button>

          {analysis && (
            <button className="btn-export" onClick={downloadReport}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Export Report
            </button>
          )}
        </div>
      </header>

      {/* ── Mission Control & Scene Ingestion Tray ── */}
      <section className="control-strip">
        <div className="scenes-input-grid">
          {/* Baseline Scene */}
          <div
            className={`scene-dropcard ${baselinePreview ? "has-data" : ""}`}
            onClick={() => baselineInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files[0], "baseline");
            }}
          >
            <input
              ref={baselineInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleFile(e.target.files[0], "baseline")}
            />
            {baselinePreview ? (
              <div className="dropcard-loaded">
                <img src={baselinePreview} alt="Baseline Preview" className="thumb" />
                <div className="info">
                  <span className="epoch-tag">Epoch T₀ • Baseline</span>
                  <span className="filename">{analysis?.oldFilename || baselineFile?.name || "Baseline Scene"}</span>
                  <span className="meta">{analysis ? `${analysis.dimensions[0]}×${analysis.dimensions[1]} px` : "Ready"}</span>
                </div>
                <button className="btn-replace" onClick={(e) => { e.stopPropagation(); baselineInputRef.current?.click(); }}>Change</button>
              </div>
            ) : (
              <div className="dropcard-empty">
                <span className="plus-icon">+</span>
                <span className="label">Ingest Baseline Satellite Scene (T₀)</span>
                <span className="hint">Drag & drop GeoTIFF / JPG / PNG</span>
              </div>
            )}
          </div>

          {/* Follow-up Scene */}
          <div
            className={`scene-dropcard ${followupPreview ? "has-data" : ""}`}
            onClick={() => followupInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files[0], "followup");
            }}
          >
            <input
              ref={followupInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleFile(e.target.files[0], "followup")}
            />
            {followupPreview ? (
              <div className="dropcard-loaded">
                <img src={followupPreview} alt="Follow-up Preview" className="thumb" />
                <div className="info">
                  <span className="epoch-tag accent">Epoch T₁ • Follow-up</span>
                  <span className="filename">{analysis?.newFilename || followupFile?.name || "Follow-up Scene"}</span>
                  <span className="meta">{analysis ? `${analysis.dimensions[0]}×${analysis.dimensions[1]} px` : "Ready"}</span>
                </div>
                <button className="btn-replace" onClick={(e) => { e.stopPropagation(); followupInputRef.current?.click(); }}>Change</button>
              </div>
            ) : (
              <div className="dropcard-empty">
                <span className="plus-icon">+</span>
                <span className="label">Ingest Follow-up Satellite Scene (T₁)</span>
                <span className="hint">Drag & drop GeoTIFF / JPG / PNG</span>
              </div>
            )}
          </div>
        </div>

        {/* Inference Execution Controls */}
        <div className="execution-bar">
          <div className="param-group">
            <div className="param-label-row">
              <span className="param-title">Change Sensitivity</span>
              <span className="param-value">{threshold} / 255</span>
            </div>
            <div className="param-slider-wrap">
              <input
                type="range"
                min={10}
                max={80}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <div className="preset-buttons">
                <button className={`preset ${threshold === 15 ? "active" : ""}`} onClick={() => setThreshold(15)}>15</button>
                <button className={`preset ${threshold === 30 ? "active" : ""}`} onClick={() => setThreshold(30)}>30</button>
                <button className={`preset ${threshold === 50 ? "active" : ""}`} onClick={() => setThreshold(50)}>50</button>
              </div>
            </div>
          </div>

          <button
            className="btn-analyze"
            disabled={(!baselineFile && !analysis) || (!followupFile && !analysis) || loading}
            onClick={baselineFile && followupFile ? runAnalysis : loadDemoScene}
          >
            {loading ? (
              <>
                <span className="loader-spin"></span>
                <span>Inferring...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="btn-icon">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span>Run Analysis</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && <div className="error-alert">{errorMsg}</div>}
      </section>

      {/* ── Main 3-Category Analysis Dashboard ── */}
      {analysis && (
        <main className="dashboard-content">
          {/* Tab Navigation for 3 Core Categories */}
          <div className="category-tabs">
            <button
              className={`cat-tab ${activeCategory === "vegetation" ? "active" : ""}`}
              onClick={() => setActiveCategory("vegetation")}
            >
              <div className="tab-icon-wrap green-glow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cat-svg">
                  <path d="M12 2L9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1z"></path>
                </svg>
              </div>
              <div className="tab-meta">
                <span className="tab-heading">Vegetation Change</span>
                <span className="tab-sub">VARI Canopy Dynamics</span>
              </div>
              <span className={`tab-delta ${analysis.vegetation.netChangePct >= 0 ? "positive" : "negative"}`}>
                {analysis.vegetation.netChangePct >= 0 ? "+" : ""}{analysis.vegetation.netChangePct}%
              </span>
            </button>

            <button
              className={`cat-tab ${activeCategory === "water" ? "active" : ""}`}
              onClick={() => setActiveCategory("water")}
            >
              <div className="tab-icon-wrap cyan-glow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cat-svg">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                </svg>
              </div>
              <div className="tab-meta">
                <span className="tab-heading">Water Change</span>
                <span className="tab-sub">Surface Hydrology Shifts</span>
              </div>
              <span className={`tab-delta ${analysis.water.netChangePct >= 0 ? "positive" : "negative"}`}>
                {analysis.water.netChangePct >= 0 ? "+" : ""}{analysis.water.netChangePct}%
              </span>
            </button>

            <button
              className={`cat-tab ${activeCategory === "landcover" ? "active" : ""}`}
              onClick={() => setActiveCategory("landcover")}
            >
              <div className="tab-icon-wrap purple-glow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="cat-svg">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </div>
              <div className="tab-meta">
                <span className="tab-heading">Land Cover Change</span>
                <span className="tab-sub">EuroSAT Deep Classification</span>
              </div>
              <span className="tab-delta neutral">
                {analysis.landCover.surfaceShiftPct}% Altered
              </span>
            </button>
          </div>

          {/* ── Active Category Analytics Workspace ── */}
          <div className="analytics-stage">
            {/* 1. VEGETATION VIEW */}
            {activeCategory === "vegetation" && (
              <div className="stage-grid">
                {/* Metric Summary Column */}
                <div className="metric-deck">
                  <div className="metric-box primary-box">
                    <div className="metric-label">Vegetation Cover Transition</div>
                    <div className="dual-stat">
                      <div className="stat-unit">
                        <span className="unit-label">T₀ Baseline</span>
                        <span className="unit-val">{analysis.vegetation.baselinePct}%</span>
                      </div>
                      <span className="arrow-sep">➔</span>
                      <div className="stat-unit">
                        <span className="unit-label">T₁ Follow-up</span>
                        <span className="unit-val">{analysis.vegetation.followupPct}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="metric-box">
                    <div className="metric-label">Canopy Surface Breakdown</div>
                    <div className="bar-group">
                      <div className="bar-row">
                        <div className="bar-info">
                          <span className="chip-indicator red"></span>
                          <span>Canopy Loss / Clearing</span>
                        </div>
                        <span className="bar-val text-red">{analysis.vegetation.lossPct}%</span>
                      </div>
                      <div className="bar-row">
                        <div className="bar-info">
                          <span className="chip-indicator green"></span>
                          <span>Canopy Gain / Reforestation</span>
                        </div>
                        <span className="bar-val text-green">{analysis.vegetation.gainPct}%</span>
                      </div>
                      <div className="bar-row">
                        <div className="bar-info">
                          <span className="chip-indicator dark-green"></span>
                          <span>Persistent Healthy Canopy</span>
                        </div>
                        <span className="bar-val text-dim">
                          {(analysis.vegetation.followupPct - analysis.vegetation.gainPct).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="metric-box info-note">
                    <span className="note-title">Analytical Index</span>
                    <p>Visible Atmospherically Resistant Index (VARI) normalizes atmospheric aerosols to quantify relative chlorophyll and green leaf canopy fraction.</p>
                  </div>
                </div>

                {/* Imagery Dual Viewer */}
                <div className="dual-viewer">
                  <div className="viewer-pane">
                    <div className="viewer-toolbar">
                      <span className="pane-title">Optical True Color</span>
                      <div className="toggle-group">
                        <button className={`toggle-opt ${sceneView === "baseline" ? "active" : ""}`} onClick={() => setSceneView("baseline")}>T₀ Baseline</button>
                        <button className={`toggle-opt ${sceneView === "followup" ? "active" : ""}`} onClick={() => setSceneView("followup")}>T₁ Follow-up</button>
                      </div>
                    </div>
                    <div className="canvas-frame">
                      <img
                        src={sceneView === "baseline" ? baselinePreview : followupPreview}
                        alt="Optical Scene"
                      />
                    </div>
                  </div>

                  <div className="viewer-pane">
                    <div className="viewer-toolbar">
                      <span className="pane-title">Vegetation Shift Map</span>
                      <div className="legend-strip">
                        <span className="leg-item"><span className="dot red"></span> Loss</span>
                        <span className="leg-item"><span className="dot green"></span> Gain</span>
                        <span className="leg-item"><span className="dot dark-green"></span> Stable</span>
                      </div>
                    </div>
                    <div className="canvas-frame">
                      <img
                        src={`data:image/png;base64,${analysis.vegetation.mapImage}`}
                        alt="Vegetation Dynamics Map"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. WATER VIEW */}
            {activeCategory === "water" && (
              <div className="stage-grid">
                {/* Metric Summary Column */}
                <div className="metric-deck">
                  <div className="metric-box primary-box">
                    <div className="metric-label">Surface Water Extent</div>
                    <div className="dual-stat">
                      <div className="stat-unit">
                        <span className="unit-label">T₀ Baseline</span>
                        <span className="unit-val">{analysis.water.baselinePct}%</span>
                      </div>
                      <span className="arrow-sep">➔</span>
                      <div className="stat-unit">
                        <span className="unit-label">T₁ Follow-up</span>
                        <span className="unit-val">{analysis.water.followupPct}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="metric-box">
                    <div className="metric-label">Hydrological Dynamics</div>
                    <div className="bar-group">
                      <div className="bar-row">
                        <div className="bar-info">
                          <span className="chip-indicator amber"></span>
                          <span>Water Loss (Receded / Dried)</span>
                        </div>
                        <span className="bar-val text-amber">{analysis.water.lossPct}%</span>
                      </div>
                      <div className="bar-row">
                        <div className="bar-info">
                          <span className="chip-indicator cyan"></span>
                          <span>Water Inundation / Flooding</span>
                        </div>
                        <span className="bar-val text-cyan">{analysis.water.gainPct}%</span>
                      </div>
                      <div className="bar-row">
                        <div className="bar-info">
                          <span className="chip-indicator navy"></span>
                          <span>Permanent Water Bed</span>
                        </div>
                        <span className="bar-val text-dim">
                          {(analysis.water.followupPct - analysis.water.gainPct).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="metric-box info-note">
                    <span className="note-title">Analytical Index</span>
                    <p>Optical surface water segmentation isolates bodies using near-infrared/red reflectance absorption curves to pinpoint recession vs flood expansion.</p>
                  </div>
                </div>

                {/* Imagery Dual Viewer */}
                <div className="dual-viewer">
                  <div className="viewer-pane">
                    <div className="viewer-toolbar">
                      <span className="pane-title">Optical True Color</span>
                      <div className="toggle-group">
                        <button className={`toggle-opt ${sceneView === "baseline" ? "active" : ""}`} onClick={() => setSceneView("baseline")}>T₀ Baseline</button>
                        <button className={`toggle-opt ${sceneView === "followup" ? "active" : ""}`} onClick={() => setSceneView("followup")}>T₁ Follow-up</button>
                      </div>
                    </div>
                    <div className="canvas-frame">
                      <img
                        src={sceneView === "baseline" ? baselinePreview : followupPreview}
                        alt="Optical Scene"
                      />
                    </div>
                  </div>

                  <div className="viewer-pane">
                    <div className="viewer-toolbar">
                      <span className="pane-title">Hydrological Inundation & Recession</span>
                      <div className="legend-strip">
                        <span className="leg-item"><span className="dot cyan"></span> Flooded</span>
                        <span className="leg-item"><span className="dot amber"></span> Dried</span>
                        <span className="leg-item"><span className="dot navy"></span> Stable</span>
                      </div>
                    </div>
                    <div className="canvas-frame">
                      <img
                        src={`data:image/png;base64,${analysis.water.mapImage}`}
                        alt="Water Dynamic Map"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. LAND COVER VIEW */}
            {activeCategory === "landcover" && (
              <div className="stage-grid">
                {/* Metric Summary Column */}
                <div className="metric-deck">
                  <div className="metric-box primary-box">
                    <div className="metric-label">EuroSAT AI Category Shift</div>
                    <div className="transition-card">
                      <div className="trans-col">
                        <span className="trans-epoch">T₀ Baseline</span>
                        <span className="trans-title">{analysis.landCover.baselineClass}</span>
                        <span className="trans-sub">{analysis.landCover.baselineConf}% model score</span>
                      </div>
                      <span className="trans-arrow">➔</span>
                      <div className="trans-col">
                        <span className="trans-epoch accent">T₁ Follow-up</span>
                        <span className="trans-title accent">{analysis.landCover.followupClass}</span>
                        <span className="trans-sub">{analysis.landCover.followupConf}% model score</span>
                      </div>
                    </div>
                  </div>

                  <div className="metric-box">
                    <div className="metric-label">Surface Alteration Index</div>
                    <div className="bar-group">
                      <div className="bar-row">
                        <div className="bar-info">
                          <span className="chip-indicator crimson"></span>
                          <span>Altered Structural Surface</span>
                        </div>
                        <span className="bar-val text-crimson">{analysis.landCover.surfaceShiftPct}%</span>
                      </div>
                      <div className="bar-row">
                        <div className="bar-info">
                          <span className="chip-indicator dark-green"></span>
                          <span>Unmodified Land Matrix</span>
                        </div>
                        <span className="bar-val text-dim">{analysis.landCover.stabilityPct}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="metric-box">
                    <div className="metric-label">EuroSAT Probability Distribution (T₁)</div>
                    <div className="prob-stack">
                      {analysis.landCover.newPredictions.map((pred, i) => (
                        <div key={i} className="prob-item">
                          <div className="prob-header">
                            <span>{pred.class}</span>
                            <span>{pred.confidence.toFixed(1)}%</span>
                          </div>
                          <div className="prob-bar">
                            <div className="prob-fill" style={{ width: `${Math.min(100, pred.confidence)}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Imagery Dual Viewer */}
                <div className="dual-viewer">
                  <div className="viewer-pane">
                    <div className="viewer-toolbar">
                      <span className="pane-title">Optical True Color</span>
                      <div className="toggle-group">
                        <button className={`toggle-opt ${sceneView === "baseline" ? "active" : ""}`} onClick={() => setSceneView("baseline")}>T₀ Baseline</button>
                        <button className={`toggle-opt ${sceneView === "followup" ? "active" : ""}`} onClick={() => setSceneView("followup")}>T₁ Follow-up</button>
                      </div>
                    </div>
                    <div className="canvas-frame">
                      <img
                        src={sceneView === "baseline" ? baselinePreview : followupPreview}
                        alt="Optical Scene"
                      />
                    </div>
                  </div>

                  <div className="viewer-pane">
                    <div className="viewer-toolbar">
                      <span className="pane-title">Structural Alteration Map</span>
                      <div className="legend-strip">
                        <span className="leg-item"><span className="dot crimson"></span> Alteration (&gt; {analysis.threshold})</span>
                      </div>
                    </div>
                    <div className="canvas-frame">
                      <img
                        src={`data:image/png;base64,${analysis.landCover.mapImage}`}
                        alt="Land Cover Map"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
