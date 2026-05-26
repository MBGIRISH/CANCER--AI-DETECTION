import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Server } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import UploadScan from './components/UploadScan';
import AIPredictions from './components/AIPredictions';
import Reports from './components/Reports';
import Patients from './components/Patients';
import AdvancedFeatures from './components/AdvancedFeatures';
import FederatedNodes from './components/FederatedNodes';
import BackgroundEffects from './components/BackgroundEffects';

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

interface WorkspaceLockProps {
  onConnectNode: () => void;
}

function WorkspaceLock({ onConnectNode }: WorkspaceLockProps) {
  return (
    <div className="absolute inset-0 z-40 backdrop-blur-xl bg-black/80 flex flex-col items-center justify-center text-center p-8 select-none">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, type: "spring" }}
        className="max-w-md p-8 rounded-2xl border border-white/5 bg-[#07080a]/90 shadow-2xl relative overflow-hidden"
      >
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-clinicalCyan/10 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />
        
        <div className="mx-auto w-16 h-16 rounded-full bg-clinicalCyan/5 border border-clinicalCyan/15 flex items-center justify-center mb-6">
          <Lock className="h-6 w-6 text-clinicalCyan animate-pulse" />
        </div>
        
        <h2 className="text-xl font-semibold text-white tracking-wide mb-3 font-display">
          Workspace Encrypted
        </h2>
        <p className="text-xs text-gray-400 leading-relaxed mb-6 font-mono">
          NODE_CONNECTION_REQUIRED // Decode local clinical records and load AI classification weights by establishing a secure peer connection.
        </p>
        
        <button
          onClick={onConnectNode}
          className="px-6 py-3 w-full rounded bg-clinicalCyan hover:bg-[#00c0eb] text-black font-semibold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
        >
          <Server className="h-4 w-4" />
          Connect Hospital Node
        </button>
      </motion.div>
    </div>
  );
}

export interface DoctorProfile {
  id: string;
  name: string;
  role: string;
  department: string;
  avatarLetter: string;
}

export const DOCTORS: DoctorProfile[] = [
  { id: '1', name: 'Dr. Michael Carter', role: 'Lead Oncologist', department: 'Oncology Dept', avatarLetter: 'M' },
  { id: '2', name: 'Dr. Sarah Chen', role: 'Radiologist', department: 'Radiology Dept', avatarLetter: 'S' },
  { id: '3', name: 'Dr. David Reynolds', role: 'Pathologist', department: 'Pathology Dept', avatarLetter: 'D' },
  { id: '4', name: 'Dr. Elena Markovic', role: 'Surgical Oncologist', department: 'Surgical Oncology', avatarLetter: 'E' },
];

export interface ScanRecord {
  id: string;
  patient: string;
  age: string;
  dob: string;
  type: string;
  status: string;
  confidence: string;
  time: string;
  date: string;
  findings: string;
  recommendations: string;
  reportId?: string;
  findingsBullets?: string[];
  diseaseProbability?: number;
  modelConfidence?: number;
  reviewingDoctor?: string;
  generatedAt?: string;
  prediction?: string;
  activationStrength?: 'Low' | 'Moderate' | 'High';
  peakIntensity?: number;
  originalScan?: string;
  heatmapOverlay?: string;
  segmentationMask?: string;
}

