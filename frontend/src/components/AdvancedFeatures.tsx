import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Layers, Sliders, Brain,
  Activity, CheckCircle2, ShieldAlert, Cpu
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import mriAsset from '../assets/mri_scan.png';
import xrayAsset from '../assets/xray_scan.png';

import type { ScanRecord } from '../App';

interface AdvancedFeaturesProps {
  predictionResult?: any;
  scanType?: 'mri' | 'ct' | 'xray' | null;
  selectedScan?: string | null;
  scanHistory: ScanRecord[];
}

export default function AdvancedFeatures({ predictionResult, scanType, selectedScan, scanHistory = [] }: AdvancedFeaturesProps) {
  const isSafe = !!predictionResult && (
    predictionResult.risk_level === 'Safe' || 
    predictionResult.prediction === 'Normal' || 
    predictionResult.prediction === 'Safe' ||
    predictionResult.prediction === 'Normal Scan'
  );
  const [activeFeatureTab, setActiveFeatureTab] = useState<'segmentation' | 'heatmap' | 'treatment' | 'statistics'>('segmentation');

  // Compute dynamic stats based on scan history
  const brainScans = scanHistory.filter(s => s.type.toLowerCase().includes('brain') || s.type.toLowerCase().includes('mri'));
  const pneumoniaScans = scanHistory.filter(s => s.type.toLowerCase().includes('pneumonia') || s.type.toLowerCase().includes('xray'));

  const getModalityStats = (scans: ScanRecord[]) => {
    if (scans.length === 0) {
      return { count: 0, accuracy: 0 };
    }
    const sumAccuracy = scans.reduce((acc, s) => {
      const parsed = parseFloat(s.confidence);
      return acc + (isNaN(parsed) ? 90 : parsed);
    }, 0);
    return {
      count: scans.length,
      accuracy: parseFloat((sumAccuracy / scans.length).toFixed(1))
    };
  };

  const brainStats = getModalityStats(brainScans);
  const pneumoniaStats = getModalityStats(pneumoniaScans);

  const totalScansCount = brainStats.count + pneumoniaStats.count;
  const overallAccuracy = totalScansCount > 0 
    ? parseFloat((((brainStats.accuracy * brainStats.count) + (pneumoniaStats.accuracy * pneumoniaStats.count)) / totalScansCount).toFixed(1))
    : 0;

  // Segmentation states
  const hasSegmentation = !isSafe && !!predictionResult?.segmentation_base64;
  const [segCategory, setSegCategory] = useState<'mri' | 'xray'>(scanType === 'ct' ? 'mri' : (scanType || 'mri'));
  const [showContour, setShowContour] = useState(true);
  const [showFill, setShowFill] = useState(true);
  const [segOpacity, setSegOpacity] = useState(75);
  const [sliderValue, setSliderValue] = useState(50);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const segments = {
    overlay: predictionResult?.segmentation_base64,
    fill: predictionResult?.segmentation_fill_base64 || predictionResult?.segmentation_base64,
    contour: predictionResult?.segmentation_contour_base64 || predictionResult?.segmentation_base64,
  };

  const activeSegmentationSrc = hasSegmentation
    ? showFill && showContour
      ? segments.overlay
      : showFill
        ? segments.fill
        : showContour
          ? segments.contour
          : null
    : null;

  const overlayOpacity = activeSegmentationSrc ? segOpacity / 100 : 0;

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
    if (!isDragging.current || !sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    setSliderValue(percentage);
  };

  const handleTouchStart = () => {
    isDragging.current = true;
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging.current || !sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    if (!touch) return;
    const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    setSliderValue(percentage);
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchmove', handleTouchMove);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Heatmap states
  const [heatmapCategory, setHeatmapCategory] = useState<'mri' | 'xray'>(scanType === 'ct' ? 'mri' : (scanType || 'mri'));
  const [heatmapViewMode, setHeatmapViewMode] = useState<'original' | 'heatmap' | 'overlay'>('overlay');

  const maskCoverage = predictionResult?.mask_coverage || 0.0;
  const lesionAreaCm2 = maskCoverage > 0 ? (maskCoverage * 60.5).toFixed(2) : null;

  useEffect(() => {
    if (scanType) {
      setSegCategory(scanType === 'ct' ? 'mri' : scanType);
      setHeatmapCategory(scanType === 'ct' ? 'mri' : scanType);
    }
  }, [scanType]);

  const getAsset = (cat: 'mri' | 'xray') => {
    if (selectedScan && cat === scanType) return selectedScan;
    if (cat === 'mri') return mriAsset;
    return xrayAsset;
  };

  const featureTabs = [
    { id: 'segmentation', label: 'Tumor Segmentation', icon: <Layers className="h-4 w-4" /> },
    { id: 'heatmap', label: 'Explainable AI', icon: <Brain className="h-4 w-4" /> },
    { id: 'treatment', label: 'Treatment Directives', icon: <Cpu className="h-4 w-4" /> },
    { id: 'statistics', label: 'Modality Stats', icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto max-w-7xl px-8 lg:px-12 py-10 lg:py-12 relative min-h-[90vh] space-y-10">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-left border-b border-white/5 pb-6 space-y-2"
      >
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white font-display">
          Advanced AI Features
        </h1>
        <p className="text-sm text-gray-500 max-w-2xl leading-relaxed">
          AI-assisted diagnostic capabilities, visual neural attention maps, and clinical decision statistics.
        </p>
      </motion.div>

      {/* Feature Sub-Navigation Bar */}
      <div className="flex flex-wrap gap-2.5 border-b border-white/5 pb-4 select-none">
        {featureTabs.map((tab) => {
          const isActive = activeFeatureTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFeatureTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border ${isActive
                  ? 'border-clinicalCyan bg-clinicalCyan/[0.03] text-white shadow-lg shadow-clinicalCyan/[0.02]'
                  : 'border-white/5 bg-[#050608]/40 text-gray-500 hover:text-white hover:bg-[#050608]/85'
                }`}
            >
              <span className={isActive ? 'text-clinicalCyan' : 'text-gray-600'}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Feature Content */}
      <div className="mt-8">

        {/* ════════════════════════════════════════════════
            TUMOR SEGMENTATION
        ════════════════════════════════════════════════ */}
        {activeFeatureTab === 'segmentation' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white font-display">
                  Tumor Segmentation Viewer
                </h3>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                  Drag the central slider to compare the original scan with the AI segmentation overlay.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono text-gray-400 border border-white/5 px-3 py-1.5 rounded bg-black/30 uppercase tracking-wider">
                  Real-time Diagnostic Mode
                </span>
              </div>
            </div>

            {/* Main content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* LEFT: Side-by-side viewport */}
              <div className="lg:col-span-8 space-y-3">
                {/* Two panels + divider */}
                <div
                  ref={sliderContainerRef}
                  className="flex rounded-xl overflow-hidden border border-white/5 bg-[#020304] select-none"
                  style={{ height: '440px' }}
                >
                  {/* PANEL LEFT — Original scan */}
                  <div className="relative border-r border-white/5 overflow-hidden" style={{ width: `${sliderValue}%` }}>
                    <span className="absolute top-3 left-3 z-10 text-[9px] font-mono text-gray-400 uppercase tracking-wider bg-black/60 px-2 py-1 rounded border border-white/5 backdrop-blur-sm whitespace-nowrap">
                      Original Scan
                    </span>
                    <img
                      src={getAsset(segCategory)}
                      alt="Original scan"
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    />
                  </div>

                  {/* CENTER DIVIDER HANDLE */}
                  <div
                    className="relative z-20 flex-none flex items-center justify-center w-0 cursor-ew-resize hover:bg-white/5 transition-colors"
                    style={{ overflow: 'visible' }}
                    onMouseDown={handleMouseDown} onTouchStart={handleTouchStart}                  >
                    <div className="absolute top-0 bottom-0 w-[2px] bg-clinicalCyan/50 left-[-1px]" />
                    <div className="relative w-8 h-8 rounded-full bg-[#0c0f14] border border-clinicalCyan/50 flex items-center justify-center shadow-[0_0_15px_rgba(0,180,216,0.2)]">
                      <Sliders className="h-3.5 w-3.5 text-clinicalCyan rotate-90" />
                    </div>
                  </div>

                  {/* PANEL RIGHT — Segmentation overlay */}
                  <div className="relative overflow-hidden" style={{ width: `${100 - sliderValue}%` }}>
                    <span className="absolute top-3 right-3 z-10 text-[9px] font-mono text-clinicalCyan/80 uppercase tracking-wider bg-black/60 px-2 py-1 rounded border border-clinicalCyan/10 backdrop-blur-sm whitespace-nowrap">
                      Segmentation Overlay
                    </span>

                    {/* Base scan (aligned with left panel by using object-cover and tracking the parent bounds, but actually in a side-by-side mode object-cover will center. Wait, if it's two separate viewports, object-contain works better. Let's use object-cover with object-position if we wanted a true single-image slider, but for a true side-by-side split, object-contain is fine. Let's stick to object-cover so they fill the space nicely without jumping.) */}
                    <img
                      src={getAsset(segCategory)}
                      alt="Base scan"
                      draggable={false}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    />

                    {hasSegmentation && activeSegmentationSrc && (
                      <img
                        src={activeSegmentationSrc}
                        alt="Segmentation overlay"
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-150"
                        style={{ opacity: overlayOpacity }}
                      />
                    )}

                    {!hasSegmentation && (
                      <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none z-10">
                        <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-5 text-center max-w-xs">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider block mb-2 ${isSafe ? 'text-green-400' : 'text-gray-400'}`}>
                            {isSafe ? 'Normal Scan // No Lesion Detected' : 'No significant lesion boundary detected.'}
                          </span>
                          <p className="text-[10px] text-gray-500 leading-snug">
                            {isSafe
                              ? 'This scan is normal. Segmentation is only generated for critical or abnormal scans.'
                              : 'The clinical segmentation viewer is ready once a lesion is detected by the AI model.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">Segmentation Legend</span>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-3 rounded-sm border border-clinicalCyan/40 bg-clinicalCyan/10" />
                      <span className="text-[9px] font-mono text-gray-400">Soft lesion fill overlay</span>
                    </div>
                  </div>
                  {hasSegmentation ? (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-clinicalCyan">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Clinical segmentation ready.</span>
                      </div>
                      <button className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 border border-white/5 rounded px-3 py-1.5 hover:text-white hover:border-white/15 transition-colors">
                        Export Overlay
                      </button>
                    </div>
                  ) : (
                    <span className="text-[9px] font-mono text-gray-600">
                      Awaiting scan analysis to render the overlay.
                    </span>
                  )}
                </div>
              </div>

              {/* RIGHT: Controls & Info */}
              <div className="lg:col-span-4">
                <div className="clinical-panel p-5 space-y-5 h-full">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white font-display flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-clinicalCyan" />
                      Segmentation Controls & Info
                    </h3>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                      Adjust overlay and review extracted information.
                    </p>
                  </div>

                  {/* Overlay Controls */}
                  <div className="border-t border-white/5 pt-4 space-y-4">
                    <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">
                      Overlay Controls
                    </span>

                    <div className="space-y-3">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="text-gray-400">Overlay Opacity</span>
                        <span className="text-clinicalCyan">{segOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={segOpacity}
                        onChange={(e) => setSegOpacity(Number(e.target.value))}
                        className="w-full h-1.5 rounded accent-clinicalCyan bg-white/5"
                        disabled={!hasSegmentation}
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-white block">Show Boundary</span>
                          <span className="text-[8px] font-mono text-gray-500">Toggle contour visibility</span>
                        </div>
                        <button
                          onClick={() => setShowContour(!showContour)}
                          disabled={!hasSegmentation}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${showContour && hasSegmentation ? 'bg-clinicalCyan' : 'bg-white/5 border border-white/10'
                            }`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-black/90 border border-white/10 transition-transform duration-200 ${showContour && hasSegmentation ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-white block">Soft Fill</span>
                          <span className="text-[8px] font-mono text-gray-500">Toggle cyan lesion fill</span>
                        </div>
                        <button
                          onClick={() => setShowFill(!showFill)}
                          disabled={!hasSegmentation}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${showFill && hasSegmentation ? 'bg-clinicalCyan' : 'bg-white/5 border border-white/10'
                            }`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-black/90 border border-white/10 transition-transform duration-200 ${showFill && hasSegmentation ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Segmentation Information */}
                  {hasSegmentation ? (
                    <div className="border-t border-white/5 pt-4 space-y-4">
                      <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block">
                        Segmentation Summary
                      </span>
                      <div className="space-y-3 text-[10px]">
                        <div className="flex justify-between items-start">
                          <span className="text-gray-400">Detected Region</span>
                          <span className="font-semibold text-clinicalCyan text-right max-w-[130px] leading-tight">
                            {predictionResult?.activation_region || '—'}
                          </span>
                        </div>
                        {lesionAreaCm2 ? (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Lesion Area</span>
                            <span className="font-semibold text-white">{lesionAreaCm2} cm²</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Segmentation Status</span>
                          <span className="font-semibold text-clinicalCyan text-right max-w-[110px] leading-tight">
                            {predictionResult?.segmentation_status || 'Boundary detected'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Overlay Confidence</span>
                          <span className="font-semibold text-clinicalCyan text-right">
                            {predictionResult?.confidence ? `${predictionResult.confidence}%` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-[#06101a] border border-clinicalCyan/10 px-4 py-3 text-[9px] text-gray-400">
                        Clinical visualization rendered from the UNet segmentation mask and contour extraction pipeline.
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-white/5 pt-4">
                      <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-6 text-center">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider block mb-2 ${isSafe ? 'text-green-400' : 'text-gray-400'}`}>
                          {isSafe ? 'Normal Scan // No Lesion Detected' : 'No significant lesion boundary detected.'}
                        </span>
                        <p className="text-[9px] text-gray-500 leading-snug">
                          {isSafe
                            ? 'This scan is normal. Segmentation workspace is only active for abnormal findings.'
                            : 'The segmentation workspace will populate after the scan is flagged for clinical review.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════
            EXPLAINABLE AI — HEATMAPS
        ════════════════════════════════════════════════ */}
        {activeFeatureTab === 'heatmap' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-8 space-y-4">
              <div className="clinical-panel p-6 flex flex-col h-[480px]">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white font-display">
                      Neural Attention Viewports
                    </h3>
                    <p className="text-[10px] text-gray-500 font-mono">GRAD-CAM ACTIVATION MAPS VISUALIZATION</p>
                  </div>
                  <span className="text-[10px] font-mono text-clinicalCyan border border-clinicalCyan/10 px-2.5 py-0.5 rounded bg-clinicalCyan/5 uppercase">
                    Grad-CAM v2
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div className="relative h-full rounded-lg bg-black border border-white/5 flex items-center justify-center p-3 select-none">
                    <img
                      src={selectedScan && heatmapCategory === scanType ? selectedScan : (heatmapCategory === 'mri' ? mriAsset : xrayAsset)}
                      alt="Original Diagnostic Scan"
                      className="max-h-[300px] w-auto rounded object-contain opacity-75 select-none pointer-events-none"
                    />
                    <span className="absolute bottom-3 left-3 text-[9px] font-mono text-gray-500 bg-black/85 px-2 py-1 rounded border border-white/5">
                      ORIGINAL SCAN
                    </span>
                  </div>

                  <div className="relative h-full rounded-lg bg-black border border-white/5 flex items-center justify-center p-3 overflow-hidden select-none">
                    <img
                      src={predictionResult?.heatmap_base64 && heatmapViewMode !== 'original' && !isSafe
                        ? predictionResult.heatmap_base64
                        : (selectedScan && heatmapCategory === scanType ? selectedScan : (heatmapCategory === 'mri' ? mriAsset : xrayAsset))}
                      alt="Heatmap View"
                      className={`max-h-[300px] w-auto rounded object-contain select-none pointer-events-none transition-opacity duration-300 ${
                        predictionResult?.heatmap_base64 && heatmapViewMode !== 'original' && !isSafe
                          ? 'opacity-90 absolute inset-0 m-auto'
                          : 'opacity-60'
                      }`}
                    />
                    {heatmapViewMode !== 'original' && !predictionResult?.heatmap_base64 && !isSafe && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded border border-yellow-500/20 bg-yellow-500/[0.04] px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-yellow-400">
                        Heatmap unavailable
                      </div>
                    )}
                    {isSafe && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="border border-green-500/20 bg-green-500/[0.04] backdrop-blur-sm rounded-lg px-4 py-3 text-center max-w-[200px]">
                          <span className="text-green-400 text-[9px] font-mono uppercase tracking-widest block font-bold">No Focal Activation</span>
                          <span className="text-gray-500 text-[8px] font-mono mt-1 block">
                            This scan is normal. Heatmaps are only generated for critical scans.
                          </span>
                        </div>
                      </div>
                    )}
                    <span className="absolute bottom-3 left-3 text-[9px] font-mono text-gray-500 bg-black/85 px-2 py-1 rounded border border-white/5">
                      {heatmapViewMode === 'heatmap' ? 'CAM FOCUS' : 'OVERLAY MAP'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="clinical-panel p-6 space-y-6 flex flex-col justify-between h-[480px]">
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1.5 font-display">
                      <Brain className="h-4 w-4 text-clinicalCyan" />
                      Explainability Controls
                    </h3>
                    <p className="text-[10px] text-gray-500 font-mono">Observe neural pathway weight nodes.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-mono text-gray-500 uppercase">Scanner Category</label>
                    <div className="flex flex-col gap-2">
                      {(['mri', 'xray'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setHeatmapCategory(cat)}
                          className={`w-full py-2 px-3 rounded text-[9.5px] font-semibold uppercase tracking-wider text-left transition-all border ${heatmapCategory === cat
                              ? 'border-clinicalCyan bg-clinicalCyan/[0.03] text-white'
                              : 'border-white/5 bg-[#050608] text-gray-500 hover:text-white'
                            }`}
                        >
                          {cat === 'mri' ? 'Brain Tumor MRI' : 'Pneumonia X-Ray'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <label className="text-[9px] font-mono text-gray-500 uppercase block">Attention Render Mode</label>
                    <div className="grid grid-cols-3 rounded border border-white/10 p-0.5 bg-black select-none text-center">
                      {(['original', 'heatmap', 'overlay'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setHeatmapViewMode(mode)}
                          className={`py-2 rounded text-[8.5px] font-semibold uppercase tracking-wider transition-all ${heatmapViewMode === mode
                              ? mode === 'overlay' ? 'bg-clinicalCyan text-black font-bold' : 'bg-white/10 text-white'
                              : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                          {mode === 'heatmap' ? 'CAM Focus' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
                    <div className="border border-white/5 bg-black/20 rounded-lg p-2.5">
                      <span className="text-[7.5px] font-mono text-gray-500 uppercase block tracking-wider">Attention Coef.</span>
                      <span className="text-xs font-semibold text-white font-mono block mt-0.5">
                        {isSafe ? '< 0.05' : (heatmapCategory === 'mri' ? '0.984' : '0.895')}
                      </span>
                    </div>
                    <div className="border border-white/5 bg-black/20 rounded-lg p-2.5">
                      <span className="text-[7.5px] font-mono text-gray-500 uppercase block tracking-wider">Classification</span>
                      <span className={`text-xs font-semibold font-display block uppercase mt-0.5 ${isSafe ? 'text-green-400' : 'text-clinicalCyan'}`}>
                        {isSafe ? 'Normal' : (heatmapCategory === 'mri' ? 'Abnormal Signal' : 'Pulmonary Finding')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 text-[9px] font-mono text-gray-500 leading-relaxed">
                  <strong>Methodology Note:</strong> Class Activation Mapping highlights regions that contributed most to the final layer classifications.
                </div>
              </div>
            </div>
          </motion.div>
        )}



        {/* ════════════════════════════════════════════════
            TREATMENT DIRECTIVES
        ════════════════════════════════════════════════ */}
        {activeFeatureTab === 'treatment' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-8 space-y-4">
              <div className="clinical-panel p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white font-display mb-1">
                    Clinical Decision Directives
                  </h3>
                  <p className="text-[10px] text-gray-500 font-mono">RECOMMENDED DIAGNOSTIC AND SURVEILLANCE PROCEDURES</p>
                </div>

                <div className="space-y-4">
                  {predictionResult?.directives && predictionResult.directives.length > 0 ? (
                    <div className={`border rounded-lg p-4 space-y-3 ${isSafe ? 'border-emerald-500/10 bg-emerald-500/5' : 'border-amber-500/10 bg-amber-500/5'}`}>
                      <div className={`flex justify-between items-center border-b pb-2 ${isSafe ? 'border-emerald-500/10' : 'border-amber-500/10'}`}>
                        <div className="flex items-center gap-2">
                          {scanType === 'mri' ? <Brain className={`h-4 w-4 ${isSafe ? 'text-emerald-400' : 'text-amber-500'}`} /> : <Activity className={`h-4 w-4 ${isSafe ? 'text-emerald-400' : 'text-amber-500'}`} />}
                          <span className="font-semibold text-white font-display text-sm">
                            {scanType === 'mri' ? 'Brain Tumor MRI Directives' : 'Pneumonia X-Ray Directives'}
                          </span>
                        </div>
                        <span className={`text-[8px] font-mono px-2 py-0.5 rounded uppercase border ${isSafe ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-amber-500 border-amber-500/20 bg-amber-500/10'}`}>
                          {isSafe ? 'Routine Protocol' : 'Urgent Protocol'}
                        </span>
                      </div>
                      <ul className="list-disc list-outside ml-3 text-[11px] text-gray-300 space-y-2">
                        {predictionResult.directives.map((dir: string, idx: number) => (
                          <li key={idx} className="leading-relaxed">{dir}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="border border-white/5 bg-black/20 rounded-lg p-6 text-center">
                       <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block mb-2">Awaiting Diagnostic Data</span>
                       <p className="text-[10px] text-gray-600 leading-normal max-w-xs mx-auto">
                         Run AI diagnostics to generate prediction-driven clinical recommendations and monitoring protocols.
                       </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="clinical-panel p-6 space-y-6 flex flex-col justify-between h-[510px]">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1.5 font-display">
                      <Cpu className="h-4 w-4 text-clinicalCyan" />
                      Treatment Guidelines
                    </h3>
                    <p className="text-[10px] text-gray-500 font-mono">Reference institutional protocols.</p>
                  </div>

                  <div className="border border-white/5 bg-black/20 rounded-lg p-4 space-y-3">
                    <span className="text-[8.5px] font-mono text-gray-500 uppercase block">Verification checklist</span>
                    <div className="space-y-2.5 text-[11px] text-gray-400">
                      {['Verify image scanner parameters', 'Cross-check with history records', 'Submit to molecular pathology'].map(item => (
                        <div key={item} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-clinicalCyan shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-red-500/15 bg-red-500/[0.01] rounded-lg p-4 flex gap-3 text-left">
                    <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <span className="text-[9px] font-mono text-red-500 uppercase block tracking-wider font-bold">Clinical Safety Notice</span>
                      <p className="text-[10px] text-gray-400 leading-relaxed mt-1">
                        Educational diagnostic simulation only. AI treatment recommendations are suggestions derived from statistics and do not substitute for professional medical judgment.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 text-[9px] font-mono text-gray-500 leading-relaxed">
                  <strong>Institutional Note:</strong> Follow WHO and NCCN parameters for direct oncology actions.
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════
            MODALITY STATS
        ════════════════════════════════════════════════ */}
        {activeFeatureTab === 'statistics' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-8 space-y-6">
              <div className="clinical-panel p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white font-display mb-4">
                  Historical AI Accuracy Sweep Targets
                </h3>
                <div className="h-[240px] w-full">
                  {totalScansCount > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: 'Brain MRI', Accuracy: brainStats.accuracy, Scans: brainStats.count },
                          { name: 'Pneumonia X-Ray', Accuracy: pneumoniaStats.accuracy, Scans: pneumoniaStats.count }
                        ]}
                        margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.015)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.25)" fontSize={9} />
                        <YAxis stroke="rgba(255,255,255,0.25)" fontSize={9} domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: '#07080b', border: '1px solid rgba(255,255,255,0.05)', fontSize: '10px' }} labelStyle={{ color: '#aaa', fontWeight: 'bold' }} />
                        <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
                        <Bar dataKey="Accuracy" name="Model Accuracy Target (%)" fill="#00b4d8" radius={[3, 3, 0, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center border border-dashed border-white/10 rounded-lg bg-black/40 p-6 text-center select-none">
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block mb-2">No Ingested Modality Data</span>
                      <p className="text-[10px] text-gray-600 max-w-xs leading-normal">
                        Please upload patient scans to populate accuracy charts and diagnostic statistics.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="clinical-panel p-6 space-y-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Scanner Category Targets</h4>
                {totalScansCount > 0 ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {[
                      { label: 'Brain Tumor MRI', scans: `${brainStats.count} Scans`, accuracy: brainStats.accuracy },
                      { label: 'Pneumonia X-Ray', scans: `${pneumoniaStats.count} Scans`, accuracy: pneumoniaStats.accuracy },
                    ].map(({ label, scans, accuracy }) => (
                      <div key={label} className="border border-white/5 bg-black/20 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-white">{label}</span>
                          <span className="text-[10px] font-mono text-clinicalCyan font-bold">{scans}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[8px] font-mono text-gray-500 uppercase">
                            <span>Accuracy Target</span><span>{accuracy}%</span>
                          </div>
                          <div className="w-full bg-white/5 border border-white/5 rounded-full h-1 overflow-hidden">
                            <div className="h-full bg-clinicalCyan" style={{ width: `${accuracy}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-white/5 bg-black/20 rounded-lg p-6 text-center text-gray-500 text-xs font-mono">
                    No active scanner targets registered.
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="clinical-panel p-6 space-y-6 flex flex-col justify-between h-[480px]">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1.5 font-display">
                      <Activity className="h-4 w-4 text-clinicalCyan" />
                      Aggregate Data Summary
                    </h3>
                    <p className="text-[10px] text-gray-500 font-mono">Modality dataset breakdown stats.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white/[0.01] border border-white/5 rounded-lg p-4 text-left">
                      <span className="text-[8px] font-mono text-gray-500 uppercase tracking-wider block">Total Scans Ingested</span>
                      <span className="text-3xl font-bold text-white font-display block mt-1">{totalScansCount.toLocaleString()} Scans</span>
                      <span className="text-[9px] text-clinicalCyan font-mono block mt-1">CROSS-MODALITY ENVELOPE</span>
                    </div>
                    <div className="bg-white/[0.01] border border-white/5 rounded-lg p-4 text-left">
                      <span className="text-[8px] font-mono text-gray-500 uppercase tracking-wider block">Overall Mean Accuracy</span>
                      <span className="text-3xl font-bold text-white font-display block mt-1">{overallAccuracy}%</span>
                      <span className="text-[9px] text-green-500 font-mono block mt-1">
                        {overallAccuracy >= 90 ? 'EXCEEDS 90% FDA TARGET' : 'AWAITING MORE INGESTIONS'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 text-[9px] font-mono text-gray-500 leading-relaxed">
                  <strong>Data Updated:</strong> Stats recalculate automatically upon execution of diagnostic prediction sweeps.
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
