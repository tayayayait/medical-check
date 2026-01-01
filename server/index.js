import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import { db, initDb, insertAuditLog } from './db.js';
import { analyzeAdWithOpenAI, generateRationaleWithOpenAI } from './openai.js';
import { analyzeImageWithVision } from './vision.js';
import { LEGAL_REFERENCE_MAP } from './legalReferences.js';
import { ensureUploadsDir, saveBase64Image, signFileUrl, verifyFileToken } from './storage.js';
import { requirePermission } from './permissions.js';

dotenv.config();
dotenv.config({ path: '.env.local' });

initDb();
ensureUploadsDir();

const app = express();
app.use(express.json({ limit: '20mb' }));

const mapAnalysisRow = (row) => {
  if (!row) return null;
  const ocrBoxes = row.ocrBoxesJson ? JSON.parse(row.ocrBoxesJson) : [];
  return {
    id: row.id,
    adName: row.adName,
    createdAt: row.createdAt,
    passScore: row.passScore,
    riskLevel: row.riskLevel,
    analysisSource: row.analysisSource,
    aiError: row.aiError,
    status: row.status,
    imageUrl: row.imageFileId ? signFileUrl(row.imageFileId) : undefined,
    ocrFullText: row.ocrFullText,
    hasOcrBoxes: ocrBoxes.length > 0,
    ocrBoxes,
    aiRationale: row.aiRationale,
    findings: row.findingsJson ? JSON.parse(row.findingsJson) : [],
    references: row.referencesJson ? JSON.parse(row.referencesJson) : []
  };
};

const buildReferences = (findings) => {
  const references = new Map();
  findings.forEach((finding) => {
    const refId = finding.referenceId;
    if (!refId) return;
    const ref = LEGAL_REFERENCE_MAP[refId];
    if (ref) {
      references.set(ref.id, ref);
    } else {
      references.set(refId, {
        id: refId,
        title: '법령 기준',
        clause: '참고용 요약',
        excerpt: '등록된 법령 요약 정보가 없습니다.'
      });
    }
  });
  ['ML57-01', 'ML24-01'].forEach((refId) => {
    const ref = LEGAL_REFERENCE_MAP[refId];
    if (ref) {
      references.set(ref.id, ref);
    }
  });
  return Array.from(references.values());
};

const buildLegalDetails = (findings) => {
  if (!findings.length) {
    return 'OCR 텍스트에서 법령상 금지 유형에 해당하는 표현이 발견되지 않았습니다.';
  }
  const lines = findings.map((finding) => {
    const refLabel = finding.referenceId ? ` (${finding.referenceId})` : '';
    return `- "${finding.text}": ${finding.violationType}${refLabel}`;
  });
  return `법령상 위험 표현 ${findings.length}건이 감지되었습니다:\n${lines.join('\n')}`;
};

const buildLegalNotes = () => (
  '본 결과는 의료법 제56조(금지 의료광고 유형) 요약 기준에 따른 참고용 분석입니다. ' +
  '광고 매체가 사전심의 대상이라면 의료법 제57조 및 시행령 제24조에 따른 사전심의 필요 여부를 확인해야 합니다.'
);

