import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import { generateTerraMindPDF } from "./reportGenerator";

const API_BASE = "/api";

// Demonstration Case Studies matching required specifications with bundled previews
const PREDEFINED_AREAS = [
  {
    id: "area_01",
    label: "Case 1",
    title: "Regional Landscape",
    description: "Forest canopy, agricultural parcels & river corridor",
    icon: "🌍",
    color: "blue",
    t0Path: "/demo_datasets/area_01/t0.jpg",
    t1Path: "/demo_datasets/area_01/t1.jpg",
    t0Name: "RegionalLandscape_Observation_T0.jpg",
    t1Name: "RegionalLandscape_Observation_T1.jpg",
    dimensions: [601, 470],
    dates: "Demonstration Epochs (Unrecorded)",
  },
  {
    id: "area_02",
    label: "Case 2",
    title: "River Basin & Water Change",
    description: "Seasonal surface water dynamics across drainage corridor",
    icon: "💧",
    color: "cyan",
    t0Path: "/demo_datasets/area_02/t0.jpg",
    t1Path: "/demo_datasets/area_02/t1.jpg",
    t0Name: "RiverBasin_Observation_T0.jpg",
    t1Name: "RiverBasin_Observation_T1.jpg",
    dimensions: [320, 470],
    dates: "Demonstration Epochs (Unrecorded)",
  },
  {
    id: "area_03",
    label: "Case 3",
    title: "Vegetation Change",
    description: "Woodland canopy tracking vegetation dynamics and surface disturbance",
    icon: "🌲",
    color: "green",
    t0Path: "/demo_datasets/area_03/t0.jpg",
    t1Path: "/demo_datasets/area_03/t1.jpg",
    t0Name: "VegetationChange_Observation_T0.jpg",
    t1Name: "VegetationChange_Observation_T1.jpg",
    dimensions: [381, 430],
    dates: "Demonstration Epochs (Unrecorded)",
  },
];

