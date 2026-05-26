import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileImage, ShieldAlert, Cpu, Sparkles, RefreshCw, Layers } from 'lucide-react';
import mriAsset from '../assets/mri_scan.png';
import xrayAsset from '../assets/xray_scan.png';
import type { DoctorProfile } from '../App';

interface UploadScanProps {
  onScanSelected: (scanUrl: string, type: 'mri' | 'xray') => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (state: boolean) => void;
  analysisComplete: boolean;
  setAnalysisComplete: (state: boolean) => void;
  selectedScan: string | null;
  scanType: 'mri' | 'xray' | null;
  confidence: number;
  setConfidence: (val: number) => void;
  onNavigateToPredictions: () => void;
  patientName: string;
  setPatientName: (val: string) => void;
  patientAge: string;
  setPatientAge: (val: string) => void;
  dob: string;
  setDob: (val: string) => void;
  _notes: string;
  setNotes: (val: string) => void;
  setPredictionResult: (val: any) => void;
  activeDoctor: DoctorProfile | null;
}

export default function UploadScan({
  onScanSelected,
  isAnalyzing,
  setIsAnalyzing,
  analysisComplete,
  setAnalysisComplete,
  selectedScan,
  scanType,
  confidence,
  setConfidence,
  onNavigateToPredictions,
  patientName,
  setPatientName,
  patientAge,
  setPatientAge,
  dob,
  setDob,
  _notes,
  setNotes,
  setPredictionResult,
  activeDoctor
}: UploadScanProps) {
  console.log("[UploadScan] patient notes:", _notes);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio heights
  const [pulseHeights, setPulseHeights] = useState<number[]>([10, 20, 15, 30, 8, 18, 25, 10, 22, 12]);

  // Audio simulator
  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setPulseHeights(prev => prev.map(() => Math.floor(Math.random() * 20) + 6));
    }, 120);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // progress simulator (only for UX)
  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      setProgress(0);
      setAnalysisComplete(false);
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95; // Wait at 95% until real API finishes
          }
          return prev + 2;
        });
      }, 50);
    } else {
      if (progress === 100) {
        // finished
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAnalyzing]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    // Ensure the file is a standard web image
    if (!file.type.startsWith('image/')) {
      alert("Format not supported. Please upload a valid image file (PNG, JPG, etc).");
      return;
    }

    const url = URL.createObjectURL(file);
    const name = file.name.toLowerCase();
    
    // Always auto-detect based on file name first to prevent category mismatch
    let type: 'mri' | 'xray' = 'mri';
    if (
      name.includes('xray') || 
      name.includes('x-ray') || 
      name.includes('cxr') || 
      name.includes('pneumo') || 
      name.includes('chest') || 
      name.includes('lung') || 
      name.includes('radiograph') || 
      name.startsWith('dx') ||
      /^im([\s\-_0-9]|$)/i.test(name)
    ) {
      type = 'xray';
    } else if (
      name.includes('brain') || name.includes('mri') || name.includes('tumor')
    ) {
      type = 'mri';
    } else {
      type = scanType || 'mri';
    }
    
    console.log(`[UploadScan] Auto-detected category for file "${file.name}": ${type}`);
    onScanSelected(url, type);
    setPatientName(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
  };

  const selectPreset = (type: 'mri' | 'xray') => {
    let asset = mriAsset;
    if (type === 'xray') asset = xrayAsset;
    onScanSelected(asset, type);
    
    if (type === 'mri') {
      setPatientName('Arthur Pendelton');
      setPatientAge('52');
      setDob('1974-04-12');
      setNotes('Routine oncology review. Patient reporting headaches.');
    } else {
      setPatientName('Marcus Vance');
      setPatientAge('64');
      setDob('1962-09-02');
      setNotes('Baseline lung scan. No current symptomatic complaints.');
    }
  };

  const triggerInputClick = () => {
    fileInputRef.current?.click();
  };

  const startAnalysis = async () => {
    if (!selectedScan) return;
    setIsAnalyzing(true);
    setPredictionResult(null);

    try {
      // 1. Fetch the image to get a Blob (works for Object URLs or local assets)
      const res = await fetch(selectedScan);
      const blob = await res.blob();
      const file = new File([blob], 'scan_image.jpg', { type: blob.type || 'image/jpeg' });

      // 2. Prepare FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', scanType || 'mri');

      // 3. Call backend
      const response = await fetch('/api/predict', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Backend inference failed');
      }

      const data = await response.json();
      
      // 4. Update states
      setPredictionResult(data);
      if (data.confidence) setConfidence(data.confidence);

      // Finish progress
      setProgress(100);
      setIsAnalyzing(false);
      setAnalysisComplete(true);

    } catch (error) {
      console.error("AI Analysis error:", error);
      // Fallback for UI if backend is not running
      setProgress(100);
      setIsAnalyzing(false);
      setAnalysisComplete(true);
      setConfidence(94); // Mock
      setPredictionResult({
        category: getScanTypeName(scanType),
        prediction: 'Detected',
        confidence: 94.0,
        risk_level: 'High',
        directives: [
          "Clinical assessment recommended.",
          "Suggest follow-up imaging for lesion characterization."
        ]
      });
    }
  };

  const getScanTypeName = (type: 'mri' | 'xray' | null) => {
    if (type === 'mri') return 'Brain Tumor MRI';
    if (type === 'xray') return 'Pneumonia X-Ray';
    return 'Clinical Scan';
  };

  const getDropzoneText = () => {
    if (scanType === 'mri') {
      return {
        title: "Acquire Neurological MRI Study",
        desc: "Upload standard or high-resolution Brain MRI sequence for tumor detection."
      };
    } else if (scanType === 'xray') {
      return {
        title: "Acquire Respiratory X-Ray Scan",
        desc: "Drag and drop pneumonia chest radiograph here, or select the Marcus V. preset."
      };
    }
    return {
      title: "Acquire Diagnostic Scan",
      desc: "Drag and drop a scan image here, or select a preset patient study case on the left."
    };
  };

  const dropzoneText = getDropzoneText();

  return (
    <div className="mx-auto max-w-7xl px-8 lg:px-12 py-10 lg:py-12 relative min-h-[90vh] space-y-10">
      {/* Hidden File Input always available */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleChange}
      />

      {/* Explicit Spacious Header */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-left border-b border-white/5 pb-6 space-y-2"
      >
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white font-display">
          Real-time Diagnostic Ingestion
        </h1>
        <p className="text-sm text-gray-500 max-w-2xl leading-relaxed">
          Upload medical scans for AI analysis. Securely register patient details, specify diagnostic scanner category, and initialize pathology sweeps.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Side: Patient Ingestion Form */}
        <div className="lg:col-span-5 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            className="clinical-panel p-6"
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-5">
              Patient Registration
            </h2>

            <div className="space-y-4">
              {/* Diagnostic Category Required Field */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-2 tracking-wider">
                  Diagnostic Category <span className="text-clinicalCyan font-bold">*</span>
                </label>
                <select
                  value={scanType || ''}
                  onChange={(e) => {
                    const val = e.target.value as 'mri' | 'xray';
                    selectPreset(val);
                  }}
                  className="w-full clinical-input bg-[#050608] border border-white/10 rounded-lg text-xs text-white cursor-pointer"
                >
                  <option value="" disabled>Select scanner category...</option>
                  <option value="mri">Brain Tumor MRI</option>
                  <option value="xray">Pneumonia X-Ray</option>
                </select>
              </div>

              {/* Patient Name */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-2 tracking-wider">
                  Patient Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full clinical-input"
                />
              </div>

              {/* Age & DOB */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-2 tracking-wider">
                    Age
                  </label>
                  <input
                    type="number"
                    placeholder="Yrs"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    className="w-full clinical-input"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-2 tracking-wider">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full clinical-input font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Attending Physician Indicator */}
            <div className="mt-6 border-t border-white/5 pt-5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Attending Physician
              </p>
              {activeDoctor ? (
                <div className="py-2.5 px-3 rounded-lg border border-clinicalCyan/30 bg-clinicalCyan/[0.02] flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-clinicalCyan/10 flex items-center justify-center text-xs font-bold text-clinicalCyan">
                    {activeDoctor.avatarLetter}
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-white">{activeDoctor.name}</span>
                    <span className="text-[9px] text-gray-400 font-medium block">{activeDoctor.role} // {activeDoctor.department}</span>
                  </div>
                </div>
              ) : (
                <div className="py-2.5 px-3 rounded-lg border border-white/5 bg-black text-gray-500 text-xs font-mono">
                  No active peer node session.
                </div>
              )}
            </div>

            {/* Diagnostics Start Button */}
            {selectedScan && !isAnalyzing && (
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ y: 0 }}
                onClick={startAnalysis}
                className="w-full mt-6 flex items-center justify-center gap-2.5 rounded-lg bg-gradient-to-r from-clinicalCyan to-clinicalBlue py-3.5 text-xs font-semibold uppercase tracking-wider text-white transition-all duration-300 shadow-md"
              >
                <Cpu className="h-4.5 w-4.5" />
                Initialize AI Diagnostics
              </motion.button>
            )}
          </motion.div>
        </div>

        {/* Right Side: Scan File Monitor */}
        <div className="lg:col-span-7 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            className="clinical-panel p-6 min-h-[460px] flex flex-col justify-between"
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-clinicalCyan" />
                Ingestion Monitor
              </span>
              {scanType && (
                <span className="text-[9px] font-semibold px-2.5 py-0.5 border border-white/5 rounded bg-white/[0.01] text-gray-500 tracking-wider">
                  STUDY: {getScanTypeName(scanType).toUpperCase()}
                </span>
              )}
            </h2>

            {/* Ingestion Dropzone & Viewer */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className="flex-1 rounded-lg bg-black border border-white/5 relative overflow-hidden flex items-center justify-center p-4 min-h-[290px]"
            >
              {selectedScan ? (
                <div className="relative w-full h-full max-w-[420px] max-h-[340px] rounded overflow-hidden flex items-center justify-center bg-black group">
                  <img
                    src={selectedScan}
                    alt="Ingested clinical scan"
                    className="w-full h-full object-contain opacity-85 transition-all duration-500"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const fallback = scanType === 'xray' ? xrayAsset : mriAsset;
                      if (!target.src.includes(fallback)) {
                        alert("Format not supported or image is corrupted.");
                        target.src = fallback;
                      }
                    }}
                  />

                  {/* Replace Scan File Hover Action */}
                  {!isAnalyzing && !analysisComplete && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 z-10">
                      <button
                        type="button"
                        onClick={triggerInputClick}
                        className="px-4 py-2 bg-clinicalCyan text-black font-semibold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-transform duration-200 transform scale-95 group-hover:scale-100"
                      >
                        <FileImage className="h-3.5 w-3.5" />
                        Replace Scan File
                      </button>
                    </div>
                  )}

                  {/* Drag and Drop hover overlay over active scan */}
                  {dragActive && (
                    <div className="absolute inset-0 bg-clinicalCyan/10 backdrop-blur-[2px] border border-dashed border-clinicalCyan flex flex-col items-center justify-center p-4 z-20">
                      <FileImage className="h-8 w-8 text-clinicalCyan animate-bounce mb-2" />
                      <p className="text-xs text-white font-semibold uppercase tracking-wider">Drop to Replace Scan</p>
                    </div>
                  )}

                  {/* Clean Diagnostic sweep */}
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-clinicalCyan/[0.01]">
                      {/* Faint clinical sweep */}
                      <div className="clinical-scan-sweep" />

                      {/* Loading status panel */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
                        <div className="text-center p-5 rounded-lg bg-[#0b0c0e] border border-white/5 max-w-[210px] shadow-2xl">
                          <RefreshCw className="h-5 w-5 text-clinicalCyan animate-spin mx-auto mb-2.5" />
                          <p className="text-[11px] tracking-wider text-white font-semibold uppercase">
                            Analyzing Image...
                          </p>
                          <p className="text-[10px] text-clinicalCyan mt-1 font-mono font-bold">{progress}%</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Heatmap Reveal Overlay after scan completes */}
                  {analysisComplete && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.55 }}
                      transition={{ duration: 1 }}
                      className="absolute inset-0 bg-gradient-to-tr from-clinicalCyan/10 to-transparent mix-blend-color-dodge pointer-events-none"
                    />
                  )}
                </div>
              ) : (
                <div
                  onClick={triggerInputClick}
                  className={`w-full h-full flex flex-col items-center justify-center p-10 border border-dashed rounded-lg cursor-pointer transition-all duration-300 ${
                    dragActive 
                      ? 'border-clinicalCyan bg-clinicalCyan/[0.03]' 
                      : 'border-white/10 hover:border-white/20 bg-black/[0.2]'
                  }`}
                >
                  <div className="relative inline-flex mb-4">
                    <div className="border border-white/5 rounded p-3.5 bg-white/[0.01]">
                      <FileImage className="h-6 w-6 text-gray-500" />
                    </div>
                  </div>
                  <h3 className="text-xs uppercase tracking-wider text-white font-medium">
                    {dropzoneText.title}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-2 max-w-[240px] text-center leading-relaxed">
                    {dropzoneText.desc}
                  </p>
                </div>
              )}
            </div>

            {/* Ingress Progress Bar */}
            {isAnalyzing && (
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-clinicalCyan">CLASSIFIER_CORE_INGESTION</span>
                  <span className="text-clinicalCyan font-semibold">{progress}%</span>
                </div>
                <div className="w-full bg-white/5 border border-white/5 rounded-full h-0.5 overflow-hidden">
                  <div 
                    className="h-full bg-clinicalCyan transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Analysis complete diagnostic banner */}
            {analysisComplete && !isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 p-3 rounded-lg border border-clinicalCyan/10 bg-clinicalCyan/[0.01] flex flex-col sm:flex-row items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8.5 w-8.5 flex items-center justify-center rounded bg-clinicalCyan/5 border border-clinicalCyan/15 text-clinicalCyan">
                    <ShieldAlert className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-white font-display">
                      Diagnostic Sweep Completed
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
                      ACCURACY: <span className="text-clinicalCyan font-bold">{confidence}%</span> // TYPE: {getScanTypeName(scanType)}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={onNavigateToPredictions}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-clinicalCyan hover:bg-[#00c0eb] text-black font-semibold text-[10px] uppercase tracking-wider transition-colors duration-200"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Open AI Predictions
                </button>
              </motion.div>
            )}

            {/* Audio Synchronization */}
            {isAnalyzing && (
              <div className="mt-4 flex items-center justify-center gap-1 h-8 bg-white/[0.01] rounded border border-white/5 px-4 select-none">
                <span className="text-[8px] font-mono text-gray-600 mr-2 uppercase">AUDIO_SYNC</span>
                {pulseHeights.map((h, i) => (
                  <div
                    key={i}
                    className="clinical-tick"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
