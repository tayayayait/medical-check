export type Role = 'admin' | 'reviewer';

export type Permission =
  | 'analysis.create'
  | 'analysis.read'
  | 'analysis.feedback.write'
  | 'analysis.history.read'
  | 'admin.users.manage'
  | 'admin.regulations.manage'
  | 'admin.settings.manage';

export interface User {
  email: string;
  role: Role;
  name: string;
}

export type RiskLevel = 'high' | 'medium' | 'low';
export type AnalysisStatus = 'queued' | 'running' | 'done' | 'failed';

export interface Reference {
  id: string;
  title: string;
  clause: string;
  excerpt: string;
}

export interface Finding {
  text: string;
  violationType: string;
  riskLevel: RiskLevel;
  referenceId?: string;
}

export interface OcrBox {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  riskLevel: RiskLevel | 'none';
}

export interface AnalysisResult {
  id: string;
  adName: string;
  createdAt: string; // ISO Date
  passScore: number; // 0-100
  riskLevel: RiskLevel;
  analysisSource?: 'ai' | 'ocr';
  aiError?: string | null;
  status: AnalysisStatus;
  imageUrl?: string;
  ocrFullText?: string;
  hasOcrBoxes?: boolean;
  ocrBoxes?: OcrBox[];
  findings?: Finding[];
  aiRationale?: string;
  references?: Reference[];
}

export interface Metrics {
  totalAnalyses: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  riskDistribution: { name: string; value: number; color: string }[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (role: Role) => void;
  logout: () => void;
}