export default function App() {
  // Active mode: 'area_01' | 'area_02' | 'area_03' | 'custom'
  const [activeMode, setActiveMode] = useState("area_01");

  // Observation Images state
  const [t0Preview, setT0Preview] = useState(null);
  const [t1Preview, setT1Preview] = useState(null);
  const [t0File, setT0File] = useState(null);
  const [t1File, setT1File] = useState(null);
  const [t0Meta, setT0Meta] = useState(null);
  const [t1Meta, setT1Meta] = useState(null);

  // Validation & analysis parameters
  const [validationInfo, setValidationInfo] = useState(null);
  const [threshold, setThreshold] = useState(30);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeModuleTab, setActiveModuleTab] = useState("all");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const t0InputRef = useRef(null);
  const t1InputRef = useRef(null);
  const activeReqId = useRef(0);

  // Load first study area on startup
  useEffect(() => {
    loadStudyArea("area_01");
  }, []);

  // Load a predefined demonstration study area
  const loadStudyArea = async (areaId) => {
    setActiveMode(areaId);
    setErrorMsg(null);
    setAnalysisResult(null);
    setT0File(null);
    setT1File(null);

    // 1. Immediately set instant previews from local public static bundle (0ms latency)
    const areaDef = PREDEFINED_AREAS.find((a) => a.id === areaId);
    if (areaDef) {
      setT0Preview(areaDef.t0Path);
      setT1Preview(areaDef.t1Path);
      setT0Meta({ filename: areaDef.t0Name, dimensions: areaDef.dimensions, dates: areaDef.dates });
      setT1Meta({ filename: areaDef.t1Name, dimensions: areaDef.dimensions, dates: areaDef.dates });
      setValidationInfo({
        isValid: true,
        warnings: [
          "Demonstration Archive Tile: Predefined multi-temporal imagery loaded.",
          "Rescaling to common matrix does not ensure true geographic co-registration or radiometric calibration.",
        ],
      });
    }

    const reqId = ++activeReqId.current;

    // 2. Query backend in background to warm cache and get verified decoded data
    try {
      const res = await fetch(`${API_BASE}/study-areas/${areaId}/load`);
      if (res.ok) {
        const data = await res.json();
        if (reqId !== activeReqId.current) return;

        setT0Preview(`data:image/png;base64,${data.baselineImage}`);
        setT1Preview(`data:image/png;base64,${data.followupImage}`);
        setT0Meta({ filename: data.t0Filename, dimensions: data.dimensionsT0, dates: data.observationDates });
        setT1Meta({ filename: data.t1Filename, dimensions: data.dimensionsT1, dates: data.observationDates });
        setValidationInfo(data.validation);
        setErrorMsg(null);
      }
    } catch (err) {
      console.warn("Backend still booting or not connected:", err.message);
      // Keep instant preview intact so images remain visible without error banner
    }
  };

  // Switch to custom upload mode
  const enableCustomMode = () => {
    setActiveMode("custom");
    setT0Preview(null);
    setT1Preview(null);
    setT0File(null);
    setT1File(null);
    setT0Meta(null);
    setT1Meta(null);
    setValidationInfo(null);
    setAnalysisResult(null);
    setErrorMsg(null);
  };

  // Handle custom file upload
  const handleCustomFile = (file, target) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAnalysisResult(null);
    setErrorMsg(null);

    if (target === "t0") {
      setT0File(file);
      setT0Preview(url);
      setT0Meta({ filename: file.name, dimensions: "Pending Decoded Grid", dates: "User Upload (Date unrecorded)" });
    } else {
      setT1File(file);
      setT1Preview(url);
      setT1Meta({ filename: file.name, dimensions: "Pending Decoded Grid", dates: "User Upload (Date unrecorded)" });
    }

    setValidationInfo({
      isValid: true,
      warnings: [
        "Custom Upload: Images are treated as uncalibrated RGB rasters.",
        "Ensure both scenes represent the exact same geographical area. Rescaling does not establish geographic co-registration.",
      ],
    });
  };

  // Drag and drop handlers
  const handleDrop = (e, target) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleCustomFile(file, target);
  };
  const handleDragOver = (e) => e.preventDefault();

  // Run Environmental Analysis
  const runAnalysis = async () => {
    setLoading(true);
    setLoadingMsg("Executing tri-modular environmental analysis (Vegetation, Water, Land Cover)...");
    setErrorMsg(null);

    const reqId = ++activeReqId.current;

    try {
      const formData = new FormData();
      formData.append("threshold", threshold.toString());

      if (activeMode === "custom") {
        if (!t0File || !t1File) throw new Error("Please upload both Earlier (T0) and Later (T1) observation images first.");
        formData.append("old_image", t0File);
        formData.append("new_image", t1File);
      } else {
        formData.append("area_id", activeMode);
      }

      const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: formData });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      if (reqId !== activeReqId.current) return;

      setAnalysisResult(data);
      setValidationInfo(data.validation);
    } catch (err) {
      if (reqId === activeReqId.current) {
        if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
          setErrorMsg("Cannot connect to FastAPI backend at http://localhost:8000. Please make sure the backend is running (run: python -m uvicorn server:app --port 8000 or double-click start.bat).");
        } else {
          setErrorMsg(err.message);
        }
      }
    } finally {
      if (reqId === activeReqId.current) setLoading(false);
    }
  };

  // Direct PDF Report Download
  const handleDownloadPDF = () => {
    if (!analysisResult) return;
    setGeneratingPdf(true);
    try {
      const areaInfo = PREDEFINED_AREAS.find((a) => a.id === activeMode);
      generateTerraMindPDF({
        studyAreaTitle: areaInfo ? `${areaInfo.label}: ${areaInfo.title}` : "Custom Image Upload",
        t0Filename: t0Meta?.filename || t0File?.name || "Earlier_Observation_T0.jpg",
        t1Filename: t1Meta?.filename || t1File?.name || "Later_Observation_T1.jpg",
        t0Preview: t0Preview,
        t1Preview: t1Preview,
        t0Dimensions: t0Meta?.dimensions || "Raster Matrix",
        t1Dimensions: t1Meta?.dimensions || "Raster Matrix",
        threshold: threshold,
        result: analysisResult,
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert(`Could not generate PDF: ${err.message}`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const isCustom = activeMode === "custom";
  const canRun = !loading && t0Preview && t1Preview && (!isCustom || (t0File && t1File));

  return (
    <div className="tm-app">
      {/* ── HEADER ── */}
      <header className="tm-header">
        <div className="header-left">
          <div className="tm-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="tm-logo-icon">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </div>
          <div>
            <div className="tm-title">
              TerraMind <span className="tm-badge">AI Platform</span>
            </div>
            <div className="tm-subtitle">
              AI-Based Environmental Change Detection System · Vegetation · Water · Land Cover
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="module-counter">
            <span className="dot-pulse"></span> 3 Analysis Modules Active
          </div>
          {analysisResult && (
            <button className="tm-btn btn-pdf" onClick={handleDownloadPDF} disabled={generatingPdf}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-svg">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              {generatingPdf ? "Generating PDF..." : "Download PDF Report"}
            </button>
          )}
        </div>
      </header>

      {/* ── CASE SELECTION ── */}
      <section className="tm-card case-selector-card">
        <div className="case-selector-label">
          <span className="case-selector-title">DEMONSTRATION CASE STUDIES</span>
          <span className="case-selector-sub">Select a predefined study scenario or upload your own raster images</span>
        </div>
        <div className="case-tabs">
          {PREDEFINED_AREAS.map((area) => (
            <button
              key={area.id}
              className={`case-tab case-tab-${area.color} ${activeMode === area.id ? "case-tab-active" : ""}`}
              onClick={() => loadStudyArea(area.id)}
              disabled={loading}
            >
              <span className="case-icon">{area.icon}</span>
              <div className="case-tab-text">
                <span className="case-tab-label">{area.label}</span>
                <span className="case-tab-title">{area.title}</span>
              </div>
            </button>
          ))}
          <button
            className={`case-tab case-tab-custom ${activeMode === "custom" ? "case-tab-active" : ""}`}
            onClick={enableCustomMode}
          >
            <span className="case-icon">📁</span>
            <div className="case-tab-text">
              <span className="case-tab-label">Custom</span>
              <span className="case-tab-title">Upload Images</span>
            </div>
          </button>
        </div>
      </section>

      {/* ── OBSERVATION IMAGES PANELS ── */}
      <section className="tm-card observation-card">
        <div className="card-section-title">
          <span>Observation Imagery</span>
          <span className="card-tag">Multi-Temporal Pair</span>
        </div>

        <div className="observation-grid">
          {/* Earlier Observation (T0) */}
          <div
            className={`image-pane ${isCustom && !t0Preview ? "drop-active" : ""}`}
            onClick={() => isCustom && t0InputRef.current?.click()}
            onDrop={(e) => isCustom && handleDrop(e, "t0")}
            onDragOver={isCustom ? handleDragOver : undefined}
            style={{ cursor: isCustom ? "pointer" : "default" }}
          >
            <div className="pane-header">
              <span className="epoch-label">Earlier Observation (T0)</span>
              <span className="epoch-chip t0-chip">BASELINE</span>
            </div>
            <div className="preview-container">
              {t0Preview ? (
                <img src={t0Preview} alt="Earlier Observation T0" className="scene-img" />
              ) : (
                <div className="empty-upload-box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="upload-svg-icon">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="upload-text">{isCustom ? "Upload Earlier Image (T0)" : "Loading..."}</span>
                  <span className="upload-sub">{isCustom ? "Click or drag & drop (PNG, JPG)" : "Select a case study above"}</span>
                </div>
              )}
            </div>
            <div className="pane-footer">
              <span className="filename-text">{t0Meta?.filename || "—"}</span>
              {t0Meta?.dimensions && (
                <span className="dimension-badge">
                  {Array.isArray(t0Meta.dimensions) ? `${t0Meta.dimensions[0]}×${t0Meta.dimensions[1]} px` : t0Meta.dimensions}
                </span>
              )}
            </div>
            {isCustom && (
              <input ref={t0InputRef} type="file" accept="image/*" hidden onChange={(e) => handleCustomFile(e.target.files[0], "t0")} />
            )}
          </div>

          {/* Later Observation (T1) */}
          <div
            className={`image-pane ${isCustom && !t1Preview ? "drop-active" : ""}`}
            onClick={() => isCustom && t1InputRef.current?.click()}
            onDrop={(e) => isCustom && handleDrop(e, "t1")}
            onDragOver={isCustom ? handleDragOver : undefined}
            style={{ cursor: isCustom ? "pointer" : "default" }}
          >
            <div className="pane-header">
              <span className="epoch-label accent">Later Observation (T1)</span>
              <span className="epoch-chip t1-chip">FOLLOW-UP</span>
            </div>
            <div className="preview-container">
              {t1Preview ? (
                <img src={t1Preview} alt="Later Observation T1" className="scene-img" />
              ) : (
                <div className="empty-upload-box">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="upload-svg-icon">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="upload-text">{isCustom ? "Upload Later Image (T1)" : "Loading..."}</span>
                  <span className="upload-sub">{isCustom ? "Click or drag & drop (PNG, JPG)" : "Select a case study above"}</span>
                </div>
              )}
            </div>
            <div className="pane-footer">
              <span className="filename-text">{t1Meta?.filename || "—"}</span>
              {t1Meta?.dimensions && (
                <span className="dimension-badge">
                  {Array.isArray(t1Meta.dimensions) ? `${t1Meta.dimensions[0]}×${t1Meta.dimensions[1]} px` : t1Meta.dimensions}
                </span>
              )}
            </div>
            {isCustom && (
              <input ref={t1InputRef} type="file" accept="image/*" hidden onChange={(e) => handleCustomFile(e.target.files[0], "t1")} />
            )}
          </div>
        </div>

        {/* Validation Section */}
        {validationInfo?.warnings?.length > 0 && (
          <div className="validation-bar">
            <div className="val-header">
              <span className="val-icon">🛡️</span>
              <span className="val-title">Pre-Analysis Image Validation</span>
              <span className="val-status">Integrity Checked</span>
            </div>
            <ul className="val-warnings">
              {validationInfo.warnings.map((w, i) => (
                <li key={i}>⚠️ {w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Sensitivity & Analysis Execution Tray */}
        <div className="analysis-action-tray">
          <div className="threshold-control">
            <div className="th-label-row">
              <span className="th-title">RGB Pixel Difference Threshold (Land Cover)</span>
              <span className="th-val">{threshold} / 255</span>
            </div>
            <div className="th-slider-box">
              <input type="range" min={10} max={80} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
              <div className="th-presets">
                <span className={threshold <= 20 ? "preset active" : "preset"} onClick={() => setThreshold(15)}>High (15)</span>
                <span className={threshold > 20 && threshold <= 40 ? "preset active" : "preset"} onClick={() => setThreshold(30)}>Balanced (30)</span>
                <span className={threshold > 40 ? "preset active" : "preset"} onClick={() => setThreshold(50)}>Low (50)</span>
              </div>
            </div>
            <div className="slider-explanation">
              ℹ️ This threshold controls the RGB pixel difference calculation in the land-cover analysis.
            </div>
          </div>

          <button className="tm-btn btn-primary btn-run-analysis" disabled={!canRun} onClick={runAnalysis}>
            {loading ? (
              <>
                <span className="spinner-ring"></span>
                <span>{loadingMsg}</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="btn-svg">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span>Analyse Environmental Changes</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && <div className="error-alert-box">❌ <strong>Error:</strong> {errorMsg}</div>}
      </section>

      {/* ── RESULTS SECTION ── */}
      {analysisResult && (
        <section className="results-section">
          <div className="results-header">
            <div>
              <h2 className="results-title">Environmental Change Analysis Results</h2>
              <p className="results-subtitle">All three modules computed from actual backend calculations</p>
            </div>
            <div className="view-toggle-bar">
              {["all", "vegetation", "water", "landcover"].map((tab) => (
                <button
                  key={tab}
                  className={`toggle-btn ${activeModuleTab === tab ? "active" : ""}`}
                  onClick={() => setActiveModuleTab(tab)}
                >
                  {tab === "all" ? "All 3 Modules" : tab === "vegetation" ? "Vegetation" : tab === "water" ? "Water Bodies" : "Land Cover"}
                </button>
              ))}
            </div>
          </div>

          <div className="modules-stack">
            {/* ─────────────────────────────────────────────────────────────
                MODULE 1: VEGETATION CHANGE DETECTION
               ───────────────────────────────────────────────────────────── */}
            {(activeModuleTab === "all" || activeModuleTab === "vegetation") && (
              <div className="module-card">
                <div className="module-header">
                  <div className="module-badge badge-green">MODULE 1</div>
                  <div className="module-title-box">
                    <h3 className="module-name">Vegetation Change Detection</h3>
                    <span className="method-label">Method: {analysisResult.vegetation?.method}</span>
                  </div>
                  <div className="module-kpi">
                    <span className="kpi-tag">Net Vegetation Change</span>
                    <span className={`kpi-figure ${analysisResult.vegetation?.netShiftPct >= 0 ? "positive" : "negative"}`}>
                      {analysisResult.vegetation?.netShiftPct >= 0 ? "+" : ""}
                      {analysisResult.vegetation?.netShiftPct}%
                    </span>
                  </div>
                </div>

                <div className="module-body">
                  <div className="module-metrics-grid">
                    <div className="metric-tile">
                      <span className="tile-label">Possible Vegetation Reduction</span>
                      <span className="tile-value text-red">{analysisResult.vegetation?.lossPct}%</span>
                      <span className="tile-sub">Reduction in estimated green vegetation.</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Possible Vegetation Increase</span>
                      <span className="tile-value text-green">{analysisResult.vegetation?.growthPct}%</span>
                      <span className="tile-sub">Increase in estimated green vegetation.</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Stable Vegetation Pixels</span>
                      <span className="tile-value text-darkgreen">{analysisResult.vegetation?.stablePct}%</span>
                      <span className="tile-sub">Persistent canopy vegetation</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Estimated Cover Transition</span>
                      <span className="tile-value text-muted">
                        {analysisResult.vegetation?.baselineCoverPct}% → {analysisResult.vegetation?.followupCoverPct}%
                      </span>
                      <span className="tile-sub">Epoch T0 to Epoch T1</span>
                    </div>
                  </div>

                  <div className="map-view-box">
                    <div className="map-title-row">
                      <span className="map-caption">Vegetation Change Detection Map</span>
                      <div className="map-legend">
                        <span className="leg-item">
                          <span className="swatch red"></span> Possible Vegetation Reduction
                        </span>
                        <span className="leg-item">
                          <span className="swatch green"></span> Possible Vegetation Increase
                        </span>
                        <span className="leg-item">
                          <span className="swatch darkgreen"></span> Stable Vegetation Pixels
                        </span>
                      </div>
                    </div>
                    <div className="raster-frame">
                      <img src={`data:image/png;base64,${analysisResult.vegetation?.mapImage}`} alt="Vegetation Change Map" />
                    </div>
                    <div className="method-disclaimer">
                      <p>
                        <strong>Scientific Explanation:</strong> VARI (Visible Atmospherically Resistant Index) estimates vegetation using visible RGB image bands.
                      </p>
                      <p className="formula-line">
                        <strong>Formula:</strong> <code>VARI = (G - R) / (G + R - B)</code>
                      </p>
                      <p className="limitation-line">
                        ⚠️ <strong>Limitation:</strong> VARI is not NDVI. Accurate NDVI analysis requires calibrated Near-Infrared (NIR) satellite data.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                MODULE 2: WATER BODY CHANGE DETECTION
               ───────────────────────────────────────────────────────────── */}
            {(activeModuleTab === "all" || activeModuleTab === "water") && (
              <div className="module-card">
                <div className="module-header">
                  <div className="module-badge badge-cyan">MODULE 2</div>
                  <div className="module-title-box">
                    <h3 className="module-name">Water Body Change Detection</h3>
                    <span className="method-label">Method: {analysisResult.water?.method}</span>
                  </div>
                  <div className="module-kpi">
                    <span className="kpi-tag">Net Water Change</span>
                    <span className={`kpi-figure ${analysisResult.water?.netShiftPct >= 0 ? "positive" : "negative"}`}>
                      {analysisResult.water?.netShiftPct >= 0 ? "+" : ""}
                      {analysisResult.water?.netShiftPct}%
                    </span>
                  </div>
                </div>

                <div className="module-body">
                  <div className="module-metrics-grid">
                    <div className="metric-tile">
                      <span className="tile-label">Possible Water Increase</span>
                      <span className="tile-value text-cyan">{analysisResult.water?.expansionPct}%</span>
                      <span className="tile-sub">Increase in estimated water coverage.</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Possible Water Reduction</span>
                      <span className="tile-value text-amber">{analysisResult.water?.reductionPct}%</span>
                      <span className="tile-sub">Reduction in estimated water coverage.</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Stable Water Pixels</span>
                      <span className="tile-value text-navy">{analysisResult.water?.stablePct}%</span>
                      <span className="tile-sub">Persistent surface water areas</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Estimated Water Transition</span>
                      <span className="tile-value text-muted">
                        {analysisResult.water?.baselineCoverPct}% → {analysisResult.water?.followupCoverPct}%
                      </span>
                      <span className="tile-sub">Epoch T0 to Epoch T1</span>
                    </div>
                  </div>

                  <div className="map-view-box">
                    <div className="map-title-row">
                      <span className="map-caption">Water Body Change Detection Map</span>
                      <div className="map-legend">
                        <span className="leg-item">
                          <span className="swatch cyan"></span> Possible Water Increase
                        </span>
                        <span className="leg-item">
                          <span className="swatch amber"></span> Possible Water Reduction
                        </span>
                        <span className="leg-item">
                          <span className="swatch navy"></span> Stable Water Pixels
                        </span>
                      </div>
                    </div>
                    <div className="raster-frame">
                      <img src={`data:image/png;base64,${analysisResult.water?.mapImage}`} alt="Water Body Change Map" />
                    </div>
                    <div className="method-disclaimer">
                      <p>
                        <strong>Scientific Explanation:</strong> The system estimates possible water areas using visible RGB image information.
                      </p>
                      <p className="limitation-line">
                        ⚠️ <strong>Limitation:</strong> This method is not NDWI. Accurate NDWI analysis requires suitable Near-Infrared (NIR) satellite bands. Water increase indicates higher estimated water coverage, not verified flooding.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                MODULE 3: LAND COVER CHANGE DETECTION
               ───────────────────────────────────────────────────────────── */}
            {(activeModuleTab === "all" || activeModuleTab === "landcover") && (
              <div className="module-card">
                <div className="module-header">
                  <div className="module-badge badge-purple">MODULE 3</div>
                  <div className="module-title-box">
                    <h3 className="module-name">Land Cover Change Detection</h3>
                    <span className="method-label">Model: {analysisResult.landCover?.method}</span>
                  </div>
                  <div className="module-kpi">
                    <span className="kpi-tag">Patch Classification Changes</span>
                    <span className="kpi-figure neutral">
                      {analysisResult.landCover?.changedPatchesCount}/{analysisResult.landCover?.totalPatches} Patches
                    </span>
                  </div>
                </div>

                <div className="module-body">
                  <div className="lc-transition-banner">
                    <span className="lc-icon">🛰️</span>
                    <div className="lc-text-block">
                      <strong>Categorical Transition:</strong> {analysisResult.landCover?.transitionSummary}
                    </div>
                  </div>

                  <div className="module-metrics-grid">
                    <div className="metric-tile">
                      <span className="tile-label">Baseline Class (T0)</span>
                      <span className="tile-value text-accent">{analysisResult.landCover?.baselineClass}</span>
                      <span className="tile-sub">Model Confidence: {analysisResult.landCover?.baselineConfidence}%</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Follow-up Class (T1)</span>
                      <span className="tile-value text-cyan">{analysisResult.landCover?.followupClass}</span>
                      <span className="tile-sub">Model Confidence: {analysisResult.landCover?.followupConfidence}%</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">RGB Pixel Difference</span>
                      <span className="tile-value text-crimson">{analysisResult.landCover?.pixelShiftPct}%</span>
                      <span className="tile-sub">Pixels with delta &gt; threshold {threshold}</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">RGB Pixel Stability</span>
                      <span className="tile-value text-darkgreen">{analysisResult.landCover?.pixelStablePct}%</span>
                      <span className="tile-sub">Spectrally stable pixels</span>
                    </div>
                  </div>

                  <div className="grid-matrix-box">
                    <span className="matrix-title">3×3 Spatial Patch Land Cover Transition Grid</span>
                    <div className="quadrant-grid">
                      {analysisResult.landCover?.patchGridTransitions?.map((item, idx) => (
                        <div key={idx} className={`quadrant-cell ${item.isChanged ? "cell-changed" : "cell-stable"}`}>
                          <span className="quad-coord">R{item.row + 1}:C{item.col + 1}</span>
                          <span className="quad-classes">{item.t0Class} → {item.t1Class}</span>
                          <span className="quad-status">{item.isChanged ? "Class Shifted" : "Class Stable"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="map-view-box">
                    <div className="map-title-row">
                      <span className="map-caption">RGB Pixel Difference Map</span>
                      <div className="map-legend">
                        <span className="leg-item">
                          <span className="swatch crimson"></span> Altered Pixels (&gt; Threshold {threshold})
                        </span>
                        <span className="leg-item">
                          <span className="swatch dimmed"></span> Stable Background Pixels
                        </span>
                      </div>
                    </div>
                    <div className="raster-frame">
                      <img src={`data:image/png;base64,${analysisResult.landCover?.spectralDeltaMap}`} alt="RGB Pixel Difference Map" />
                    </div>
                    <div className="method-disclaimer">
                      <p>
                        <strong>Deep Learning Specification:</strong> ResNet50 is a pretrained deep learning model that classifies image patches into land-cover categories.
                      </p>
                      <ul className="disclaimer-bullet-list">
                        <li>Confidence is the model's prediction score, not guaranteed accuracy.</li>
                        <li>The 3×3 grid represents image patch classification. It is not pixel-level semantic segmentation.</li>
                        <li>RGB pixel difference and AI land-cover classification are two separate calculations.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── METHODOLOGY & SCIENTIFIC LIMITATIONS CARD ── */}
      <section className="tm-card limitations-card">
        <div className="limitations-header">
          <span className="lim-icon">🔬</span>
          <div>
            <h4 className="lim-title">Scientific Methodology & Limitations Disclosure</h4>
            <span className="lim-subtitle">Formal academic disclosure of optical constraints and raster interpretation principles</span>
          </div>
        </div>

        <div className="limitations-grid">
          <div className="lim-item">
            <span className="lim-num">1</span>
            <div>
              <strong>Visible RGB Imagery:</strong> Uploaded images contain visible RGB information only and lack calibrated infrared sensors.
            </div>
          </div>
          <div className="lim-item">
            <span className="lim-num">2</span>
            <div>
              <strong>No NIR Bands:</strong> RGB imagery does not provide Near-Infrared (NIR) bands required for genuine multispectral remote sensing.
            </div>
          </div>
          <div className="lim-item">
            <span className="lim-num">3</span>
            <div>
              <strong>VARI is Not NDVI:</strong> VARI provides an optical greenness approximation. True NDVI analysis requires calibrated NIR satellite bands.
            </div>
          </div>
          <div className="lim-item">
            <span className="lim-num">4</span>
            <div>
              <strong>Optical Water is Not NDWI:</strong> Water detection uses optical visible absorption. True NDWI requires NIR sensors. Water increase does not prove flooding.
            </div>
          </div>
          <div className="lim-item">
            <span className="lim-num">5</span>
            <div>
              <strong>Pixel vs Ground Truth:</strong> Image pixel differences do not prove actual geographical environmental changes; illumination variance can cause deltas.
            </div>
          </div>
          <div className="lim-item">
            <span className="lim-num">6</span>
            <div>
              <strong>Geographical Co-Registration:</strong> Images must be geographically aligned for reliable comparisons. Rescaling does not establish co-registration.
            </div>
          </div>
          <div className="lim-item">
            <span className="lim-num">7</span>
            <div>
              <strong>Pixel Proportions:</strong> Calculated percentages represent image pixel proportions, not actual land area in hectares.
            </div>
          </div>
          <div className="lim-item">
            <span className="lim-num">8</span>
            <div>
              <strong>Demonstration Imagery:</strong> Predefined demonstration imagery does not have ground-truth verified geographical coordinates or observation dates.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
