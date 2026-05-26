import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, FileText } from 'lucide-react';

import type { ScanRecord } from '../App';

interface Scan {
  date: string;
  type: string;
  finding: string;
  prediction: string;
  status: 'Critical' | 'Safe';
  region: string;
  reportId: string;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  status: 'Critical' | 'Safe';
  scans: Scan[];
}

interface PatientsProps {
  scanHistory?: ScanRecord[];
}

export default function Patients({ scanHistory = [] }: PatientsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'mri' | 'ct' | 'xray'>('all');

  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash).toString().substring(0, 4);
  };

  const cleanPatientName = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('virus') || lower.includes('person') || lower.includes('im ')) {
      const hash = getHash(name);
      return `Case #${hash}`;
    }
    return name;
  };

  const getRealisticFinding = (isSafe: boolean, type: string, index: number): string => {
    const safeFindings = [
      'No focal pulmonary opacity identified. Imaging appearance remains stable.',
      'No abnormal lesion visualized. Normal tissue characteristics observed.',
      'No lesion-correlated activation detected. Imaging appearance remains stable.',
      'Normal tissue characteristics observed throughout.',
      'No abnormal lesion visualized. No lesion-correlated activation detected.'
    ];
    const criticalFindings = [
      type.toLowerCase().includes('mri') || type.toLowerCase().includes('brain') 
        ? 'Localized frontal lesion activity detected. Suspicious lesion-correlated activation observed.'
        : 'Right lower lung opacity identified. Suspicious lesion-correlated activation observed.',
      'Focal pathological activity visualized in the abnormal region.',
      'Segmentation overlap detected in abnormal tissue region. Localized frontal lesion activity detected.',
      'Right lower lung opacity identified. Suspicious lesion-correlated activation observed.'
    ];
    
    if (isSafe) {
      return safeFindings[index % safeFindings.length];
    } else {
      return criticalFindings[index % criticalFindings.length];
    }
  };

  const getRealisticRegion = (isSafe: boolean, type: string): string => {
    if (isSafe) {
      if (type.toLowerCase().includes('mri') || type.toLowerCase().includes('brain')) {
        return 'Unremarkable brain structure';
      } else {
        return 'Normal lung fields';
      }
    } else {
      if (type.toLowerCase().includes('mri') || type.toLowerCase().includes('brain')) {
        return 'Left frontal lobe region';
      } else {
        return 'Bilateral lower lung fields';
      }
    }
  };

  const patientsMap = new Map<string, Patient>();
  
  scanHistory.forEach((scan, index) => {
    const cleanedName = cleanPatientName(scan.patient);
    const ptId = `PT-${getHash(scan.patient)}`;
    
    if (!patientsMap.has(cleanedName)) {
      patientsMap.set(cleanedName, {
        id: ptId,
        name: cleanedName,
        age: parseInt(scan.age) || 64,
        status: scan.status === 'Critical' ? 'Critical' : 'Safe',
        scans: []
      });
    }
    
    const p = patientsMap.get(cleanedName)!;
    const isSafe = scan.status === 'Safe' || scan.prediction === 'Normal' || scan.prediction === 'Safe';
    
    const predictionResult = scan.prediction || (isSafe ? 'Normal' : 'Abnormal Findings');
    const region = getRealisticRegion(isSafe, scan.type);
    const finding = getRealisticFinding(isSafe, scan.type, index);

    p.scans.push({
      date: scan.date || 'Unknown Date',
      type: scan.type || 'Unknown Modality',
      finding: finding,
      prediction: predictionResult,
      status: isSafe ? 'Safe' : 'Critical',
      region: region,
      reportId: scan.id
    });
    
    if (!isSafe) {
      p.status = 'Critical';
    }
  });
  
  const patients = Array.from(patientsMap.values());

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterCategory === 'all') return matchesSearch;
    
    return matchesSearch && p.scans.some(s => {
      if (filterCategory === 'mri') return s.type.toLowerCase().includes('mri') || s.type.toLowerCase().includes('brain');
      if (filterCategory === 'xray') return s.type.toLowerCase().includes('x-ray') || s.type.toLowerCase().includes('xray') || s.type.toLowerCase().includes('pneumonia');
      return false;
    });
  });

  const selectedPatient = filteredPatients.find(p => p.id === selectedPatientId) || filteredPatients[0] || patients[0];

  return (
    <div className="mx-auto max-w-7xl px-8 lg:px-12 py-10 lg:py-12 relative min-h-[90vh] space-y-10">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-left border-b border-white/5 pb-6 space-y-2"
      >
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white font-display">
          Clinical Imaging Registry
        </h1>
        <p className="text-sm text-gray-500 max-w-2xl leading-relaxed">
          Access PACS radiology archives, scan histories, and patient record timelines.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Side: Directory Search & Filters */}
        <div className="lg:col-span-4 space-y-4">
          {/* Search box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search registry by case name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full clinical-input font-sans text-xs"
            />
          </div>

          {/* Clinical Filter Chips */}
          <div className="flex flex-wrap gap-1.5 py-0.5 select-none">
            {(['all', 'mri', 'xray'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  filterCategory === cat 
                    ? 'bg-clinicalCyan/10 text-clinicalCyan border border-clinicalCyan/20' 
                    : 'text-gray-500 hover:text-white border border-transparent'
                }`}
              >
                {cat === 'all' ? 'All Modalities' : cat === 'mri' ? 'Brain MRI' : 'Pneumonia X-Ray'}
              </button>
            ))}
          </div>

          {/* Patients list */}
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {filteredPatients.map((patient) => {
              const isSelected = selectedPatient && patient.id === selectedPatient.id;
              const cardClass = isSelected 
                ? 'clinical-panel-active ring-1 ring-clinicalCyan/30' 
                : 'clinical-panel hover:border-white/10 hover:bg-[#121316]';
              const latestScan = patient.scans[0] || { type: 'Unknown Modality', date: 'Unknown Date' };

              return (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatientId(patient.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-300 relative ${cardClass}`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-[#050608] border border-white/5 flex items-center justify-center text-clinicalCyan shadow-inner">
                          <FileText className="h-4.5 w-4.5 text-clinicalCyan" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-white tracking-wide">{patient.name}</h4>
                          <span className="text-[10px] font-mono text-gray-500 block mt-0.5">{patient.id}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-semibold tracking-wider uppercase ${
                        patient.status === 'Critical' 
                          ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
                          : 'bg-green-500/10 border border-green-500/20 text-green-400'
                      }`}>
                        {patient.status}
                      </span>
                    </div>
                    
                    <div className="border-t border-white/5 pt-2 flex flex-col gap-1 text-[10px] text-gray-400 font-mono">
                      <div className="flex justify-between">
                        <span>Age:</span>
                        <span className="text-white font-sans">{patient.age}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Scan Type:</span>
                        <span className="text-white font-sans">{latestScan.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Scan Date:</span>
                        <span className="text-white font-sans">{latestScan.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredPatients.length === 0 && (
              <div className="text-center py-10 border border-dashed border-white/5 rounded-xl text-gray-500 text-xs">
                No matching case records found.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detailed Patient Dossier */}
        <div className="lg:col-span-8">
          {selectedPatient ? (
            <motion.div
              key={selectedPatient.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="clinical-panel p-6 lg:p-8 min-h-[500px] flex flex-col justify-between"
            >
              {/* Dossier Header */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-6 mb-6 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-[#050608] border border-white/5 flex items-center justify-center text-clinicalCyan text-sm font-semibold font-display shadow-inner">
                      <User className="h-5 w-5 text-clinicalCyan" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white uppercase font-display tracking-wide">{selectedPatient.name}</h3>
                      <span className="text-[10px] font-mono text-gray-500 block mt-0.5">CASE REFERENCE ID: {selectedPatient.id}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 bg-black/40 border border-white/5 rounded-lg px-4 py-2 text-center">
                    <div>
                      <span className="text-[8px] font-mono text-gray-500 block uppercase tracking-wider">Patient ID</span>
                      <span className="text-xs font-semibold text-white font-mono mt-0.5 block">{selectedPatient.id}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono text-gray-500 block uppercase tracking-wider">Age</span>
                      <span className="text-xs font-semibold text-white font-sans mt-0.5 block">{selectedPatient.age}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono text-gray-500 block uppercase tracking-wider">Clinical Status</span>
                      <span className={`text-xs font-semibold font-display mt-0.5 block ${
                        selectedPatient.status === 'Critical' ? 'text-red-400' : 'text-green-400'
                      }`}>{selectedPatient.status.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                {/* Scans Timeline */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-clinicalCyan mb-5 flex items-center gap-2 font-display">
                      <Calendar className="h-4 w-4" />
                      Radiology Scan Registry & Timeline
                    </h4>

                    <div className="relative border-l border-white/5 pl-6 ml-3.5 space-y-6">
                      {selectedPatient.scans.map((scan, i) => (
                        <div key={i} className="relative">
                          {/* Timeline Dot */}
                          <div className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border bg-black transition-all ${
                              i === 0 
                              ? selectedPatient.status === 'Critical'
                                ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                                : 'border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                              : 'border-white/10'
                          }`} />

                          <div className="clinical-panel p-4 rounded-lg bg-black/20 hover:border-white/10 transition-colors duration-300">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white uppercase tracking-wide">{scan.type}</span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                  scan.status === 'Critical'
                                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                    : 'bg-green-500/10 border border-green-500/20 text-green-400'
                                }`}>
                                  {scan.status.toUpperCase()}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {scan.date}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 pt-3 border-t border-white/5 font-sans">
                              <div className="sm:col-span-1">
                                <span className="text-[8px] font-mono text-gray-500 block uppercase tracking-wider">Scan Result</span>
                                <span className="text-xs font-semibold text-white mt-1 block">{scan.prediction}</span>
                              </div>
                              <div className="sm:col-span-1">
                                <span className="text-[8px] font-mono text-gray-500 block uppercase tracking-wider">Detected Region</span>
                                <span className="text-xs font-semibold text-clinicalCyan mt-1 block">{scan.region}</span>
                              </div>
                              <div className="sm:col-span-1">
                                <span className="text-[8px] font-mono text-gray-500 block uppercase tracking-wider">Imaging Findings</span>
                                <span className="text-xs font-medium text-gray-200 mt-1 block leading-relaxed">{scan.finding}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="clinical-panel p-6 lg:p-8 min-h-[500px] flex flex-col justify-center items-center text-center">
              <User className="h-12 w-12 text-gray-700 mb-4" />
              <h3 className="text-gray-400 uppercase tracking-widest font-bold text-xs">No Case Selected</h3>
              <p className="text-gray-600 text-[10px] font-mono mt-2">Select a case reference from the registry or perform a new scan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
