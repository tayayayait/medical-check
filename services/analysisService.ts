import { AnalysisResult, Metrics, AnalysisStatus } from '../types';
import { apiFetch } from './apiClient';

export type AnalysisJob = {
  id?: string;
  status: AnalysisStatus;
  result?: AnalysisResult;
  error?: string;
};

export const listHistory = async (): Promise<AnalysisResult[]> => {
  return apiFetch('/api/analysis/history');
};

export const getMetrics = async (): Promise<Metrics> => {
  return apiFetch('/api/analysis/metrics');
};

export const getById = async (id: string): Promise<AnalysisResult> => {
  return apiFetch(`/api/analysis/${id}`);
};

export const submitAnalysis = async (base64Image: string, adName: string): Promise<{ jobId: string }> => {
  return apiFetch('/api/analysis/jobs', {
    method: 'POST',
    body: { base64Image, adName }
  });
};

export const getAnalysisJob = async (jobId: string): Promise<AnalysisJob> => {
  return apiFetch(`/api/analysis/jobs/${jobId}`);
};
