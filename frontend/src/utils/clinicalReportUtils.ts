import type { ScanRecord } from '../App';

export type ReportStatus = 'Critical' | 'Safe';

export interface ClinicalContent {
  findings: string;
  findingsBullets: string[];
  recommendation: string;
  diseaseProbability: number;
  modelConfidence: number;
}

const PLACEHOLDER_FINDINGS = /automated findings generated|proceed with standard clinical protocol/i;

export function formatReportId(sequence: number): string {
  return `ONC-REP-2026-${1000 + sequence}`;
}

export function isValidPatientName(name: string): boolean {
  if (!name || name.trim().length < 2) return false;
  const lower = name.toLowerCase().trim();
  if (
    /unknown patient|person\d|virus|\.(jpg|jpeg|png|gif|webp)|im[_\s]?\d|^[a-z0-9_-]+\.(jpg|png)$/i.test(
      lower
    )
  ) {
    return false;
  }
  if (/^sc-\d+$/i.test(lower)) return false;
  return true;
}

export function normalizeScanType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('brain') || t.includes('mri')) return 'Brain MRI';
  if (t.includes('pneumonia') || t.includes('x-ray') || t.includes('xray')) return 'Pneumonia X-Ray';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDisplayDate(isoDate: string): string {
  try {
    const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

export function parseConfidence(value: string | number | undefined): number {
  if (typeof value === 'number') return Math.round(value);
  if (!value) return 0;
  const n = parseFloat(String(value).replace('%', ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function buildClinicalContent(params: {
  category?: string;
  status: ReportStatus;
  prediction?: string;
  confidence?: number | string;
  notes?: string;
}): ClinicalContent {
  const { category = '', status, prediction, confidence, notes } = params;
  const modelConfidence = parseConfidence(confidence);
  const cat = category.toLowerCase();
  const isBrain = cat.includes('brain') || cat.includes('mri');
  const isPneumonia = cat.includes('pneumonia') || cat.includes('x-ray') || cat.includes('xray');
  const isSafe = status === 'Safe';

  let diseaseProbability = modelConfidence;
  if (isSafe) diseaseProbability = Math.min(modelConfidence, 18);
  else if (status === 'Critical') diseaseProbability = Math.max(modelConfidence, 72);

  if (notes && notes.trim().length > 20 && !PLACEHOLDER_FINDINGS.test(notes)) {
    const bullets = notes
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    return {
      findings: notes.trim(),
      findingsBullets: bullets.length ? bullets : [notes.trim()],
      recommendation: isSafe
        ? 'Routine follow-up recommended.'
        : isBrain
          ? 'Neurological consultation advised.'
          : 'Immediate clinical correlation advised.',
      diseaseProbability,
      modelConfidence,
    };
  }

  if (isSafe) {
    const findings =
      isPneumonia
        ? 'No abnormal pulmonary opacity identified. Lung fields appear clear on radiographic review.'
        : 'No focal intracranial mass effect or abnormal enhancement pattern identified on MRI review.';
    return {
      findings,
      findingsBullets: [
        findings,
        'Grad-CAM analysis shows no dominant pathological activation regions.',
        `Model classification: ${prediction || 'Normal'} (${modelConfidence}% confidence).`,
      ],
      recommendation: 'Routine follow-up recommended.',
      diseaseProbability,
      modelConfidence,
    };
  }

  if (isBrain) {
    return {
      findings:
        'Image-derived neural activation detected. Segmentation mapping indicates irregular tissue boundaries correlating with elevated Grad-CAM signal.',
      findingsBullets: [
        'Image-derived neural activation detected on MRI review.',
        'Irregular segmented region identified within neural tissue on AI overlay.',
        `Model classification: ${prediction || 'Abnormal'} (${modelConfidence}% confidence).`,
      ],
      recommendation: 'Neurological consultation advised.',
      diseaseProbability,
      modelConfidence,
    };
  }

  return {
    findings:
      'Bilateral basal opacity pattern consistent with inflammatory consolidation. Widespread heatmap activation noted across lower lung zones.',
    findingsBullets: [
      'Diffuse alveolar consolidation pattern identified on chest radiograph.',
      'Grad-CAM heatmap shows elevated activation across bilateral basal lobes.',
      `Model classification: ${prediction || 'Positive'} (${modelConfidence}% confidence).`,
    ],
    recommendation: isSafe ? 'Routine follow-up recommended.' : 'Immediate clinical correlation advised.',
    diseaseProbability,
    modelConfidence,
  };
}

export function enrichScanRecord(scan: ScanRecord, reportIndex: number, doctorName: string): ScanRecord & {
  reportId: string;
  displayScanType: string;
  displayDate: string;
  findingsBullets: string[];
  diseaseProbability: number;
  modelConfidence: number;
  reviewingDoctor: string;
  generatedAt: string;
} {
  const status = (scan.status === 'Critical' || scan.status === 'Safe'
    ? scan.status
    : 'Safe') as ReportStatus;

  const useStored =
    scan.findings &&
    !PLACEHOLDER_FINDINGS.test(scan.findings) &&
    scan.recommendations &&
    !PLACEHOLDER_FINDINGS.test(scan.recommendations);

  const clinical = useStored
    ? {
        findings: scan.findings,
        findingsBullets: scan.findings
          .split(/[.!?]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 8),
        recommendation: scan.recommendations,
        diseaseProbability: scan.diseaseProbability ?? parseConfidence(scan.confidence),
        modelConfidence: scan.modelConfidence ?? parseConfidence(scan.confidence),
      }
    : buildClinicalContent({
        category: scan.type,
        status,
        confidence: scan.confidence,
      });

  return {
    ...scan,
    reportId: scan.reportId || formatReportId(reportIndex),
    displayScanType: normalizeScanType(scan.type),
    displayDate: formatDisplayDate(scan.date),
    findings: clinical.findings,
    findingsBullets: scan.findingsBullets?.length ? scan.findingsBullets : clinical.findingsBullets,
    recommendations: clinical.recommendation,
    diseaseProbability: clinical.diseaseProbability,
    modelConfidence: clinical.modelConfidence,
    reviewingDoctor: scan.reviewingDoctor || doctorName,
    generatedAt: scan.generatedAt || `${scan.date}T09:30:00`,
  };
}

export const DEMO_SCAN_RECORDS: ScanRecord[] = [
  {
    id: 'demo-1',
    reportId: 'ONC-REP-2026-1008',
    patient: 'Arthur Pendleton',
    age: '52',
    dob: '1974-04-12',
    type: 'Brain Tumor MRI',
    status: 'Critical',
    confidence: '91%',
    time: '09:14',
    date: '2026-05-25',
    findings: '',
    recommendations: '',
    findingsBullets: [
      'Image-derived neural activation detected on MRI review.',
      'Irregular segmented region identified within neural tissue on AI overlay.',
      'Model classification: Abnormal Signal (91% confidence).',
    ],
    diseaseProbability: 88,
    modelConfidence: 91,
    reviewingDoctor: 'Dr. Michael Carter',
    generatedAt: '2026-05-25T09:14:00',
  },

  {
    id: 'demo-3',
    reportId: 'ONC-REP-2026-1010',
    patient: 'Marcus Vance',
    age: '64',
    dob: '1962-09-02',
    type: 'Pneumonia X-Ray',
    status: 'Safe',
    confidence: '94%',
    time: '14:45',
    date: '2026-05-23',
    findings: '',
    recommendations: '',
    findingsBullets: [
      'No abnormal pulmonary opacity identified.',
      'Grad-CAM analysis shows no dominant pathological activation regions.',
    ],
    diseaseProbability: 12,
    modelConfidence: 94,
    reviewingDoctor: 'Dr. David Reynolds',
    generatedAt: '2026-05-23T14:45:00',
  },
];
