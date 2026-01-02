import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Progress } from '../components/UIComponents';
import { Upload, XCircle, FileImage, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { useGlobalData } from '../App';
import { AnalysisStatus } from '../types';

export const NewAnalysis: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [adName, setAdName] = useState('');
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | 'idle'>('idle');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { submitAnalysis } = useGlobalData();
  const navigate = useNavigate();

  const allowedTypes = useMemo(() => ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'], []);
  const maxFileSize = 2 * 1024 * 1024;
  const isAnalyzing = analysisStatus === 'running';


  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const validateFile = (file: File) => {
    if (!allowedTypes.includes(file.type)) {
      return 'PNG, JPG, JPEG, WEBP 파일만 업로드할 수 있습니다.';
    }
    if (file.size > maxFileSize) {
      return '파일 용량은 2MB 이하여야 합니다.';
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validationError = validateFile(file);
      if (validationError) {
        e.target.value = '';
        setSelectedFile(null);
        setPreviewUrl(null);
        setError(validationError);
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysisStatus('idle');
        setAnalysisId(null);
      setError(null);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAdName('');
    setError(null);
    setAnalysisStatus('idle');
    setAnalysisId(null);
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !adName) {
      setError("광고명을 입력하고 이미지를 선택해주세요.");
      return;
    }

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setAnalysisStatus('running');
    setAnalysisId(null);
    setError(null);

    try {
      const base64 = await convertToBase64(selectedFile);
      const result = await submitAnalysis(base64, adName);
      setAnalysisId(result.id);
      setAnalysisStatus('done');
    } catch (err) {
      console.error(err);
      setError("분석에 실패했습니다. 다시 시도하거나 API 키를 확인해주세요.");
      setAnalysisStatus('failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary">새 광고 분석</h2>
      </div>

      <Card className="p-8">
        <div className="space-y-6">
          <Input 
            label="광고명 / 참조 ID" 
            placeholder="예: 여름 프로모션 2024 - 배너 A"
            value={adName}
            onChange={(e) => setAdName(e.target.value)}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">이미지 업로드</label>
            {!previewUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-text-secondary" />
                  <p className="mb-2 text-sm text-text-secondary"><span className="font-semibold">클릭하여 업로드</span> 또는 파일을 드래그하세요</p>
                  <p className="text-xs text-text-secondary">PNG, JPG, WEBP (최대 2MB)</p>
                </div>
                <input type="file" className="hidden" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleFileChange} />
              </label>
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-border bg-black/5">
                <img src={previewUrl} alt="Preview" className="w-full h-64 object-contain" />
                <button 
                  onClick={handleReset}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md text-risk-high hover:bg-gray-100"
                >
                  <XCircle size={24} />
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 bg-risk-high/10 border border-risk-high/20 rounded-md text-risk-high text-sm flex items-center gap-2">
              <XCircle size={16} />
              {error}
            </div>
          )}

          {analysisStatus === 'running' && (
            <Progress
              indeterminate
              label='분석 진행 중...'
            />
          )}

          {analysisStatus === 'done' && analysisId && (
            <div className="p-4 bg-green-50 border border-green-100 rounded-md text-risk-low text-sm flex items-center justify-between">
              <span>분석이 완료되었습니다.</span>
              <button
                type="button"
                onClick={() => navigate(`/analysis/${analysisId}`)}
                className="inline-flex items-center gap-1 text-primary hover:text-primary-dark font-medium"
              >
                결과 보기 <ExternalLink size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 pt-4 border-t border-border">
            <Button 
              className="flex-1" 
              onClick={handleAnalyze} 
              disabled={!selectedFile || !adName || isAnalyzing}
              isLoading={isAnalyzing}
            >
              AI 분석 시작
            </Button>
            <Button variant="secondary" onClick={handleReset} disabled={isAnalyzing}>
              초기화
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg text-primary"><FileImage size={20}/></div>
          <div>
            <h4 className="font-medium text-sm">이미지 분석</h4>
            <p className="text-xs text-text-secondary mt-1">광고 이미지 내 텍스트와 시각 요소를 추출합니다.</p>
          </div>
        </Card>
        <Card className="p-4 flex items-start gap-3">
          <div className="p-2 bg-orange-50 rounded-lg text-risk-medium"><AlertCircle size={20}/></div>
          <div>
            <h4 className="font-medium text-sm">위험 요소 감지</h4>
            <p className="text-xs text-text-secondary mt-1">금지된 표현 및 규정 위반 가능성을 식별합니다.</p>
          </div>
        </Card>
        <Card className="p-4 flex items-start gap-3">
          <div className="p-2 bg-green-50 rounded-lg text-risk-low"><CheckCircle size={20}/></div>
          <div>
            <h4 className="font-medium text-sm">점수 산정</h4>
            <p className="text-xs text-text-secondary mt-1">통과 가능성을 0~100점 점수로 산출합니다.</p>
          </div>
        </Card>
      </div>
    </div>
  );
};
