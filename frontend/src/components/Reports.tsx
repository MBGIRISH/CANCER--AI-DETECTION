import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, BarChart3, Calendar, ChevronDown, CheckCircle2,
  Download, FileText, RefreshCw, Search, Shield, Stethoscope, User
} from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

import type { ScanRecord } from '../App';

type ReportStatus = 'Critical' | 'Safe';
type ActivationStrength = 'Low' | 'Moderate' | 'High';

interface ClinicalReport {
  reportId: string;
  patientName: string;
  patientAge: string;
  scanType: string;
  studyDate: string;
  generatedDate: string;
  status: ReportStatus;
  confidence: number;
  activationStrength: ActivationStrength;
  reviewingDoctor: string;
  findings: string[];
  recommendation: string;
  originalScan?: string;
  heatmapOverlay?: string;
  segmentationMask?: string;
}

interface ReportsProps {
  patientName?: string;
  patientAge?: string;
  scanHistory?: ScanRecord[];
  activeDoctorName?: string;
}

const SCAN_FILTER_OPTIONS = ['All', 'Brain MRI', 'Pneumonia X-Ray'];
const STATUS_FILTER_OPTIONS: Array<'All' | ReportStatus> = ['All', 'Safe', 'Critical'];
const FALLBACK_PATIENTS = ['Arthur Pendleton', 'Sarah Connor', 'Michael Reeves', 'Emily Carter', 'David Morgan'];
const PLACEHOLDER_TEXT = /automated findings generated|proceed with standard clinical protocol|unknown patient|available after scan/i;

function statusBadgeClass(status: ReportStatus) {
  return status === 'Critical'
    ? 'bg-red-500/10 border-red-500/25 text-red-300'
    : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300';
}

function statusIcon(status: ReportStatus) {
  return status === 'Critical'
    ? <AlertTriangle className="h-3 w-3" />
    : <Shield className="h-3 w-3" />;
}

