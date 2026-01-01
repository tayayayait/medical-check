import React, { useEffect, useMemo, useState } from 'react';
import { Card, Input, Button, Badge, Alert, Tabs, TabPanel, Modal, Select, Toggle, Toast, Table, Textarea } from '../components/UIComponents';
import { Trash2, Edit, Plus, Upload, FileText } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import {
  listForbiddenPhrases,
  listUsers,
  addForbiddenPhrase,
  deleteForbiddenPhrase,
  updateForbiddenPhrase,
  addUser,
  updateUser,
  getSystemSettings,
  saveSystemSettings,
  ingestRegulations,
  listAuditLogs,
  ForbiddenPhrase,
  AdminUser,
  SystemSettings,
  AuditLog
} from '../services/adminService';

export const AdminSettings: React.FC = () => {
  const { can } = usePermissions();

  const tabItems = useMemo(() => {
    return [
      { id: 'regulations', label: '규정 관리', allowed: can('admin.regulations.manage') },
      { id: 'forbidden', label: '금지어 관리', allowed: can('admin.regulations.manage') },
      { id: 'users', label: '사용자 관리', allowed: can('admin.users.manage') },
      { id: 'system', label: '시스템', allowed: can('admin.settings.manage') },
    ].filter((item) => item.allowed);
  }, [can]);

  const [activeTab, setActiveTab] = useState<string>(tabItems[0]?.id ?? '');
  const [forbiddenList, setForbiddenList] = useState<ForbiddenPhrase[]>([]);
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ auditLog: true, retention: '180d' });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('저장되었습니다.');

  const [regFile, setRegFile] = useState<File | null>(null);
  const [regPreviewOpen, setRegPreviewOpen] = useState(false);
  const [regPreviewText, setRegPreviewText] = useState('');
  const [regStatus, setRegStatus] = useState<'idle' | 'queued' | 'completed'>('idle');
  const [regError, setRegError] = useState<string | null>(null);

  const [newPhrase, setNewPhrase] = useState('');
  const [newRisk, setNewRisk] = useState<'high' | 'medium' | 'low'>('medium');
  const [newViolationType, setNewViolationType] = useState('');
  const [newReferenceId, setNewReferenceId] = useState('');
  const [editPhrase, setEditPhrase] = useState<ForbiddenPhrase | null>(null);
  const [deletePhrase, setDeletePhrase] = useState<ForbiddenPhrase | null>(null);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'reviewer'>('reviewer');
  const [userStatus, setUserStatus] = useState<'active' | 'disabled'>('active');

  useEffect(() => {
    if (!tabItems.find((item) => item.id === activeTab)) {
      setActiveTab(tabItems[0]?.id ?? '');
    }
  }, [activeTab, tabItems]);

  useEffect(() => {
    const loadAdminData = async () => {
      const [forbidden, users, settings, logs] = await Promise.all([
        listForbiddenPhrases(),
        listUsers(),
        getSystemSettings(),
        listAuditLogs()
      ]);
      setForbiddenList(forbidden);
      setUsersList(users);
      setSystemSettings(settings);
      setAuditLogs(logs);
    };
    void loadAdminData();
  }, []);

  const refreshAuditLogs = async () => {
    const logs = await listAuditLogs();
    setAuditLogs(logs);
  };

  const handleShowToast = (message: string) => {
    setToastMessage(message);
    setToastOpen(true);
  };

  const validateRegFile = (file: File) => {
    const allowedTypes = ['application/pdf', 'application/json', 'text/csv', 'application/vnd.ms-excel'];
    const allowedExt = ['.pdf', '.json', '.csv'];
    const lower = file.name.toLowerCase();
    if (allowedTypes.includes(file.type)) return null;
    if (allowedExt.some((ext) => lower.endsWith(ext))) return null;
    return 'PDF, JSON, CSV 파일만 업로드할 수 있습니다.';
  };

  const handleRegFile = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    const validationError = validateRegFile(file);
    if (validationError) {
      setRegError(validationError);
      setRegFile(null);
      setRegPreviewText('');
      return;
    }
    setRegError(null);
    setRegFile(file);
    setRegStatus('idle');
    if (file.type === 'application/json' || file.type === 'text/csv' || file.name.toLowerCase().endsWith('.json') || file.name.toLowerCase().endsWith('.csv')) {
      const text = await file.text();
      setRegPreviewText(text.slice(0, 2000));
    } else {
      setRegPreviewText('PDF 파일은 텍스트 미리보기를 지원하지 않습니다.');
    }
  };

  const handleRegIngest = async () => {
    if (!regFile) {
      setRegError('업로드할 파일을 선택해주세요.');
      return;
    }
    const result = await ingestRegulations(regFile.name);
    setRegStatus(result.status);
    handleShowToast(result.status === 'queued' ? '색인 요청이 접수되었습니다.' : '색인이 완료되었습니다.');
    await refreshAuditLogs();
  };

  const handleAddPhrase = async () => {
    if (!newPhrase.trim()) return;
    const added = await addForbiddenPhrase(newPhrase.trim(), newRisk, {
      violationType: newViolationType.trim() || null,
      referenceId: newReferenceId.trim() || null
    });
    setForbiddenList((prev) => [added, ...prev]);
    setNewPhrase('');
    setNewRisk('medium');
    setNewViolationType('');
    setNewReferenceId('');
    handleShowToast('금지어가 추가되었습니다.');
    await refreshAuditLogs();
  };

  const handleUpdatePhrase = async () => {
    if (!editPhrase) return;
    const updated = await updateForbiddenPhrase(editPhrase.id, {
      phrase: editPhrase.phrase,
      riskLevel: editPhrase.riskLevel,
      violationType: editPhrase.violationType ?? null,
      referenceId: editPhrase.referenceId ?? null
    });
    if (updated) {
      setForbiddenList((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      handleShowToast('금지어가 수정되었습니다.');
      await refreshAuditLogs();
    }
    setEditPhrase(null);
  };

  const handleDeletePhrase = async () => {
    if (!deletePhrase) return;
    await deleteForbiddenPhrase(deletePhrase.id);
    setForbiddenList((prev) => prev.filter((item) => item.id !== deletePhrase.id));
    handleShowToast('금지어가 삭제되었습니다.');
    await refreshAuditLogs();
    setDeletePhrase(null);
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserEmail('');
    setUserRole('reviewer');
    setUserStatus('active');
    setUserModalOpen(true);
  };

  const openEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setUserEmail(user.email);
    setUserRole(user.role);
    setUserStatus(user.status);
    setUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!userEmail.trim()) return;
    if (editingUser) {
      const updated = await updateUser(editingUser.id, { role: userRole, status: userStatus });
      if (updated) {
        setUsersList((prev) => prev.map((item) => item.id === updated.id ? updated : item));
        handleShowToast('사용자 정보가 수정되었습니다.');
      }
    } else {
      const created = await addUser(userEmail.trim(), userRole, userStatus);
      setUsersList((prev) => [created, ...prev]);
      handleShowToast('사용자가 추가되었습니다.');
    }
    setUserModalOpen(false);
    await refreshAuditLogs();
  };

  const handleToggleUserStatus = async (user: AdminUser) => {
    const nextStatus = user.status === 'active' ? 'disabled' : 'active';
    const updated = await updateUser(user.id, { role: user.role, status: nextStatus });
    if (updated) {
      setUsersList((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      handleShowToast(nextStatus === 'active' ? '사용자가 활성화되었습니다.' : '사용자가 비활성화되었습니다.');
      await refreshAuditLogs();
    }
  };

  const handleSaveSystem = async () => {
    const saved = await saveSystemSettings(systemSettings);
    setSystemSettings(saved);
    handleShowToast('시스템 설정이 저장되었습니다.');
    await refreshAuditLogs();
  };

  if (tabItems.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">관리자 설정</h1>
        <Alert tone="error" message="이 페이지에 접근할 권한이 없습니다." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">관리자 설정</h1>

      <Tabs
        items={tabItems.map(({ id, label }) => ({ id, label }))}
        value={activeTab}
        onChange={setActiveTab}
      />

      <div className="mt-6">
        <TabPanel value={activeTab} when="regulations">
          <div className="space-y-6">
            <Card title="규정 데이터베이스 업데이트">
              <div className="p-4 border-2 border-dashed border-border rounded-lg bg-gray-50 flex flex-col items-center justify-center">
                <Upload className="w-10 h-10 text-text-secondary mb-3" />
                <p className="text-sm text-text-primary font-medium">최신 규정 PDF/JSON/CSV 업로드</p>
                <p className="text-xs text-text-secondary mt-1">업로드 시 벡터 데이터베이스가 재색인 됩니다.</p>
                <label className="mt-4">
                  <input
                    type="file"
                    accept=".pdf,.json,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleRegFile(e.target.files);
                    }}
                  />
                  <Button className="mt-2" variant="secondary">파일 선택</Button>
                </label>
              </div>
              {regFile && (
                <div className="mt-4 flex items-center justify-between bg-gray-50 border border-border rounded-md p-3">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <FileText size={16} />
                    <span>{regFile.name} ({(regFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setRegPreviewOpen(true)}>미리보기</Button>
                </div>
              )}
              {regError && (
                <Alert tone="error" message={regError} className="mt-4" />
              )}
              {regStatus !== 'idle' && (
                <Alert
                  tone={regStatus === 'queued' ? 'warning' : 'success'}
                  message={regStatus === 'queued' ? '색인 요청이 접수되었습니다.' : '색인이 완료되었습니다.'}
                  className="mt-4"
                />
              )}
              <div className="mt-4 flex justify-end">
                <Button onClick={handleRegIngest}>수집 및 색인 재구축</Button>
              </div>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value={activeTab} when="forbidden">
          <div className="space-y-6">
            <Card title="금지어 관리">
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <Input
                    placeholder="새로운 금지어"
                    className="md:col-span-2"
                    value={newPhrase}
                    onChange={(e) => setNewPhrase(e.target.value)}
                  />
                  <Input
                    placeholder="위반 유형"
                    value={newViolationType}
                    onChange={(e) => setNewViolationType(e.target.value)}
                  />
                  <Input
                    placeholder="근거 ID (예: ML56-08)"
                    value={newReferenceId}
                    onChange={(e) => setNewReferenceId(e.target.value)}
                  />
                  <Select
                    value={newRisk}
                    onChange={(e) => setNewRisk(e.target.value as 'high' | 'medium' | 'low')}
                    options={[
                      { value: 'high', label: '고위험' },
                      { value: 'medium', label: '중위험' },
                      { value: 'low', label: '저위험' }
                    ]}
                  />
                  <Button onClick={handleAddPhrase}><Plus size={16} /> 추가</Button>
                </div>
              </div>
              
              <Table>
                <thead className="bg-gray-50 text-text-secondary font-medium">
                  <tr>
                    <th className="px-4 py-2">금지어</th>
                    <th className="px-4 py-2">위반 유형</th>
                    <th className="px-4 py-2">근거 ID</th>
                    <th className="px-4 py-2">위험도</th>
                    <th className="px-4 py-2 text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {forbiddenList.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium">{item.phrase}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{item.violationType || '-'}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{item.referenceId || '-'}</td>
                      <td className="px-4 py-3"><Badge variant={item.riskLevel as any} label={item.riskLevel === 'high' ? '고위험' : item.riskLevel === 'medium' ? '중위험' : '저위험'} /></td>
                      <td className="px-4 py-3 text-right flex justify-end gap-2">
                         <button className="p-1 hover:bg-gray-100 rounded text-text-secondary" onClick={() => setEditPhrase(item)}><Edit size={16}/></button>
                         <button className="p-1 hover:bg-gray-100 rounded text-risk-high" onClick={() => setDeletePhrase(item)}><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value={activeTab} when="users">
          <div className="space-y-6">
            <Card title="사용자 관리" action={<Button size="sm" onClick={openAddUser}><Plus size={16}/> 사용자 추가</Button>}>
              <Table>
                <thead className="bg-gray-50 text-text-secondary font-medium">
                  <tr>
                    <th className="px-4 py-2">이메일</th>
                    <th className="px-4 py-2">역할</th>
                    <th className="px-4 py-2">상태</th>
                    <th className="px-4 py-2 text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                   {usersList.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3"><Badge label={user.role === 'admin' ? '관리자' : '검토자'} variant={user.role === 'admin' ? 'default' : 'info'} /></td>
                      <td className={`px-4 py-3 ${user.status === 'active' ? 'text-risk-low' : 'text-text-secondary'}`}>
                        {user.status === 'active' ? '활성' : '비활성'}
                      </td>
                      <td className="px-4 py-3 text-right flex gap-2 justify-end">
                        <Button variant="ghost" className="h-8" onClick={() => openEditUser(user)}>수정</Button>
                        <Button
                          variant="ghost"
                          className={`h-8 ${user.status === 'active' ? 'text-risk-high' : 'text-risk-low'}`}
                          onClick={() => handleToggleUserStatus(user)}
                        >
                          {user.status === 'active' ? '비활성' : '활성'}
                        </Button>
                      </td>
                   </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value={activeTab} when="system">
          <div className="space-y-6">
            <Card title="시스템 설정">
              <div className="flex flex-col gap-4">
                <Toggle
                  checked={systemSettings.auditLog}
                  onChange={(value) => setSystemSettings((prev) => ({ ...prev, auditLog: value }))}
                  label="감사 로그 사용"
                />
                <Select
                  label="데이터 보관 기간"
                  value={systemSettings.retention}
                  onChange={(e) => setSystemSettings((prev) => ({ ...prev, retention: e.target.value as SystemSettings['retention'] }))}
                  options={[
                    { value: '30d', label: '30일' },
                    { value: '90d', label: '90일' },
                    { value: '180d', label: '180일' },
                    { value: '365d', label: '365일' }
                  ]}
                />
                <div className="flex justify-end">
                  <Button onClick={handleSaveSystem}>저장</Button>
                </div>
              </div>
            </Card>

            <Card title="감사 로그">
              <Table>
                <thead className="bg-gray-50 text-text-secondary font-medium">
                  <tr>
                    <th className="px-4 py-2">일시</th>
                    <th className="px-4 py-2">행동</th>
                    <th className="px-4 py-2">담당자</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-sm text-text-secondary">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-text-primary">{log.action}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{log.actor}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </TabPanel>
      </div>

      <Modal
        isOpen={regPreviewOpen}
        onClose={() => setRegPreviewOpen(false)}
        title="규정 미리보기"
      >
        {regFile ? (
          <div className="space-y-4">
            <div className="text-sm text-text-secondary">
              파일명: {regFile.name} ({(regFile.size / 1024).toFixed(1)} KB)
            </div>
            <Textarea value={regPreviewText || '미리보기 데이터가 없습니다.'} readOnly rows={10} />
          </div>
        ) : (
          <Alert tone="warning" message="선택된 파일이 없습니다." />
        )}
      </Modal>

      <Modal
        isOpen={!!editPhrase}
        onClose={() => setEditPhrase(null)}
        title="금지어 수정"
      >
        {editPhrase && (
          <div className="space-y-4">
            <Input
              label="금지어"
              value={editPhrase.phrase}
              onChange={(e) => setEditPhrase({ ...editPhrase, phrase: e.target.value })}
            />
            <Input
              label="위반 유형"
              value={editPhrase.violationType ?? ''}
              onChange={(e) => setEditPhrase({ ...editPhrase, violationType: e.target.value })}
            />
            <Input
              label="근거 ID"
              value={editPhrase.referenceId ?? ''}
              onChange={(e) => setEditPhrase({ ...editPhrase, referenceId: e.target.value })}
            />
            <Select
              label="위험도"
              value={editPhrase.riskLevel}
              onChange={(e) => setEditPhrase({ ...editPhrase, riskLevel: e.target.value as 'high' | 'medium' | 'low' })}
              options={[
                { value: 'high', label: '고위험' },
                { value: 'medium', label: '중위험' },
                { value: 'low', label: '저위험' }
              ]}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditPhrase(null)}>취소</Button>
              <Button onClick={handleUpdatePhrase}>저장</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!deletePhrase}
        onClose={() => setDeletePhrase(null)}
        title="삭제 확인"
      >
        {deletePhrase && (
          <div className="space-y-4">
            <Alert tone="warning" message="이 작업은 되돌릴 수 없습니다." />
            <div className="text-sm text-text-secondary">"{deletePhrase.phrase}" 항목을 삭제하시겠습니까?</div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeletePhrase(null)}>취소</Button>
              <Button variant="danger" onClick={handleDeletePhrase}>삭제</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUser ? '사용자 수정' : '사용자 추가'}
      >
        <div className="space-y-4">
          <Input
            label="이메일"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            disabled={!!editingUser}
          />
          <Select
            label="역할"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as 'admin' | 'reviewer')}
            options={[
              { value: 'admin', label: '관리자' },
              { value: 'reviewer', label: '검토자' }
            ]}
          />
          <Select
            label="상태"
            value={userStatus}
            onChange={(e) => setUserStatus(e.target.value as 'active' | 'disabled')}
            options={[
              { value: 'active', label: '활성' },
              { value: 'disabled', label: '비활성' }
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUserModalOpen(false)}>취소</Button>
            <Button onClick={handleSaveUser}>저장</Button>
          </div>
        </div>
      </Modal>

      <Toast
        isOpen={toastOpen}
        onClose={() => setToastOpen(false)}
        message={toastMessage}
        variant="success"
      />
    </div>
  );
};
