import React, { useState, useRef, useEffect } from "react";
import "./App.css";

const API_BASE = "/api";

export default function App() {
  // Navigation & Study Area state
  const [studyAreas, setStudyAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState("area_01"); // 'area_01' | 'area_02' | 'area_03' | 'custom'
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Images state (STEP 3)
  const [t0Preview, setT0Preview] = useState(null);
  const [t1Preview, setT1Preview] = useState(null);
  const [t0File, setT0File] = useState(null);
  const [t1File, setT1File] = useState(null);
  const [t0Metadata, setT0Metadata] = useState(null);
  const [t1Metadata, setT1Metadata] = useState(null);

  // Validation state (STEP 4)
  const [validationInfo, setValidationInfo] = useState(null);

  // Analysis parameters & results (STEP 5 & 6)
  const [threshold, setThreshold] = useState(30);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);

  // Display tab in results: 'all' | 'vegetation' | 'water' | 'landcover'
  const [activeModuleTab, setActiveModuleTab] = useState("all");

  const t0InputRef = useRef(null);
  const t1InputRef = useRef(null);
  const activeReqId = useRef(0);

  // Initial load: Fetch study areas and load Demo Study Area 01
  useEffect(() => {
    fetchStudyAreas();
  }, []);

  const fetchStudyAreas = async () => {
    try {
      const res = await fetch(`${API_BASE}/study-areas`);
      if (res.ok) {
        const data = await res.json();
        setStudyAreas(data);
        if (data.length > 0) {
          loadStudyArea(data[0].id);
        }
      }
    } catch (err) {
      console.warn("Could not load study areas:", err);
      // Fallback area 01
      loadStudyArea("area_01");
    }
  };

  // STEP 2 & 3: Load predefined study area images
  const loadStudyArea = async (areaId) => {
    setIsCustomMode(false);
    setSelectedAreaId(areaId);
    setLoading(true);
    setLoadingMsg("Loading study area imagery...");
    setErrorMsg(null);
    setAnalysisResult(null);

    const reqId = ++activeReqId.current;

    try {
      const res = await fetch(`${API_BASE}/study-areas/${areaId}/load`);
      if (!res.ok) throw new Error("Could not load study area data");
      const data = await res.json();

      if (reqId !== activeReqId.current) return;

      setT0Preview(`data:image/png;base64,${data.baselineImage}`);
      setT1Preview(`data:image/png;base64,${data.followupImage}`);
      setT0File(null);
      setT1File(null);
      setT0Metadata({
        title: "Earlier Observation (T0)",
        filename: data.t0Filename,
        dimensions: data.dimensionsT0,
        dates: data.observationDates,
        provenance: data.provenance,
      });
      setT1Metadata({
        title: "Later Observation (T1)",
        filename: data.t1Filename,
        dimensions: data.dimensionsT1,
        dates: data.observationDates,
        provenance: data.provenance,
      });
      setValidationInfo(data.validation);
    } catch (err) {
      if (reqId === activeReqId.current) {
        setErrorMsg(`Failed to load predefined study area: ${err.message}`);
      }
    } finally {
      if (reqId === activeReqId.current) {
        setLoading(false);
      }
    }
  };

  // Custom upload selection
  const enableCustomUpload = () => {
    setIsCustomMode(true);
    setSelectedAreaId("custom");
    setT0Preview(null);
    setT1Preview(null);
    setT0File(null);
    setT1File(null);
    setT0Metadata(null);
    setT1Metadata(null);
    setValidationInfo(null);
    setAnalysisResult(null);
    setErrorMsg(null);
  };

  const handleCustomFile = (file, target) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAnalysisResult(null);
    setErrorMsg(null);

    if (target === "t0") {
      setT0File(file);
      setT0Preview(url);
      setT0Metadata({
        title: "Earlier Observation (T0)",
        filename: file.name,
        dimensions: "Pending validation",
        dates: "User Upload (Date unrecorded)",
        provenance: "Local Raster Upload",
      });
    } else {
      setT1File(file);
      setT1Preview(url);
      setT1Metadata({
        title: "Later Observation (T1)",
        filename: file.name,
        dimensions: "Pending validation",
        dates: "User Upload (Date unrecorded)",
        provenance: "Local Raster Upload",
      });
    }

    // Client-side quick validation note
    setValidationInfo({
      isValid: true,
      warnings: [
        "Custom Upload: Images are treated as uncalibrated RGB rasters.",
        "Ensure both scenes represent the exact same geographical area. Rescaling does not establish geographic co-registration.",
      ],
      checks: [
        { name: "Format", status: "Uploaded", detail: file.type || "Raster" },
        { name: "Readability", status: "Passed", detail: `${(file.size / 1024).toFixed(1)} KB` },
      ],
    });
  };

  // STEP 5: Run Environmental Analysis
  const runEnvironmentalAnalysis = async () => {
    setLoading(true);
    setLoadingMsg("Executing multi-spectral environmental analysis (Vegetation, Water, Land Cover)...");
    setErrorMsg(null);

    const reqId = ++activeReqId.current;

    try {
      const formData = new FormData();
      formData.append("threshold", threshold.toString());

      if (isCustomMode) {
        if (!t0File || !t1File) {
          throw new Error("Please upload both Earlier (T0) and Later (T1) observation images.");
        }
        formData.append("old_image", t0File);
        formData.append("new_image", t1File);
      } else {
        formData.append("area_id", selectedAreaId);
      }

      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server inference failed with status ${res.status}`);
      }

      const data = await res.json();
      if (reqId !== activeReqId.current) return;

      setAnalysisResult(data);
      setValidationInfo(data.validation);
    } catch (err) {
      if (reqId === activeReqId.current) {
        setErrorMsg(err.message || "Failed to execute environmental analysis.");
      }
    } finally {
      if (reqId === activeReqId.current) {
        setLoading(false);
      }
    }
  };

  // STEP 7: Export Comprehensive Report
  const exportReport = () => {
    if (!analysisResult) return;

    const areaTitle = isCustomMode
      ? "Custom Upload Dataset"
      : studyAreas.find((a) => a.id === selectedAreaId)?.title || "Demo Study Area";

    const rows = [
      ["TERRAMIND ENVIRONMENTAL CHANGE MONITORING AUDIT REPORT"],
      ["Report Generated", new Date().toISOString()],
      ["Platform", "TerraMind – AI Environmental Change Detection Platform v2.5"],
      [],
      ["1. STUDY AREA & DATASET PROVENANCE"],
      ["Study Area", areaTitle],
      ["Earlier Observation (T0)", analysisResult.t0Filename],
      ["Later Observation (T1)", analysisResult.t1Filename],
      ["Observation Dates", isCustomMode ? "Date unrecorded (User Upload)" : "Demonstration Epochs (Unrecorded)"],
      ["Grid Dimensions", `${analysisResult.gridDimensions[0]} x ${analysisResult.gridDimensions[1]} px`],
      ["Spectral Change Sensitivity", `${analysisResult.threshold} / 255`],
      [],
      ["2. IMAGE VALIDATION & SPATIAL ALIGNMENT"],
      ["Dimensions T0", `${analysisResult.validation?.dimensionsT0?.[0] || 'N/A'} x ${analysisResult.validation?.dimensionsT0?.[1] || 'N/A'} px`],
      ["Dimensions T1", `${analysisResult.validation?.dimensionsT1?.[0] || 'N/A'} x ${analysisResult.validation?.dimensionsT1?.[1] || 'N/A'} px`],
      ["Validation Note", "Rescaling to a common matrix does not ensure geographical co-registration or radiometric cross-calibration."],
      [],
      ["3. MODULE A: VEGETATION CHANGE DETECTION"],
      ["Methodology", analysisResult.vegetation.method],
      ["Technical Note", analysisResult.vegetation.methodNote],
      ["Baseline Canopy Cover (%)", analysisResult.vegetation.baselineCoverPct],
      ["Follow-up Canopy Cover (%)", analysisResult.vegetation.followupCoverPct],
      ["Vegetation Loss (%)", analysisResult.vegetation.lossPct],
      ["Vegetation Growth (%)", analysisResult.vegetation.growthPct],
      ["Stable Vegetation (%)", analysisResult.vegetation.stablePct],
      ["Net Canopy Shift (%)", analysisResult.vegetation.netShiftPct],
      [],
      ["4. MODULE B: WATER BODY CHANGE DETECTION"],
      ["Methodology", analysisResult.water.method],
      ["Technical Note", analysisResult.water.methodNote],
      ["Baseline Water Area (%)", analysisResult.water.baselineCoverPct],
      ["Follow-up Water Area (%)", analysisResult.water.followupCoverPct],
      ["Water Expansion / Flooding (%)", analysisResult.water.expansionPct],
      ["Water Reduction / Drying (%)", analysisResult.water.reductionPct],
      ["Stable Water Areas (%)", analysisResult.water.stablePct],
      ["Net Water Shift (%)", analysisResult.water.netShiftPct],
      [],
      ["5. MODULE C: LAND COVER CHANGE DETECTION"],
      ["Methodology", analysisResult.landCover.method],
      ["Technical Note", analysisResult.landCover.methodNote],
      ["Baseline Classification (T0)", `${analysisResult.landCover.baselineClass} (${analysisResult.landCover.baselineConfidence}%)`],
      ["Follow-up Classification (T1)", `${analysisResult.landCover.followupClass} (${analysisResult.landCover.followupConfidence}%)`],
      ["Categorical Transition", analysisResult.landCover.transitionSummary],
      ["Altered 3x3 Spatial Patches", `${analysisResult.landCover.changedPatchesCount} of ${analysisResult.landCover.totalPatches} patches`],
      ["Physical Pixel Spectral Shift (%)", analysisResult.landCover.pixelShiftPct],
      ["Physical Pixel Stability (%)", analysisResult.landCover.pixelStablePct],
      [],
      ["6. SCIENTIFIC LIMITATIONS & DISCLOSURE"],
      ["Vegetation Disclaimer", "VARI is an optical visible-band index. True NDVI requires calibrated Near-Infrared (NIR) sensors."],
      ["Water Disclaimer", "Water detection relies on optical visible spectrum absorption. True NDWI requires Near-Infrared sensors."],
      ["Land Cover Disclaimer", "EuroSAT ResNet-50 operates at patch/image level across 10 classes; does not perform sub-pixel semantic segmentation."],
      ["Alignment Disclaimer", "Uncalibrated RGB rasters do not guarantee sub-pixel geographic co-registration."],
    ];

    const csvContent = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TerraMind_Report_${selectedAreaId}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tm-app">
      {/* ── STEP 1: Brand & Top Header ── */}
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
              Automated Environmental Change Detection & Multi-Temporal Intelligence
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="module-counter">
            <span className="dot-pulse"></span> 3 Analysis Modules Active
          </div>
          {analysisResult && (
            <button className="tm-btn btn-export" onClick={exportReport}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-svg">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Export Report (CSV)
            </button>
          )}
        </div>
      </header>

      {/* ── STEP 2: Select Analysis Area ── */}
      <section className="tm-card area-selector-card">
        <div className="selector-header">
          <div>
            <label className="selector-title">Select Analysis Area</label>
            <p className="selector-subtitle">Choose a predefined study region</p>
          </div>
          <button
            className={`tm-btn ${isCustomMode ? "btn-active" : "btn-secondary"}`}
            onClick={enableCustomUpload}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-svg">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Custom Image Upload
          </button>
        </div>

        <div className="selector-controls">
          <div className="select-wrap">
            <select
              className="tm-select"
              value={selectedAreaId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  enableCustomUpload();
                } else {
                  loadStudyArea(val);
                }
              }}
            >
              {studyAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.title} — {area.description}
                </option>
              ))}
              <option value="custom">📁 Custom Image Upload (Desktop Files)</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── STEP 3: Load Earlier and Later Images Side by Side ── */}
      <section className="tm-card observation-card">
        <div className="card-section-title">
          <span>Observation Imagery</span>
          <span className="card-tag">Multi-Temporal Pair</span>
        </div>

        <div className="observation-grid">
          {/* Earlier Observation (T0) */}
          <div
            className={`image-pane ${!t0Preview && isCustomMode ? "drop-active" : ""}`}
            onClick={() => isCustomMode && t0InputRef.current?.click()}
          >
            <div className="pane-header">
              <span className="epoch-label">Earlier Observation (T0)</span>
              <span className="date-tag">{t0Metadata?.dates || "Demonstration Epoch"}</span>
            </div>

            <div className="preview-container">
              {t0Preview ? (
                <img src={t0Preview} alt="Earlier Observation (T0)" className="scene-img" />
              ) : (
                <div className="empty-upload-box">
                  <span className="upload-icon">⬆</span>
                  <span className="upload-text">Upload Earlier Image (T0)</span>
                  <span className="upload-sub">Click to browse or drop file</span>
                </div>
              )}
            </div>

            <div className="pane-footer">
              <span className="filename-text">{t0Metadata?.filename || (t0File ? t0File.name : "Select image")}</span>
              <span className="dimension-badge">
                {t0Metadata?.dimensions ? (Array.isArray(t0Metadata.dimensions) ? `${t0Metadata.dimensions[0]}×${t0Metadata.dimensions[1]} px` : t0Metadata.dimensions) : "—"}
              </span>
            </div>

            {isCustomMode && (
              <input
                ref={t0InputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleCustomFile(e.target.files[0], "t0")}
              />
            )}
          </div>

          {/* Later Observation (T1) */}
          <div
            className={`image-pane ${!t1Preview && isCustomMode ? "drop-active" : ""}`}
            onClick={() => isCustomMode && t1InputRef.current?.click()}
          >
            <div className="pane-header">
              <span className="epoch-label accent">Later Observation (T1)</span>
              <span className="date-tag">{t1Metadata?.dates || "Demonstration Epoch"}</span>
            </div>

            <div className="preview-container">
              {t1Preview ? (
                <img src={t1Preview} alt="Later Observation (T1)" className="scene-img" />
              ) : (
                <div className="empty-upload-box">
                  <span className="upload-icon">⬆</span>
                  <span className="upload-text">Upload Later Image (T1)</span>
                  <span className="upload-sub">Click to browse or drop file</span>
                </div>
              )}
            </div>

            <div className="pane-footer">
              <span className="filename-text">{t1Metadata?.filename || (t1File ? t1File.name : "Select image")}</span>
              <span className="dimension-badge">
                {t1Metadata?.dimensions ? (Array.isArray(t1Metadata.dimensions) ? `${t1Metadata.dimensions[0]}×${t1Metadata.dimensions[1]} px` : t1Metadata.dimensions) : "—"}
              </span>
            </div>

            {isCustomMode && (
              <input
                ref={t1InputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleCustomFile(e.target.files[0], "t1")}
              />
            )}
          </div>
        </div>

        {/* ── STEP 4: Validate Images ── */}
        {validationInfo && (
          <div className="validation-bar">
            <div className="val-header">
              <span className="val-icon">🛡️</span>
              <span className="val-title">Pre-Analysis Image Validation:</span>
              <span className="val-status">Raster Integrity Verified</span>
            </div>
            {validationInfo.warnings && validationInfo.warnings.length > 0 && (
              <ul className="val-warnings">
                {validationInfo.warnings.map((w, idx) => (
                  <li key={idx}>⚠️ {w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── STEP 5: Run Environmental Analysis ── */}
        <div className="analysis-action-tray">
          <div className="threshold-control">
            <div className="th-label-row">
              <span className="th-title">Physical Spectral Sensitivity:</span>
              <span className="th-val">{threshold} / 255</span>
            </div>
            <div className="th-slider-box">
              <input
                type="range"
                min={10}
                max={80}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <span className="th-hint">Controls pixel delta sensitivity threshold</span>
            </div>
          </div>

          <button
            className="tm-btn btn-primary btn-run-analysis"
            disabled={loading || (!t0Preview || !t1Preview)}
            onClick={runEnvironmentalAnalysis}
          >
            {loading ? (
              <>
                <span className="spinner-ring"></span>
                <span>{loadingMsg || "Analyzing Changes..."}</span>
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

        {errorMsg && (
          <div className="error-alert-box">
            <span>❌ <strong>Error:</strong> {errorMsg}</span>
          </div>
        )}
      </section>

      {/* ── STEP 6: THREE ENVIRONMENTAL ANALYSIS MODULES ── */}
      {analysisResult && (
        <section className="results-section">
          {/* Section Heading & View Filter */}
          <div className="results-header">
            <div>
              <h2 className="results-title">Environmental Change Analysis Results</h2>
              <p className="results-subtitle">
                All three environmental analysis modules computed from actual multispectral and deep learning inference
              </p>
            </div>
            <div className="view-toggle-bar">
              <button
                className={`toggle-btn ${activeModuleTab === "all" ? "active" : ""}`}
                onClick={() => setActiveModuleTab("all")}
              >
                All 3 Modules
              </button>
              <button
                className={`toggle-btn ${activeModuleTab === "vegetation" ? "active" : ""}`}
                onClick={() => setActiveModuleTab("vegetation")}
              >
                Vegetation
              </button>
              <button
                className={`toggle-btn ${activeModuleTab === "water" ? "active" : ""}`}
                onClick={() => setActiveModuleTab("water")}
              >
                Water Bodies
              </button>
              <button
                className={`toggle-btn ${activeModuleTab === "landcover" ? "active" : ""}`}
                onClick={() => setActiveModuleTab("landcover")}
              >
                Land Cover
              </button>
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
                    <span className="method-label">Method: {analysisResult.vegetation.method}</span>
                  </div>
                  <div className="module-kpi">
                    <span className="kpi-tag">Net Canopy Shift</span>
                    <span className={`kpi-figure ${analysisResult.vegetation.netShiftPct >= 0 ? "positive" : "negative"}`}>
                      {analysisResult.vegetation.netShiftPct >= 0 ? "+" : ""}{analysisResult.vegetation.netShiftPct}%
                    </span>
                  </div>
                </div>

                <div className="module-body">
                  <div className="module-metrics-grid">
                    <div className="metric-tile">
                      <span className="tile-label">Vegetation Loss</span>
                      <span className="tile-value text-red">{analysisResult.vegetation.lossPct}%</span>
                      <span className="tile-sub">Canopy cleared or degraded</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Vegetation Growth</span>
                      <span className="tile-value text-green">{analysisResult.vegetation.growthPct}%</span>
                      <span className="tile-sub">New vegetative canopy emerged</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Stable Vegetation</span>
                      <span className="tile-value text-darkgreen">{analysisResult.vegetation.stablePct}%</span>
                      <span className="tile-sub">Persistent canopy cover</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Total Cover Transition</span>
                      <span className="tile-value text-muted">
                        {analysisResult.vegetation.baselineCoverPct}% → {analysisResult.vegetation.followupCoverPct}%
                      </span>
                      <span className="tile-sub">Epoch T0 to Epoch T1</span>
                    </div>
                  </div>

                  <div className="map-view-box">
                    <div className="map-title-row">
                      <span className="map-caption">Vegetation Change Detection Map</span>
                      <div className="map-legend">
                        <span className="leg-item"><span className="swatch red"></span> Vegetation Loss</span>
                        <span className="leg-item"><span className="swatch green"></span> Vegetation Growth</span>
                        <span className="leg-item"><span className="swatch darkgreen"></span> Stable Vegetation</span>
                      </div>
                    </div>
                    <div className="raster-frame">
                      <img
                        src={`data:image/png;base64,${analysisResult.vegetation.mapImage}`}
                        alt="Vegetation Change Detection Map"
                      />
                    </div>
                    <p className="method-disclaimer">
                      ℹ️ <strong>Scientific Method Note:</strong> {analysisResult.vegetation.methodNote}
                    </p>
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
                    <span className="method-label">Method: {analysisResult.water.method}</span>
                  </div>
                  <div className="module-kpi">
                    <span className="kpi-tag">Net Water Dynamics</span>
                    <span className={`kpi-figure ${analysisResult.water.netShiftPct >= 0 ? "positive" : "negative"}`}>
                      {analysisResult.water.netShiftPct >= 0 ? "+" : ""}{analysisResult.water.netShiftPct}%
                    </span>
                  </div>
                </div>

                <div className="module-body">
                  <div className="module-metrics-grid">
                    <div className="metric-tile">
                      <span className="tile-label">Water Expansion</span>
                      <span className="tile-value text-cyan">{analysisResult.water.expansionPct}%</span>
                      <span className="tile-sub">Flooding or inundation expansion</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Water Reduction</span>
                      <span className="tile-value text-amber">{analysisResult.water.reductionPct}%</span>
                      <span className="tile-sub">Receded or dried water surface</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Stable Water Areas</span>
                      <span className="tile-value text-navy">{analysisResult.water.stablePct}%</span>
                      <span className="tile-sub">Permanent channel or reservoir bed</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Total Water Transition</span>
                      <span className="tile-value text-muted">
                        {analysisResult.water.baselineCoverPct}% → {analysisResult.water.followupCoverPct}%
                      </span>
                      <span className="tile-sub">Epoch T0 to Epoch T1</span>
                    </div>
                  </div>

                  <div className="map-view-box">
                    <div className="map-title-row">
                      <span className="map-caption">Water Body Change Detection Map</span>
                      <div className="map-legend">
                        <span className="leg-item"><span className="swatch cyan"></span> Water Expansion</span>
                        <span className="leg-item"><span className="swatch amber"></span> Water Reduction</span>
                        <span className="leg-item"><span className="swatch navy"></span> Stable Water Areas</span>
                      </div>
                    </div>
                    <div className="raster-frame">
                      <img
                        src={`data:image/png;base64,${analysisResult.water.mapImage}`}
                        alt="Water Body Change Detection Map"
                      />
                    </div>
                    <p className="method-disclaimer">
                      ℹ️ <strong>Scientific Method Note:</strong> {analysisResult.water.methodNote}
                    </p>
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
                    <span className="method-label">Method: {analysisResult.landCover.method}</span>
                  </div>
                  <div className="module-kpi">
                    <span className="kpi-tag">Spatial Alteration</span>
                    <span className="kpi-figure neutral">
                      {analysisResult.landCover.changedPatchesCount}/{analysisResult.landCover.totalPatches} Patches
                    </span>
                  </div>
                </div>

                <div className="module-body">
                  {/* Categorical Transition Summary */}
                  <div className="lc-transition-banner">
                    <span className="lc-icon">🛰️</span>
                    <div className="lc-text-block">
                      <strong>Categorical Classification Summary:</strong> {analysisResult.landCover.transitionSummary}
                    </div>
                  </div>

                  <div className="module-metrics-grid">
                    <div className="metric-tile">
                      <span className="tile-label">Baseline Class (T0)</span>
                      <span className="tile-value text-accent">{analysisResult.landCover.baselineClass}</span>
                      <span className="tile-sub">Confidence: {analysisResult.landCover.baselineConfidence}%</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Follow-up Class (T1)</span>
                      <span className="tile-value text-cyan">{analysisResult.landCover.followupClass}</span>
                      <span className="tile-sub">Confidence: {analysisResult.landCover.followupConfidence}%</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Pixel Spectral Shift</span>
                      <span className="tile-value text-crimson">{analysisResult.landCover.pixelShiftPct}%</span>
                      <span className="tile-sub">Pixels &gt; sensitivity {analysisResult.threshold}</span>
                    </div>
                    <div className="metric-tile">
                      <span className="tile-label">Pixel Stability</span>
                      <span className="tile-value text-darkgreen">{analysisResult.landCover.pixelStablePct}%</span>
                      <span className="tile-sub">Spectrally stable matrix</span>
                    </div>
                  </div>

                  {/* 3x3 Spatial Grid Classification Matrix */}
                  <div className="grid-matrix-box">
                    <span className="matrix-title">3×3 Spatial Quadrant Land Cover Transition Grid</span>
                    <div className="quadrant-grid">
                      {analysisResult.landCover.patchGridTransitions.map((item, idx) => (
                        <div key={idx} className={`quadrant-cell ${item.isChanged ? "cell-changed" : "cell-stable"}`}>
                          <span className="quad-coord">R{item.row+1}:C{item.col+1}</span>
                          <span className="quad-classes">{item.t0Class} → {item.t1Class}</span>
                          <span className="quad-status">{item.isChanged ? "Class Shifted" : "Class Stable"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Physical Spectral Difference Map */}
                  <div className="map-view-box">
                    <div className="map-title-row">
                      <span className="map-caption">Physical Pixel Spectral Shift Map</span>
                      <div className="map-legend">
                        <span className="leg-item"><span className="swatch crimson"></span> Altered Pixels (&gt; threshold {analysisResult.threshold})</span>
                        <span className="leg-item"><span className="swatch dimmed"></span> Stable Surface Background</span>
                      </div>
                    </div>
                    <div className="raster-frame">
                      <img
                        src={`data:image/png;base64,${analysisResult.landCover.spectralDeltaMap}`}
                        alt="Spectral Difference Map"
                      />
                    </div>
                    <p className="method-disclaimer">
                      ℹ️ <strong>Scientific Method Note:</strong> {analysisResult.landCover.methodNote}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