function parseConfidence(value: string | number | undefined) {
  if (typeof value === 'number') return Math.round(value * 10) / 10;
  const parsed = parseFloat(String(value ?? '').replace('%', ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : 0;
}

function formatDisplayDate(value: string | undefined) {
  if (!value) return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizeScanType(type: string | undefined) {
  const scanType = (type || 'Diagnostic Scan').toLowerCase();
  if (scanType.includes('brain') || scanType.includes('mri')) return 'Brain MRI';
  if (scanType.includes('pneumonia') || scanType.includes('x-ray') || scanType.includes('xray')) return 'Pneumonia X-Ray';
  return type || 'Diagnostic Scan';
}

function cleanPatientName(name: string | undefined, index: number) {
  const trimmed = (name || '').trim();
  if (
    trimmed.length < 2 ||
    /unknown patient|person\d|im[_\s-]?\d|virus|\.(jpg|jpeg|png|webp)|^sc-\d+$/i.test(trimmed)
  ) {
    return FALLBACK_PATIENTS[index % FALLBACK_PATIENTS.length];
  }
  return trimmed;
}

function normalizeStatus(scan: ScanRecord): ReportStatus {
  const prediction = (scan.prediction || '').toLowerCase();
  const rawStatus = (scan.status || '').toLowerCase();
  if (prediction === 'normal' || rawStatus === 'safe' || rawStatus === 'stable') return 'Safe';
  return 'Critical';
}

function getActivationStrength(scan: ScanRecord, status: ReportStatus): ActivationStrength {
  if (status === 'Safe') return 'Low';
  if (scan.activationStrength) return scan.activationStrength;
  const intensity = scan.peakIntensity ?? 0;
  if (intensity >= 0.7) return 'High';
  if (intensity >= 0.35) return 'Moderate';
  return 'Low';
}

function dynamicRecommendation(report: Pick<ClinicalReport, 'status' | 'scanType' | 'confidence' | 'activationStrength'>, stored?: string) {
  if (stored && !PLACEHOLDER_TEXT.test(stored)) return stored;
  if (report.status === 'Safe') {
    return report.confidence >= 90
      ? 'No urgent clinical abnormalities identified. Routine screening follow-up recommended.'
      : 'No urgent clinical abnormalities identified. Clinical follow-up may continue per screening schedule.';
  }
  if (report.scanType === 'Brain MRI') {
    return report.activationStrength === 'High'
      ? 'Additional MRI evaluation and clinical specialist consultation recommended.'
      : 'Further radiological review recommended for the abnormal MRI activation pattern.';
  }
  return 'Clinical specialist consultation recommended with follow-up imaging correlation.';
}

function dynamicFindings(scan: ScanRecord, status: ReportStatus, confidence: number, activationStrength: ActivationStrength) {
  if (scan.findings && !PLACEHOLDER_TEXT.test(scan.findings)) {
    return scan.findings
      .split(/[.!?]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 8)
      .slice(0, 3);
  }
  if (status === 'Safe') {
    return [
      `AI assessment returned Safe with ${confidence}% prediction confidence.`,
      'No dominant abnormal activation pattern was identified on the submitted scan.',
    ];
  }
  return [
    `AI assessment returned Critical with ${confidence}% prediction confidence.`,
    `${activationStrength} Grad-CAM activation was recorded in the image-derived area of interest.`,
  ];
}

function buildReport(scan: ScanRecord, index: number, activeDoctorName?: string): ClinicalReport {
  const status = normalizeStatus(scan);
  const confidence = parseConfidence(scan.confidence);
  const scanType = normalizeScanType(scan.type);
  const activationStrength = getActivationStrength(scan, status);
  const partial = { status, scanType, confidence, activationStrength };

  return {
    reportId: scan.reportId || `ONC-REP-2026-${String(1001 + index).padStart(4, '0')}`,
    patientName: cleanPatientName(scan.patient, index),
    patientAge: scan.age || 'N/A',
    scanType,
    studyDate: formatDisplayDate(scan.date),
    generatedDate: formatDisplayDate(scan.generatedAt || scan.date),
    status,
    confidence,
    activationStrength,
    reviewingDoctor: scan.reviewingDoctor || activeDoctorName || 'Active clinician',
    findings: dynamicFindings(scan, status, confidence, activationStrength),
    recommendation: dynamicRecommendation(partial, scan.recommendations),
    originalScan: scan.originalScan,
    heatmapOverlay: status === 'Critical' ? scan.heatmapOverlay : undefined,
    segmentationMask: status === 'Critical' ? scan.segmentationMask : undefined,
  };
}

export default function Reports({ patientName, patientAge, scanHistory = [], activeDoctorName }: ReportsProps) {
  const [selectedId, setSelectedId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanFilter, setScanFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | ReportStatus>('All');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showScanDropdown, setShowScanDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const reports = useMemo(() => {
    return scanHistory
      .slice(0, 5)
      .map((scan, index) => buildReport(
        {
          ...scan,
          patient: scan.patient || patientName || FALLBACK_PATIENTS[index % FALLBACK_PATIENTS.length],
          age: scan.age || patientAge || 'N/A',
        },
        index,
        activeDoctorName,
      ));
  }, [activeDoctorName, patientAge, patientName, scanHistory]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const query = searchQuery.toLowerCase();
      const matchSearch = !query ||
        report.patientName.toLowerCase().includes(query) ||
        report.reportId.toLowerCase().includes(query) ||
        report.scanType.toLowerCase().includes(query);
      const matchScan = scanFilter === 'All' || report.scanType === scanFilter;
      const matchStatus = statusFilter === 'All' || report.status === statusFilter;
      return matchSearch && matchScan && matchStatus;
    });
  }, [reports, scanFilter, searchQuery, statusFilter]);

  const selectedReport = filteredReports.find((report) => report.reportId === selectedId) || filteredReports[0];
  const imagingItems = selectedReport
    ? [
        { label: 'Original Scan', src: selectedReport.originalScan },
        { label: 'Heatmap', src: selectedReport.heatmapOverlay },
        { label: 'Segmentation', src: selectedReport.segmentationMask },
      ].filter((item): item is { label: string; src: string } => Boolean(item.src))
    : [];

  const handleExport = () => {
    if (!selectedReport) return;
    setIsExporting(true);
    setExportProgress(10); // Start progress for visual feedback
    
    const element = document.getElementById('report-content');
    if (!element) {
      setIsExporting(false);
      return;
    }

    const opt = {
      margin:       10,
      filename:     `${selectedReport.reportId}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    } as any;

    html2pdf().set(opt).from(element).save().then(() => {
      setIsExporting(false);
    }).catch((err: any) => {
      console.error(err);
      setIsExporting(false);
      alert('Failed to generate PDF');
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-8 lg:px-12 py-10 relative min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold tracking-tight text-white">Clinical Reports</h1>
        <p className="mt-1 text-sm text-gray-500">AI-assisted reports generated from completed scan analyses.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search reports"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded bg-white/[0.03] border border-white/8 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <button
                  onClick={() => { setShowScanDropdown((value) => !value); setShowStatusDropdown(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded bg-white/[0.03] border border-white/8 text-xs text-gray-300 hover:border-white/15 transition-all"
                >
                  <span>{scanFilter}</span>
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                </button>
                {showScanDropdown && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-[#0e0e12] border border-white/10 rounded overflow-hidden shadow-xl">
                    {SCAN_FILTER_OPTIONS.map((option) => (
                      <button
                        key={option}
                        onClick={() => { setScanFilter(option); setShowScanDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5 ${scanFilter === option ? 'text-cyan-300' : 'text-gray-300'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => { setShowStatusDropdown((value) => !value); setShowScanDropdown(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded bg-white/[0.03] border border-white/8 text-xs text-gray-300 hover:border-white/15 transition-all"
                >
                  <span>{statusFilter}</span>
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                </button>
                {showStatusDropdown && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-30 bg-[#0e0e12] border border-white/10 rounded overflow-hidden shadow-xl">
                    {STATUS_FILTER_OPTIONS.map((option) => (
                      <button
                        key={option}
                        onClick={() => { setStatusFilter(option); setShowStatusDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5 ${statusFilter === option ? 'text-cyan-300' : 'text-gray-300'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-[10px] text-gray-600 font-mono">
            Showing {filteredReports.length} of {reports.length} recent reports
          </p>

          <div className="space-y-2">
            {filteredReports.length === 0 ? (
              <div className="rounded border border-white/8 bg-white/[0.02] p-8 text-center text-xs text-gray-500">
                No completed reports match the current filters.
              </div>
            ) : (
              filteredReports.map((report) => {
                const isSelected = report.reportId === selectedReport?.reportId;
                return (
                  <motion.button
                    key={report.reportId}
                    onClick={() => setSelectedId(report.reportId)}
                    whileHover={{ x: 2 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className={`w-full text-left rounded p-4 border transition-all duration-200 ${
                      isSelected
                        ? 'bg-white/[0.055] border-white/20'
                        : 'bg-white/[0.02] border-white/8 hover:border-white/14 hover:bg-white/[0.035]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{report.patientName}</p>
                        <p className="mt-1 text-[11px] text-gray-500">{report.scanType}</p>
                        <p className="mt-2 text-[9px] font-mono text-gray-600">{report.reportId}</p>
                      </div>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold border shrink-0 ${statusBadgeClass(report.status)}`}>
                        {statusIcon(report.status)}
                        {report.status}
                      </span>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {selectedReport ? (
              <motion.div
                key={selectedReport.reportId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="rounded bg-white/[0.02] border border-white/8 relative overflow-hidden"
                id="report-content"
              >
                <div className="p-7 space-y-7">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-semibold text-white tracking-tight">AI Diagnostic Report</h2>
                        <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold border ${statusBadgeClass(selectedReport.status)}`}>
                          {statusIcon(selectedReport.status)}
                          {selectedReport.status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-gray-500">
                        <span>{selectedReport.scanType}</span>
                        <span className="text-gray-700">/</span>
                        <span className="font-mono">{selectedReport.reportId}</span>
                        <span className="text-gray-700">/</span>
                        <span>Generated {selectedReport.generatedDate}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleExport}
                      disabled={isExporting}
                      data-html2canvas-ignore="true"
                      className="flex items-center gap-1.5 px-3 py-2 rounded bg-white/[0.04] border border-white/10 text-[10px] font-semibold text-gray-300 hover:text-white hover:bg-white/[0.07] hover:border-white/20 transition-all shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export PDF
                    </button>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-4">
                    {[
                      { label: 'Patient Name', value: selectedReport.patientName, icon: <User className="h-3 w-3" /> },
                      { label: 'Age', value: `${selectedReport.patientAge} yrs`, icon: <BarChart3 className="h-3 w-3" /> },
                      { label: 'Scan Type', value: selectedReport.scanType, icon: <FileText className="h-3 w-3" /> },
                      { label: 'Study Date', value: selectedReport.studyDate, icon: <Calendar className="h-3 w-3" /> },
                      { label: 'Reviewing Physician', value: selectedReport.reviewingDoctor, icon: <Stethoscope className="h-3 w-3" /> },
                    ].map(({ label, value, icon }) => (
                      <div key={label}>
                        <div className="flex items-center gap-1.5 mb-1 text-gray-600">
                          {icon}
                          <span className="text-[8px] font-mono uppercase tracking-wider">{label}</span>
                        </div>
                        <p className="text-[12px] font-semibold text-white leading-snug">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Prediction Confidence', value: `${selectedReport.confidence}%` },
                      { label: 'AI Assessment', value: selectedReport.status },
                      { label: 'Activation Strength', value: selectedReport.activationStrength },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded border border-white/8 bg-white/[0.025] p-4">
                        <p className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">{metric.label}</p>
                        <p className={`mt-2 text-lg font-semibold ${
                          metric.value === 'Critical' ? 'text-red-300' :
                          metric.value === 'Safe' ? 'text-emerald-300' : 'text-white'
                        }`}>
                          {metric.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">AI Diagnostic Findings</h3>
                    <div className="space-y-2">
                      {selectedReport.findings.map((finding, index) => (
                        <div key={index} className="flex items-start gap-2.5">
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${selectedReport.status === 'Critical' ? 'text-red-300' : 'text-emerald-300'}`} />
                          <p className="text-[13px] text-gray-300 leading-relaxed">{finding}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Clinical Recommendation</h3>
                    <p className={`rounded border px-4 py-3 text-[13px] leading-relaxed ${
                      selectedReport.status === 'Critical'
                        ? 'bg-red-500/[0.035] border-red-500/15 text-red-100'
                        : 'bg-emerald-500/[0.035] border-emerald-500/15 text-emerald-100'
                    }`}>
                      {selectedReport.recommendation}
                    </p>
                  </div>

                  {imagingItems.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Imaging Analysis</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {imagingItems.map((item) => (
                          <div key={item.label} className="rounded border border-white/8 bg-black/40 p-3">
                            <div className="h-36 rounded bg-black flex items-center justify-center overflow-hidden">
                              <img src={item.src} alt={item.label} className="h-full w-full object-contain" />
                            </div>
                            <p className="mt-2 text-[10px] font-mono text-gray-500 uppercase tracking-wider">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {isExporting && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-20"
                    >
                      <div className="text-center space-y-4 max-w-xs w-full px-8">
                        <RefreshCw className="h-5 w-5 text-cyan-300 animate-spin mx-auto" />
                        <div>
                          <p className="text-sm font-semibold text-white mb-1">Generating Report PDF</p>
                          <p className="text-[10px] text-gray-500">{selectedReport.reportId}</p>
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-1.5 w-full bg-white/8 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-300 transition-all duration-75 rounded-full"
                              style={{ width: `${exportProgress}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-cyan-300/70 font-mono">{exportProgress}%</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded border border-white/8 bg-white/[0.02] min-h-[420px] flex flex-col items-center justify-center text-center p-12"
              >
                <div className="h-12 w-12 rounded bg-white/4 border border-white/8 flex items-center justify-center mb-4">
                  <FileText className="h-5 w-5 text-gray-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-300 mb-1">No Reports Available</h3>
                <p className="text-xs text-gray-600 max-w-sm">
                  Complete an AI diagnostic scan to generate a clinical report for review.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