const createAnalysisResult = (payload) => {
  const id = `AN-${Date.now()}`;
  db.prepare(`
    INSERT INTO analysis_results (
      id, adName, createdAt, passScore, riskLevel, analysisSource, aiError, status, imageFileId, ocrFullText, ocrBoxesJson, aiRationale, findingsJson, referencesJson
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    payload.adName,
    payload.createdAt,
    payload.passScore,
    payload.riskLevel,
    payload.analysisSource,
    payload.aiError,
    payload.status,
    payload.imageFileId,
    payload.ocrFullText,
    JSON.stringify(payload.ocrBoxes ?? []),
    payload.aiRationale,
    JSON.stringify(payload.findings ?? []),
    JSON.stringify(payload.references ?? [])
  );
  return id;
};

const updateJobStatus = (jobId, status, updates = {}) => {
  db.prepare(`
    UPDATE analysis_jobs
    SET status = ?, resultId = COALESCE(?, resultId), error = COALESCE(?, error), updatedAt = ?
    WHERE id = ?
  `).run(status, updates.resultId ?? null, updates.error ?? null, new Date().toISOString(), jobId);
};

const processJob = async (jobId, adName, base64Image, actor) => {
  updateJobStatus(jobId, 'running');
  try {
    const fileRecord = saveBase64Image(base64Image);
    db.prepare('INSERT INTO files (id, path, mimeType, createdAt) VALUES (?, ?, ?, ?)').run(
      fileRecord.id,
      fileRecord.path,
      fileRecord.mimeType,
      new Date().toISOString()
    );

    const forbiddenList = db.prepare('SELECT phrase, riskLevel, violationType, referenceId FROM forbidden_phrases').all();
    const visionResult = await analyzeImageWithVision(base64Image, forbiddenList);

    let aiResult = null;
    let aiError = null;
    try {
      aiResult = await analyzeAdWithOpenAI({
        adName,
        imageDataUrl: base64Image,
        ocrText: visionResult.ocrFullText
      });
    } catch (error) {
      aiResult = null;
      aiError = error instanceof Error ? error.message : 'AI 분석 실패';
      console.error(`[AI] 분석 실패 (${adName}):`, aiError);
    }

    const useAiResult = !!aiResult;
    const findings = useAiResult ? aiResult.findings : visionResult.findings;
    const passScore = useAiResult ? aiResult.passScore : visionResult.passScore;
    const riskLevel = useAiResult ? aiResult.riskLevel : visionResult.riskLevel;
    const analysisSource = useAiResult ? 'ai' : 'ocr';

    const references = buildReferences(findings);
    const legalDetails = buildLegalDetails(findings);
    const legalNotes = buildLegalNotes();
    const legalSummary = `${legalDetails}\n\n${legalNotes}`;

    let rationale = aiResult?.rationale || '';
    if (!rationale) {
      try {
        rationale = await generateRationaleWithOpenAI({
          adName,
          ocrText: visionResult.ocrFullText,
          findings,
          legalSummary
        });
      } catch (error) {
        rationale = legalSummary;
      }
    } else if (!rationale.includes('법령 근거 요약')) {
      rationale = `${rationale}\n\n법령 근거 요약:\n${legalSummary}`;
    }

    const resultId = createAnalysisResult({
      adName,
      createdAt: new Date().toISOString(),
      passScore,
      riskLevel,
      analysisSource,
      aiError,
      status: 'done',
      imageFileId: fileRecord.id,
      ocrFullText: visionResult.ocrFullText,
      ocrBoxes: visionResult.ocrBoxes,
      aiRationale: rationale,
      findings,
      references
    });

    updateJobStatus(jobId, 'done', { resultId });
    insertAuditLog(`분석 완료: ${adName}`, actor);
  } catch (error) {
    const message = error instanceof Error ? error.message : '분석에 실패했습니다.';
    updateJobStatus(jobId, 'failed', { error: message });
    insertAuditLog(`분석 실패: ${adName}`, actor);
  }
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/analysis/jobs', requirePermission('analysis.create'), (req, res) => {
  const { adName, base64Image } = req.body ?? {};
  if (!adName || !base64Image) {
    return res.status(400).json({ error: 'adName and base64Image are required.' });
  }

  const jobId = `JOB-${Date.now()}`;
  db.prepare(`
    INSERT INTO analysis_jobs (id, status, createdAt, updatedAt, requestedBy)
    VALUES (?, ?, ?, ?, ?)
  `).run(jobId, 'queued', new Date().toISOString(), new Date().toISOString(), req.user.email);

  insertAuditLog(`분석 요청: ${adName}`, req.user.email);
  setTimeout(() => {
    void processJob(jobId, adName, base64Image, req.user.email);
  }, 300);

  res.json({ jobId });
});

app.get('/api/analysis/jobs/:jobId', requirePermission('analysis.read'), (req, res) => {
  const job = db.prepare('SELECT * FROM analysis_jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  const resultRow = job.resultId
    ? db.prepare('SELECT * FROM analysis_results WHERE id = ?').get(job.resultId)
    : null;
  const result = resultRow ? mapAnalysisRow(resultRow) : undefined;
  res.json({ status: job.status, result, error: job.error ?? undefined });
});

app.get('/api/analysis/history', requirePermission('analysis.history.read'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM analysis_results ORDER BY createdAt DESC').all();
  res.json(rows.map(mapAnalysisRow));
});

app.get('/api/analysis/metrics', requirePermission('analysis.history.read'), (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM analysis_results').get().count;
  const high = db.prepare(`SELECT COUNT(*) as count FROM analysis_results WHERE riskLevel = 'high'`).get().count;
  const medium = db.prepare(`SELECT COUNT(*) as count FROM analysis_results WHERE riskLevel = 'medium'`).get().count;
  const low = db.prepare(`SELECT COUNT(*) as count FROM analysis_results WHERE riskLevel = 'low'`).get().count;

  res.json({
    totalAnalyses: total,
    highRiskCount: high,
    mediumRiskCount: medium,
    lowRiskCount: low,
    riskDistribution: [
      { name: '고위험', value: high, color: '#E53935' },
      { name: '중위험', value: medium, color: '#FB8C00' },
      { name: '저위험', value: low, color: '#43A047' }
    ]
  });
});

app.get('/api/analysis/:id', requirePermission('analysis.read'), (req, res) => {
  const row = db.prepare('SELECT * FROM analysis_results WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Analysis not found.' });
  res.json(mapAnalysisRow(row));
});

app.get('/api/files/:fileId', (req, res) => {
  const { fileId } = req.params;
  const { token, expires } = req.query;
  if (!verifyFileToken(fileId, token, expires)) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
  const fileRow = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
  if (!fileRow) return res.status(404).json({ error: 'File not found.' });
  if (!fs.existsSync(fileRow.path)) {
    return res.status(404).json({ error: 'File missing on disk.' });
  }
  res.setHeader('Content-Type', fileRow.mimeType || 'image/jpeg');
  fs.createReadStream(fileRow.path).pipe(res);
});

app.get('/api/admin/forbidden', requirePermission('admin.regulations.manage'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM forbidden_phrases ORDER BY updatedAt DESC').all();
  res.json(rows);
});

app.post('/api/admin/forbidden', requirePermission('admin.regulations.manage'), (req, res) => {
  const { phrase, riskLevel, violationType, referenceId } = req.body ?? {};
  if (!phrase || !riskLevel) {
    return res.status(400).json({ error: 'phrase and riskLevel are required.' });
  }
  const id = `FP-${Date.now()}`;
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO forbidden_phrases (id, phrase, riskLevel, violationType, referenceId, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, phrase, riskLevel, violationType ?? null, referenceId ?? null, updatedAt);
  insertAuditLog(`금지어 추가: ${phrase}`, req.user.email);
  res.json({ id, phrase, riskLevel, violationType: violationType ?? null, referenceId: referenceId ?? null, updatedAt });
});

app.put('/api/admin/forbidden/:id', requirePermission('admin.regulations.manage'), (req, res) => {
  const { phrase, riskLevel, violationType, referenceId } = req.body ?? {};
  if (!phrase || !riskLevel) {
    return res.status(400).json({ error: 'phrase and riskLevel are required.' });
  }
  const updatedAt = new Date().toISOString();
  db.prepare(`
    UPDATE forbidden_phrases
    SET phrase = ?,
        riskLevel = ?,
        violationType = COALESCE(?, violationType),
        referenceId = COALESCE(?, referenceId),
        updatedAt = ?
    WHERE id = ?
  `).run(phrase, riskLevel, violationType ?? null, referenceId ?? null, updatedAt, req.params.id);
  insertAuditLog(`금지어 수정: ${phrase}`, req.user.email);
  res.json({
    id: req.params.id,
    phrase,
    riskLevel,
    violationType: violationType ?? null,
    referenceId: referenceId ?? null,
    updatedAt
  });
});

app.delete('/api/admin/forbidden/:id', requirePermission('admin.regulations.manage'), (req, res) => {
  const row = db.prepare('SELECT phrase FROM forbidden_phrases WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM forbidden_phrases WHERE id = ?').run(req.params.id);
  if (row?.phrase) {
    insertAuditLog(`금지어 삭제: ${row.phrase}`, req.user.email);
  }
  res.status(204).end();
});

app.get('/api/admin/users', requirePermission('admin.users.manage'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY email ASC').all();
  res.json(rows);
});

app.post('/api/admin/users', requirePermission('admin.users.manage'), (req, res) => {
  const { email, role, status } = req.body ?? {};
  if (!email || !role) {
    return res.status(400).json({ error: 'email and role are required.' });
  }
  const id = `U-${Date.now()}`;
  const nextStatus = status || 'active';
  db.prepare('INSERT INTO users (id, email, role, status) VALUES (?, ?, ?, ?)').run(id, email, role, nextStatus);
  insertAuditLog(`사용자 추가: ${email}`, req.user.email);
  res.json({ id, email, role, status: nextStatus });
});

app.put('/api/admin/users/:id', requirePermission('admin.users.manage'), (req, res) => {
  const { role, status } = req.body ?? {};
  if (!role || !status) {
    return res.status(400).json({ error: 'role and status are required.' });
  }
  db.prepare('UPDATE users SET role = ?, status = ? WHERE id = ?').run(role, status, req.params.id);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (row) {
    insertAuditLog(`사용자 수정: ${row.email}`, req.user.email);
  }
  res.json(row);
});

app.get('/api/admin/settings', requirePermission('admin.settings.manage'), (_req, res) => {
  const row = db.prepare('SELECT auditLog, retention FROM system_settings WHERE id = 1').get();
  res.json({ auditLog: !!row.auditLog, retention: row.retention });
});

app.put('/api/admin/settings', requirePermission('admin.settings.manage'), (req, res) => {
  const { auditLog, retention } = req.body ?? {};
  const auditFlag = auditLog ? 1 : 0;
  db.prepare('UPDATE system_settings SET auditLog = ?, retention = ? WHERE id = 1').run(auditFlag, retention);
  insertAuditLog(`시스템 설정 저장 (감사로그: ${auditLog ? '켜짐' : '꺼짐'}, 보관기간: ${retention})`, req.user.email);
  res.json({ auditLog: !!auditFlag, retention });
});

app.post('/api/admin/regulations/ingest', requirePermission('admin.regulations.manage'), (req, res) => {
  const { fileName } = req.body ?? {};
  insertAuditLog(`규정 색인 요청${fileName ? `: ${fileName}` : ''}`, req.user.email);
  res.json({ status: 'queued' });
});

app.get('/api/admin/audit-logs', requirePermission('admin.settings.manage'), (_req, res) => {
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY createdAt DESC').all();
  res.json(rows);
});

const PORT = process.env.SERVER_PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