export interface DashboardStats {
  totalScans: number;
  brainScans: number;
  pneumoniaScans: number;
  activeAlerts: number;
  brainAlerts: number;
  pneumoniaAlerts: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeDoctor, setActiveDoctor] = useState<DoctorProfile | null>(null);
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [scanType, setScanType] = useState<'mri' | 'ct' | 'xray' | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisComplete, setAnalysisComplete] = useState<boolean>(false);
  const [confidence, setConfidence] = useState<number>(94);
  const [probability, setProbability] = useState<number>(88);
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const recordedResultRef = useRef<any>(null);

  // Hoisted Ingestion Form States
  const [patientName, setPatientName] = useState<string>('');
  const [patientAge, setPatientAge] = useState<string>('');
  const [dob, setDob] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Dashboard Live Stats
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>(() => {
    const saved = localStorage.getItem('scanHistory');
    return saved ? JSON.parse(saved) : [];
  });

  // Derived scan history & stats dynamically calculated based on logged in doctor
  const filteredScanHistory = activeDoctor
    ? scanHistory.filter(scan => scan.reviewingDoctor === activeDoctor.name)
    : [];

  const derivedStats: DashboardStats = {
    totalScans: filteredScanHistory.length,
    brainScans: filteredScanHistory.filter(s => s.type.toLowerCase().includes('brain') || s.type.toLowerCase().includes('mri')).length,
    pneumoniaScans: filteredScanHistory.filter(s => s.type.toLowerCase().includes('pneumonia') || s.type.toLowerCase().includes('xray')).length,
    activeAlerts: filteredScanHistory.filter(s => s.status === 'Critical').length,
    brainAlerts: filteredScanHistory.filter(s => (s.type.toLowerCase().includes('brain') || s.type.toLowerCase().includes('mri')) && s.status === 'Critical').length,
    pneumoniaAlerts: filteredScanHistory.filter(s => (s.type.toLowerCase().includes('pneumonia') || s.type.toLowerCase().includes('xray')) && s.status === 'Critical').length,
  };

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      const decoded = parseJwt(token);
      if (decoded && decoded.exp > Date.now() / 1000) {
        const doc: DoctorProfile = {
          id: decoded.id,
          name: decoded.name,
          role: decoded.role,
          department: decoded.department,
          avatarLetter: decoded.avatarLetter,
        };
        setActiveDoctor(doc);

        fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
        .then(res => {
          if (!res.ok) throw new Error('Token verification failed');
          return res.json();
        })
        .then(data => {
          if (data.doctor) {
            setActiveDoctor({
              id: data.doctor.id,
              name: data.doctor.name,
              role: data.doctor.role,
              department: data.doctor.department,
              avatarLetter: data.doctor.avatarLetter,
            });
          }
        })
        .catch(err => {
          console.error("JWT verification failed:", err);
          localStorage.removeItem('jwt_token');
          setActiveDoctor(null);
        });
      } else {
        localStorage.removeItem('jwt_token');
        setActiveDoctor(null);
      }
    } else {
      setActiveDoctor(null);
    }
  }, []);

  // Sync scan history from MongoDB report service
  useEffect(() => {
    if (activeDoctor) {
      fetch(`/api/reports?doctor=${encodeURIComponent(activeDoctor.name)}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to load reports");
          return res.json();
        })
        .then(data => {
          setScanHistory(data);
        })
        .catch(err => {
          console.error("Database connection fallback: loading local storage records.", err);
          const saved = localStorage.getItem('scanHistory');
          if (saved) {
            const parsed = JSON.parse(saved);
            setScanHistory(parsed.filter((s: any) => s.reviewingDoctor === activeDoctor.name));
          }
        });
    } else {
      setScanHistory([]);
    }
  }, [activeDoctor]);

  const fallbackPatients = ['Arthur Pendleton', 'Sarah Connor', 'Michael Reeves', 'Emily Carter', 'David Morgan'];

  const getActivationStrength = (peakIntensity?: number): 'Low' | 'Moderate' | 'High' => {
    if ((peakIntensity ?? 0) >= 0.7) return 'High';
    if ((peakIntensity ?? 0) >= 0.35) return 'Moderate';
    return 'Low';
  };

  useEffect(() => {
    if (predictionResult && analysisComplete) {
      if (recordedResultRef.current === predictionResult) return;
      recordedResultRef.current = predictionResult;

      const isBrain = predictionResult.category.includes('Brain');
      const isAlert = predictionResult.risk_level === 'High' || predictionResult.risk_level === 'Critical' || predictionResult.prediction !== 'Normal';
      const status = isAlert ? 'Critical' : 'Safe';
      const patientFallback = fallbackPatients[scanHistory.length % fallbackPatients.length];
      const confidenceValue = Number(predictionResult.confidence ?? confidence);
      const activationStrength = getActivationStrength(predictionResult.peak_intensity);
      
      const newScan: ScanRecord = {
        id: `SC-${String(scanHistory.length + 1).padStart(4, '0')}`,
        reportId: `ONC-REP-2026-${String(1001 + scanHistory.length).padStart(4, '0')}`,
        patient: patientName?.trim() || patientFallback,
        age: patientAge || 'N/A',
        dob: dob || 'Unknown',
        type: predictionResult.category,
        status,
        confidence: `${confidenceValue}%`,
        time: 'Just now',
        date: new Date().toISOString().split('T')[0],
        findings: predictionResult.diagnostic_abstract || notes || (status === 'Critical'
          ? 'AI analysis identified abnormal activation requiring radiological review.'
          : 'No urgent clinical abnormalities identified.'),
        recommendations: predictionResult.recommendation || (status === 'Critical'
          ? isBrain
            ? 'Additional MRI evaluation advised.'
            : 'Further radiological review recommended.'
          : 'Routine screening follow-up recommended.'),
        reviewingDoctor: activeDoctor?.name || 'Unknown Doctor',
        generatedAt: new Date().toISOString(),
        prediction: predictionResult.prediction,
        activationStrength,
        peakIntensity: predictionResult.peak_intensity ?? 0,
        originalScan: selectedScan || undefined,
        heatmapOverlay: predictionResult.heatmap_base64 || undefined,
        segmentationMask: predictionResult.segmentation_base64 || undefined,
      };
      
      setScanHistory(prev => {
        const updated = [newScan, ...prev];
        localStorage.setItem('scanHistory', JSON.stringify(updated));
        return updated;
      });

      // Post report to MongoDB database service
      fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newScan)
      })
      .then(res => {
        if (!res.ok) throw new Error("Failed to save report");
        return res.json();
      })
      .then(saved => {
        console.log("Persisted report to database service:", saved.reportId);
      })
      .catch(err => {
        console.error("Database service write failed, saved locally:", err);
      });
    }
  }, [predictionResult, analysisComplete, activeDoctor, confidence, dob, patientAge, patientName, scanHistory.length, selectedScan]);

  const handleScanSelected = (scanUrl: string, type: 'mri' | 'ct' | 'xray') => {
    setSelectedScan(scanUrl);
    setScanType(type);
    setAnalysisComplete(false);
    setIsAnalyzing(false);
    setPredictionResult(null);

    if (type === 'mri') {
      setConfidence(94);
      setProbability(88);
    } else if (type === 'ct') {
      setConfidence(96);
      setProbability(92);
    } else {
      setConfidence(89);
      setProbability(72);
    }
  };

  const handleNavigateToPredictions = () => {
    setActiveTab('predictions');
  };

  return (
    <div className="relative min-h-screen bg-black overflow-hidden font-sans text-white select-none">
      {/* Background shaders & particle system */}
      <BackgroundEffects />

      {/* Top Header */}
      <Header activeDoctor={activeDoctor} />

      {/* Left Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} activeDoctor={activeDoctor} />

      {/* Main Workspace Frame (offset by Header and Sidebar) */}
      <main className="pl-64 pt-14 min-h-screen relative z-10 w-full">
        {!activeDoctor && activeTab !== 'nodes' && (
          <WorkspaceLock onConnectNode={() => setActiveTab('nodes')} />
        )}
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Dashboard 
                onNavigateToTab={setActiveTab} 
                scanHistory={filteredScanHistory}
                stats={derivedStats}
              />
            </motion.div>
          )}

          {activeTab === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <UploadScan
                onScanSelected={handleScanSelected}
                isAnalyzing={isAnalyzing}
                setIsAnalyzing={setIsAnalyzing}
                analysisComplete={analysisComplete}
                setAnalysisComplete={setAnalysisComplete}
                selectedScan={selectedScan}
                scanType={scanType}
                confidence={confidence}
                setConfidence={setConfidence}
                onNavigateToPredictions={handleNavigateToPredictions}
                setPredictionResult={setPredictionResult}
                patientName={patientName}
                setPatientName={setPatientName}
                patientAge={patientAge}
                setPatientAge={setPatientAge}
                dob={dob}
                setDob={setDob}
                _notes={notes}
                setNotes={setNotes}
                activeDoctor={activeDoctor}
              />
            </motion.div>
          )}

          {activeTab === 'predictions' && (
            <motion.div
              key="predictions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <AIPredictions
                selectedScan={selectedScan}
                scanType={scanType}
                confidence={confidence}
                probability={probability}
                predictionResult={predictionResult}
                patientName={patientName}
                patientAge={patientAge}
                dob={dob}
              />
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Reports 
                patientName={patientName}
                patientAge={patientAge}
                scanHistory={filteredScanHistory}
                activeDoctorName={activeDoctor?.name || ''}
              />
            </motion.div>
          )}

          {activeTab === 'patients' && (
            <motion.div
              key="patients"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Patients scanHistory={filteredScanHistory} />
            </motion.div>
          )}

          {activeTab === 'advanced' && (
            <motion.div
              key="advanced"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
            <AdvancedFeatures predictionResult={predictionResult} scanType={scanType} selectedScan={selectedScan} scanHistory={filteredScanHistory} />
            </motion.div>
          )}

          {activeTab === 'nodes' && (
            <motion.div
              key="nodes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <FederatedNodes 
                activeDoctor={activeDoctor}
                setActiveDoctor={setActiveDoctor}
                scanHistory={scanHistory}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Faint cyan ambient line at very top */}
      <div className="fixed top-0 left-0 right-0 h-[1px] bg-clinicalCyan/20 z-40 pointer-events-none" />
    </div>
  );
}
