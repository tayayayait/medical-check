import { AnalysisResult } from '../types';
import { apiFetch } from './apiClient';

export const submitAnalysis = async (base64Image: string, adName: string): Promise<AnalysisResult> => {
  return apiFetch('/api/analyze', {
    method: 'POST',
    body: { base64Image, adName }
  });
};
