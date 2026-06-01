import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, ShieldCheck, Layers, Eye,
  Flame, Scan
} from 'lucide-react';
import mriAsset from '../assets/mri_scan.png';
import xrayAsset from '../assets/xray_scan.png';

interface AIPredictionsProps {
  selectedScan: string | null;
  scanType: 'mri' | 'ct' | 'xray' | null;
  confidence: number;
  probability: number;
  patientName?: string;
  patientAge?: string;
  dob?: string;
  predictionResult?: any;
}

// ── Viewer tab type ────────────────────────────────
type ViewerTab = 'original' | 'heatmap' | 'segmentation';

export default function AIPredictions({
  selectedScan,
  scanType,
  confidence,
  probability,
  patientName,
  patientAge,
  dob,
  predictionResult
}: AIPredictionsProps) {
  const [viewerTab, setViewerTab] = useState<ViewerTab>('original');

  const activeType = scanType || 'mri';
  const activeScan = selectedScan || (activeType === 'xray' ? xrayAsset : mriAsset);

  // ── Derive safe state ────────────────────────────
  const isSafe = !!predictionResult && (
    predictionResult.risk_level === 'Safe' ||
    predictionResult.risk_level === 'Stable' ||
    predictionResult.risk_level === 'Low' ||
    predictionResult.prediction === 'Normal' ||
    predictionResult.prediction === 'Safe'
  );

  const activeConfidence = predictionResult ? predictionResult.confidence : (selectedScan ? confidence : (activeType === 'mri' ? 94 : 89));
  const activeProbability = predictionResult ? predictionResult.confidence : (selectedScan ? probability : (activeType === 'mri' ? 88 : 72));

  // ── Has real data from backend? ──────────────────
  const hasHeatmap = !!predictionResult?.heatmap_base64;
  const hasSegmentation = !!predictionResult?.segmentation_base64;

  // ── Available tabs — heatmap/segmentation only for critical scans ──
  const availableTabs = useMemo<{ id: ViewerTab; label: string; icon: React.ReactNode }[]>(() => {
    const tabs: { id: ViewerTab; label: string; icon: React.ReactNode }[] = [
      { id: 'original', label: 'Original Scan', icon: <Eye className="h-3 w-3" /> },
    ];
    if (hasHeatmap && !isSafe) {
      tabs.push({ id: 'heatmap', label: 'Heatmap', icon: <Flame className="h-3 w-3" /> });
    }
    if (hasSegmentation && !isSafe) {
      tabs.push({ id: 'segmentation', label: 'Segmentation', icon: <Layers className="h-3 w-3" /> });
    }
    return tabs;
  }, [hasHeatmap, hasSegmentation, isSafe]);

  // If current tab is no longer available, reset to original
  const activeTab = availableTabs.find(t => t.id === viewerTab) ? viewerTab : 'original';

  // ── Scan type display name ───────────────────────
  const getScanTypeName = () => {
    if (predictionResult?.category) return predictionResult.category + ' Scan';
    if (activeType === 'mri') return 'Brain Tumor MRI Scan';
    if (activeType === 'xray') return 'Pneumonia X-Ray Scan';
    return 'Scan';
  };

  // ── Build diagnosis fields from backend metadata ──
  const getDiagnosis = () => {
    if (predictionResult) {
      const pred = predictionResult.prediction;
      const conf = predictionResult.confidence;
      const risk = predictionResult.risk_level || 'Unknown';

      // Use dynamic metadata from backend when available
      const activationRegion = predictionResult.activation_region
        || (isSafe ? 'No dominant activation region identified.' : 'Region analysis pending.');
      const segmentationStatus = predictionResult.segmentation_status
        || (isSafe ? 'No abnormal segmentation boundaries detected.' : 'Segmentation data processing.');
      const recommendation = predictionResult.recommendation
        || (isSafe ? 'Routine screening and clinical follow-up as per protocol.' : 'Further clinical review advised.');
      const description = predictionResult.diagnostic_abstract
        || `Model returned ${pred} with ${conf}% confidence.`;

      return {
        predictionStatus: pred,
        confidenceStr: `${conf}%`,
        activationRegion,
        segmentationStatus: hasSegmentation ? segmentationStatus : undefined,
        recommendation,
        risk,
        description,
      };
    }

    // Fallback defaults (no backend result yet — preset view)
    return {
      predictionStatus: 'Awaiting Analysis',
      confidenceStr: '—',
      activationRegion: 'Run Diagnostics First',
      segmentationStatus: undefined,
      recommendation: '—',
      risk: '—',
      description: 'Select a scan and run AI Diagnostics from the Upload Scan page to initialize the model.'
    };
  };

  const diag = getDiagnosis();

  // ── Radial Gauge ─────────────────────────────────
  const radius = 58;
  const stroke = 5;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (activeProbability / 100) * circumference;

  // ── Determine which image to show in the viewport ─
  const getViewportImage = (): string | null => {
    if (activeTab === 'heatmap' && hasHeatmap) return predictionResult.heatmap_base64;
    if (activeTab === 'segmentation' && hasSegmentation) return predictionResult.segmentation_base64;
    return null; // show activeScan
  };

  const viewportOverlay = getViewportImage();

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10 py-8 relative min-h-screen">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-white/8 pb-5 mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Scan className="h-4 w-4 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            AI Diagnostic Predictions
          </h1>
        </div>
        <p className="text-sm text-gray-500 ml-11">
          Explainable AI visualization with Grad-CAM attention mapping and segmentation analysis.
        </p>

        {/* Patient Badge */}
        {patientName && (
          <div className="mt-3 ml-11 text-[10px] font-mono text-gray-500 flex flex-wrap gap-x-5 gap-y-1 select-none border border-white/6 bg-white/[0.015] rounded-lg px-3 py-1.5 w-fit">
            <span>PATIENT: <strong className="text-white uppercase">{patientName}</strong></span>
            {patientAge && <span>AGE: <strong className="text-white font-mono">{patientAge} Yrs</strong></span>}
            {dob && <span>DOB: <strong className="text-white font-mono">{dob}</strong></span>}
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* ── LEFT COLUMN: Probability + Findings ── */}
        <div className="lg:col-span-4 space-y-4">
          {/* Probability Gauge Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-white/[0.02] border border-white/8 p-5 text-center relative overflow-hidden"
          >
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-4">
              {isSafe ? 'Healthy Scan Confidence' : 'Disease Probability'}
            </h2>

            {/* Circular Gauge */}
            <div className="relative flex justify-center items-center my-3">
              <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
                <circle
                  stroke="rgba(255, 255, 255, 0.03)"
                  fill="transparent"
                  strokeWidth={stroke}
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
                <motion.circle
                  stroke={isSafe ? '#34d399' : '#00b4d8'}
                  fill="transparent"
                  strokeWidth={stroke}
                  strokeDasharray={circumference + ' ' + circumference}
                  style={{ strokeDashoffset }}
                  strokeLinecap="round"
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
              </svg>

              <div className="absolute text-center">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-2xl font-bold text-white"
                >
                  {activeProbability}%
                </motion.span>
                <p className="text-[8px] text-gray-500 font-mono tracking-widest uppercase font-semibold mt-0.5">
                  Confidence
                </p>
              </div>
            </div>

            {/* Sub-Metrics */}
            <div className="grid grid-cols-2 gap-3 mt-4 border-t border-white/6 pt-4">
              <div className="text-left">
                <span className="text-[8px] font-mono text-gray-500 block uppercase">Model Confidence</span>
                <span className="text-sm font-semibold text-cyan-400">{activeConfidence}%</span>
              </div>
              <div className="text-left">
                <span className="text-[8px] font-mono text-gray-500 block uppercase">Risk Level</span>
                <span className={`text-sm font-semibold flex items-center gap-1 ${
                  isSafe ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {isSafe ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                  {diag.risk}
                </span>
              </div>
            </div>
          </motion.div>

          {/* AI Clinical Findings Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-white/[0.02] border border-white/8 p-5 space-y-3"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <div className="h-3.5 w-3.5 rounded-sm bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              </div>
              AI Clinical Findings
            </h3>

            <div className="space-y-2.5 text-xs">
              {/* Prediction */}
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-gray-400">Prediction</span>
                <span className={`font-semibold ${isSafe ? 'text-emerald-400' : 'text-red-400'}`}>
                  {diag.predictionStatus}
                </span>
              </div>

              {/* Confidence */}
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-gray-400">Confidence</span>
                <span className="font-semibold text-white">{diag.confidenceStr}</span>
              </div>

              {/* Activation Region */}
              <div className="flex justify-between items-start border-b border-white/5 pb-2 gap-2">
                <span className="text-gray-400 shrink-0">Activation Region</span>
                <span className="font-semibold text-white text-right leading-tight max-w-[180px]">
                  {diag.activationRegion}
                </span>
              </div>

              {/* Segmentation — only if available */}
              {diag.segmentationStatus && (
                <div className="flex justify-between items-start border-b border-white/5 pb-2 gap-2">
                  <span className="text-gray-400 shrink-0">Segmentation</span>
                  <span className="font-semibold text-cyan-400 text-right leading-tight max-w-[180px]">
                    {diag.segmentationStatus}
                  </span>
                </div>
              )}

              {/* Recommendation */}
              <div className="flex justify-between items-start border-b border-white/5 pb-2 gap-2">
                <span className="text-gray-400 shrink-0">Recommendation</span>
                <span className="font-semibold text-amber-400 text-right leading-tight max-w-[180px]">
                  {diag.recommendation}
                </span>
              </div>

              {/* Diagnostic Abstract */}
              <div className="pt-1">
                <span className="text-gray-500 text-[9px] uppercase font-mono block mb-1.5">Diagnostic Abstract</span>
                <p className="text-[11px] text-gray-400 leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/5">
                  {diag.description}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── RIGHT COLUMN: Image Viewport ── */}
        <div className="lg:col-span-8">
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl bg-white/[0.02] border border-white/8 p-5 flex flex-col"
          >
            {/* Header Row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-white">
                  {getScanTypeName()}
                </h3>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                  PREDICTION: <span className={predictionResult ? (isSafe ? 'text-emerald-400' : 'text-cyan-400') : 'text-gray-600'}>
                    {predictionResult ? predictionResult.prediction.toUpperCase() : 'AWAITING ANALYSIS'}
                  </span>
                </p>
              </div>

              {/* Tab Toggle — only shown for critical scans */}
              {!isSafe && availableTabs.length > 1 ? (
                <div className="flex rounded-xl border border-white/10 p-0.5 bg-black/50">
                  {availableTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setViewerTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                        activeTab === tab.id
                          ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                          : 'text-gray-500 hover:text-gray-300 border border-transparent'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              ) : isSafe ? (
                <div className="border border-emerald-500/15 bg-emerald-500/[0.04] rounded-xl px-3 py-1.5">
                  <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider font-bold">
                    No Abnormal Region Identified
                  </span>
                </div>
              ) : null}
            </div>

            {/* ── Image Viewport ── */}
            <div className="flex-1 bg-black rounded-xl relative overflow-hidden flex items-center justify-center min-h-[500px] h-full w-full">
              <AnimatePresence mode="wait">
                {viewportOverlay ? (
                  /* Heatmap or Segmentation overlay — the backend already composites the
                     overlay into the JPEG, so render at full opacity with no blend mode */
                  <motion.img
                    key={activeTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    src={viewportOverlay}
                    alt={activeTab === 'heatmap' ? 'Grad-CAM Heatmap' : 'Segmentation Overlay'}
                    className="h-full w-full object-contain absolute inset-0 z-10"
                  />
                ) : null}
              </AnimatePresence>

              {/* Original scan ALWAYS underneath if heatmap/segmentation is transparent, or just show it */}
              <motion.img
                key="original-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.95 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                src={activeScan}
                alt="Original Scan"
                className="h-full w-full object-contain absolute inset-0 z-0"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const fallback = activeType === 'xray' ? xrayAsset : mriAsset;
                  if (target.src !== fallback) target.src = fallback;
                }}
              />

              {/* Tab label badge (bottom-right) */}
              <div className="absolute bottom-3 right-3 z-20">
                <span className="text-[9px] font-mono uppercase tracking-widest px-2.5 py-1.5 rounded bg-black/80 border border-white/10 text-gray-300 backdrop-blur-sm">
                  {activeTab === 'heatmap' ? 'Grad-CAM Overlay' : activeTab === 'segmentation' ? 'Contour Mask' : 'Original'}
                </span>
              </div>

              {/* Safe scan label */}
              {isSafe && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 border border-emerald-500/30 bg-emerald-500/[0.1] rounded-lg px-5 py-2 pointer-events-none z-20 backdrop-blur-md">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold">
                    No abnormal region identified
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Status Metrics */}
            <div className="mt-4 grid grid-cols-3 gap-3 bg-white/[0.015] border border-white/6 rounded-xl p-3 text-center">
              <div>
                <span className="text-[8px] font-mono text-gray-500 block uppercase">Detected Region</span>
                <span className="text-[11px] font-semibold text-white">
                  {isSafe ? 'None' : diag.activationRegion}
                </span>
              </div>
              <div>
                <span className="text-[8px] font-mono text-gray-500 block uppercase">Heatmap Confidence</span>
                <span className={`text-[11px] font-semibold ${isSafe ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {diag.confidenceStr}
                </span>
              </div>
              <div>
                <span className="text-[8px] font-mono text-gray-500 block uppercase">Clinical Priority</span>
                <span className={`text-[11px] font-semibold font-mono ${isSafe ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isSafe ? 'Routine' : diag.risk.toUpperCase()}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
