import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useGlobalData } from '../App';
import { Card, Badge, Button, Modal, Table, Alert, Textarea, RadioGroup, Toast } from '../components/UIComponents';
import { AlertTriangle, Download, Maximize2, CheckCircle, Copy } from 'lucide-react';
import { OcrBox } from '../types';

export const AnalysisDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { history, isLoading } = useGlobalData();
  const [isImgModalOpen, setIsImgModalOpen] = useState(false);
  const [selectedFindingIdx, setSelectedFindingIdx] = useState<number | null>(null);
  const [feedbackFit, setFeedbackFit] = useState<'fit' | 'partial' | 'notfit'>('fit');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('저장되었습니다.');
  const [imageMeta, setImageMeta] = useState({ naturalWidth: 0, naturalHeight: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  const analysis = history.find(item => item.id === id);
  const findings = analysis?.findings ?? [];
  const references = analysis?.references ?? [];

  if (isLoading) {
    return <div className="text-center py-10 text-text-secondary">데이터를 불러오는 중...</div>;
  }

  if (!analysis) {
    return <Navigate to="/dashboard" />;
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-risk-low';
    if (score >= 50) return 'text-risk-medium';
    return 'text-risk-high';
  };

  const getRiskLabel = (risk: string) => {
      switch(risk) {
          case 'high': return '고위험';
          case 'medium': return '중위험';
          case 'low': return '저위험';
          default: return risk;
      }
  }

  const selectedFinding = selectedFindingIdx !== null ? findings[selectedFindingIdx] : null;
  const highlightPhrases = useMemo(() => {
    return Array.from(new Set(findings.map((item) => item.text).filter(Boolean)));
  }, [findings]);

  useEffect(() => {
    const updateMeta = () => {
      const img = imageRef.current;
      if (!img) return;
      setImageMeta({
        naturalWidth: img.naturalWidth || 0,
        naturalHeight: img.naturalHeight || 0
      });
    };
    updateMeta();
    window.addEventListener('resize', updateMeta);
    return () => window.removeEventListener('resize', updateMeta);
  }, []);

  const normalizeBox = (box: OcrBox) => {
    const { x, y, w, h } = box;
    if (x <= 1 && y <= 1 && w <= 1 && h <= 1) {
      return { left: x * 100, top: y * 100, width: w * 100, height: h * 100 };
    }
    if (imageMeta.naturalWidth && imageMeta.naturalHeight) {
      return {
        left: (x / imageMeta.naturalWidth) * 100,
        top: (y / imageMeta.naturalHeight) * 100,
        width: (w / imageMeta.naturalWidth) * 100,
        height: (h / imageMeta.naturalHeight) * 100
      };
    }
    return null;
  };

  const selectedPhrase = selectedFinding?.text ?? null;
  const matchedBoxes = useMemo(() => {
    if (!selectedPhrase || !analysis?.ocrBoxes) return [];
    const target = selectedPhrase.toLowerCase();
    return analysis.ocrBoxes
      .map((box, idx) => ({ box, idx }))
      .filter(({ box }) => {
        const text = box.text?.toLowerCase() ?? '';
        return text.includes(target) || target.includes(text);
      });
  }, [analysis?.ocrBoxes, selectedPhrase]);

  const boxColor = (risk: string) => {
    if (risk === 'high') return 'border-risk-high bg-risk-high/20';
    if (risk === 'medium') return 'border-risk-medium bg-risk-medium/20';
    if (risk === 'low') return 'border-risk-low bg-risk-low/20';
    return 'border-primary bg-primary/20';
  };

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const handleSelectByText = (phrase: string) => {
    const index = findings.findIndex((item) => item.text.toLowerCase() === phrase.toLowerCase());
    if (index >= 0) setSelectedFindingIdx(index);
  };

  const renderHighlightedOcr = () => {
    const text = analysis?.ocrFullText ?? '';
    if (!text) return <span>텍스트가 감지되지 않았습니다.</span>;
    if (highlightPhrases.length === 0) return <span>{text}</span>;

    const sorted = [...highlightPhrases].sort((a, b) => b.length - a.length);
    const regex = new RegExp(sorted.map(escapeRegExp).join('|'), 'gi');
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(<span key={`${lastIndex}-text`}>{text.slice(lastIndex, match.index)}</span>);
      }
      const matchedText = match[0];
      const isActive = selectedPhrase && matchedText.toLowerCase() === selectedPhrase.toLowerCase();
      nodes.push(
        <button
          type="button"
          key={`${match.index}-match`}
          onClick={() => handleSelectByText(matchedText)}
          className={`px-1 rounded ${isActive ? 'bg-yellow-300 text-text-primary' : 'bg-yellow-100 text-text-primary'} hover:bg-yellow-200`}
        >
          {matchedText}
        </button>
      );
      lastIndex = match.index + matchedText.length;
    }
    if (lastIndex < text.length) {
      nodes.push(<span key={`${lastIndex}-tail`}>{text.slice(lastIndex)}</span>);
    }
    return nodes;
  };

  const handleCopyBasis = async () => {
    try {
      await navigator.clipboard.writeText(analysis?.aiRationale || '');
      setToastMessage('복사되었습니다.');
      setToastOpen(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDownloadBasis = () => {
    const referenceText = references.length
      ? references.map((ref) => `- ${ref.id} ${ref.title} (${ref.clause})\n  ${ref.excerpt}`).join('\n')
      : '참조 조항 없음';
    const content = `광고명: ${analysis?.adName ?? ''}\n분석 일시: ${analysis?.createdAt ? new Date(analysis.createdAt).toLocaleString() : ''}\n\nAI 분석 사유:\n${analysis?.aiRationale ?? ''}\n\n참조 조항:\n${referenceText}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${analysis?.adName || 'analysis'}-rationale.txt`.replace(/\s+/g, '_');
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveFeedback = () => {
    setToastMessage('저장되었습니다.');
    setToastOpen(true);
  };

  const handleClearFeedback = () => {
    setFeedbackFit('fit');
    setFeedbackComment('');
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <Card className="bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-text-primary">{analysis.adName}</h1>
              <Badge variant={analysis.riskLevel} label={getRiskLabel(analysis.riskLevel)} />
            </div>
            <p className="text-text-secondary text-sm">분석 일시: {new Date(analysis.createdAt).toLocaleString()}</p>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-xs text-text-secondary uppercase font-semibold">통과 가능성</p>
              <p className={`text-3xl font-bold ${getScoreColor(analysis.passScore)}`}>
                {analysis.passScore}<span className="text-lg text-text-secondary">/100</span>
              </p>
            </div>
            <div className="h-10 w-px bg-border hidden md:block"></div>
            <div className="text-right">
              <p className="text-xs text-text-secondary uppercase font-semibold">위반 항목 수</p>
              <p className="text-3xl font-bold text-text-primary">{analysis.findings?.length || 0}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image & OCR */}
        <div className="lg:col-span-5 space-y-6">
          <Card title="광고 이미지" action={<Button variant="ghost" size="sm" onClick={() => setIsImgModalOpen(true)}><Maximize2 size={16}/></Button>}>
            <div className="relative rounded-lg overflow-hidden border border-border bg-gray-100">
              <img
                ref={imageRef}
                src={analysis.imageUrl}
                alt="Ad Analysis"
                className="w-full h-auto object-contain max-h-[500px]"
                onLoad={() => {
                  if (!imageRef.current) return;
                  setImageMeta({
                    naturalWidth: imageRef.current.naturalWidth,
                    naturalHeight: imageRef.current.naturalHeight
                  });
                }}
              />
              {analysis.hasOcrBoxes && selectedPhrase && matchedBoxes.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {matchedBoxes.map(({ box, idx }) => {
                    const normalized = normalizeBox(box);
                    if (!normalized) return null;
                    return (
                      <div
                        key={`${box.text}-${idx}`}
                        className={`absolute border-2 ${boxColor(box.riskLevel)} rounded-sm`}
                        style={{
                          left: `${normalized.left}%`,
                          top: `${normalized.top}%`,
                          width: `${normalized.width}%`,
                          height: `${normalized.height}%`
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
            {analysis.hasOcrBoxes ? (
              <p className="text-xs text-text-secondary mt-2">위험 문구를 클릭하면 이미지 내 해당 영역이 표시됩니다.</p>
            ) : (
              <p className="text-xs text-text-secondary mt-2">OCR 박스 정보가 없습니다.</p>
            )}
          </Card>

          <Card title="OCR 추출 텍스트">
            <div className="max-h-60 overflow-y-auto p-3 bg-gray-50 rounded text-sm text-text-secondary font-mono leading-relaxed border border-border">
              {renderHighlightedOcr()}
            </div>
          </Card>
        </div>

        {/* Right Column: Findings & Rationale */}
        <div className="lg:col-span-7 space-y-6">
          <Card title="위험 요소 발견">
            {findings.length > 0 ? (
              <Table>
                <thead className="bg-gray-50 text-text-secondary font-medium">
                  <tr>
                    <th className="px-4 py-3">의심 문구</th>
                    <th className="px-4 py-3">위반 유형</th>
                    <th className="px-4 py-3">위험도</th>
                    <th className="px-4 py-3">참조</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {findings.map((finding, idx) => (
                    <tr
                      key={`${finding.text}-${idx}`}
                      className={`cursor-pointer hover:bg-gray-50/70 ${selectedFindingIdx === idx ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedFindingIdx(idx)}
                    >
                      <td className="px-4 py-3 text-text-primary font-medium">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} className={finding.riskLevel === 'high' ? 'text-risk-high' : 'text-risk-medium'} />
                          <span>"{finding.text}"</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{finding.violationType}</td>
                      <td className="px-4 py-3">
                        <Badge variant={finding.riskLevel} label={getRiskLabel(finding.riskLevel)} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {finding.referenceId ? (
                          <a className="text-primary hover:underline" href="#legalBasis">
                            {finding.referenceId}
                          </a>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="text-center py-8 text-text-secondary">
                <CheckCircle className="mx-auto w-10 h-10 text-risk-low mb-2 opacity-50" />
                <p>위험 요소가 발견되지 않았습니다.</p>
              </div>
            )}
          </Card>

          <Card title="AI 법적 근거 / 분석 사유" className="relative" >
            <div id="legalBasis" />
            {analysis.analysisSource === 'ocr' && (
              <Alert
                tone="warning"
                message={`AI 판단에 실패하여 OCR/키워드 기반으로 분석했습니다.${analysis.aiError ? ` 오류: ${analysis.aiError}` : ''}`}
                className="mb-3"
              />
            )}
            {analysis.analysisSource === 'ai' && (
              <Alert
                tone="info"
                message="AI가 이미지와 법령 기준을 기반으로 분석했습니다."
                className="mb-3"
              />
            )}
            <Alert
              tone="info"
              message="AI 분석 결과는 참고용이며, 최종 결정은 공식 심의 기준을 따릅니다."
              className="mb-4"
            />

            <div className="prose prose-sm max-w-none text-text-primary">
              <p className="leading-relaxed whitespace-pre-line">{analysis.aiRationale}</p>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-text-primary mb-2">참조 조항</h4>
              {references.length > 0 ? (
                <ul className="space-y-2 text-sm text-text-secondary">
                  {references.map((ref) => (
                    <li key={ref.id} className="p-3 rounded-md border border-border bg-gray-50">
                      <div className="font-semibold text-text-primary">{ref.id} · {ref.title}</div>
                      <div className="text-xs text-text-secondary">{ref.clause}</div>
                      <p className="mt-2 text-xs leading-relaxed">{ref.excerpt}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">참조 조항이 없습니다.</p>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-2 justify-end">
               <Button variant="secondary" className="gap-2 text-xs" onClick={handleCopyBasis}>
                 <Copy size={14} /> 복사
               </Button>
               <Button variant="secondary" className="gap-2 text-xs" onClick={handleDownloadBasis}>
                 <Download size={14} /> 보고서 다운로드
               </Button>
            </div>
          </Card>
        </div>
      </div>

      <Card title="리뷰어 피드백">
        <div className="space-y-4">
          <RadioGroup
            name="feedbackFit"
            label="AI 적합성 평가"
            value={feedbackFit}
            onChange={(value) => setFeedbackFit(value as 'fit' | 'partial' | 'notfit')}
            options={[
              { value: 'fit', label: '적절' },
              { value: 'partial', label: '부분 부적절' },
              { value: 'notfit', label: '부적절' }
            ]}
            required
          />
          <Textarea
            label="코멘트"
            placeholder="리뷰 내용을 입력하세요..."
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={handleSaveFeedback} className="gap-2">
              저장
            </Button>
            <Button variant="secondary" onClick={handleClearFeedback}>
              초기화
            </Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={isImgModalOpen} onClose={() => setIsImgModalOpen(false)} title="원본 이미지">
         <img src={analysis.imageUrl} alt="Full Resolution" className="w-full h-auto" />
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
