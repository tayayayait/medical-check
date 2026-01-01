import { RiskLevel, Role } from '../types';
import { apiFetch } from './apiClient';

export type ForbiddenPhrase = {
  id: string;
  phrase: string;
  riskLevel: RiskLevel;
  violationType?: string | null;
  referenceId?: string | null;
  updatedAt: string;
};

export type AdminUser = {
  id: string;
  email: string;
  role: Role;
  status: 'active' | 'disabled';
};

export type SystemSettings = {
  auditLog: boolean;
  retention: '30d' | '90d' | '180d' | '365d';
};

export type AuditLog = {
  id: string;
  action: string;
  actor: string;
  createdAt: string;
};

export const listForbiddenPhrases = async (): Promise<ForbiddenPhrase[]> => {
  return apiFetch('/api/admin/forbidden');
};

export const addForbiddenPhrase = async (
  phrase: string,
  riskLevel: RiskLevel,
  extra?: { violationType?: string | null; referenceId?: string | null }
): Promise<ForbiddenPhrase> => {
  return apiFetch('/api/admin/forbidden', {
    method: 'POST',
    body: { phrase, riskLevel, ...(extra ?? {}) }
  });
};

export const updateForbiddenPhrase = async (
  id: string,
  updates: { phrase: string; riskLevel: RiskLevel; violationType?: string | null; referenceId?: string | null }
): Promise<ForbiddenPhrase | null> => {
  return apiFetch(`/api/admin/forbidden/${id}`, {
    method: 'PUT',
    body: updates
  });
};

export const deleteForbiddenPhrase = async (id: string): Promise<void> => {
  return apiFetch(`/api/admin/forbidden/${id}`, {
    method: 'DELETE'
  });
};

export const listUsers = async (): Promise<AdminUser[]> => {
  return apiFetch('/api/admin/users');
};

export const addUser = async (email: string, role: Role, status: AdminUser['status'] = 'active'): Promise<AdminUser> => {
  return apiFetch('/api/admin/users', {
    method: 'POST',
    body: { email, role, status }
  });
};

export const updateUser = async (id: string, updates: { role: Role; status: AdminUser['status'] }): Promise<AdminUser | null> => {
  return apiFetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: updates
  });
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
  return apiFetch('/api/admin/settings');
};

export const saveSystemSettings = async (next: SystemSettings): Promise<SystemSettings> => {
  return apiFetch('/api/admin/settings', {
    method: 'PUT',
    body: next
  });
};

export const ingestRegulations = async (fileName?: string): Promise<{ status: 'queued' | 'completed' }> => {
  return apiFetch('/api/admin/regulations/ingest', {
    method: 'POST',
    body: { fileName }
  });
};

export const listAuditLogs = async (): Promise<AuditLog[]> => {
  return apiFetch('/api/admin/audit-logs');
};
