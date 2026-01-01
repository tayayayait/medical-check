import OpenAI from 'openai';
import { LEGAL_GUIDELINES_TEXT, LEGAL_REFERENCE_LIST_TEXT, LEGAL_REFERENCE_MAP } from './legalReferences.js';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';

const ANALYSIS_PROMPT = `
당신은 의료광고 심의 보조 AI입니다. 아래 정보와 이미지만 사용하여 의료법 기준 위반 가능성을 판단하세요.
- 제공된 법령 기준과 근거 ID 목록만 사용하고, 새로운 조항/번호를 만들지 마세요.
- "text"는 가능하면 이미지에 실제로 보이는 문구를 그대로 적으세요.
- 결과는 반드시 JSON 단일 객체로만 출력하세요(설명/코드블록 금지).

출력 스키마:
{
  "passScore": 0-100,
  "riskLevel": "high"|"medium"|"low",
  "findings": [
    {
      "text": "문구",
      "violationType": "위반 유형",
      "riskLevel": "high"|"medium"|"low",
      "referenceId": "ML56-02",
      "rationale": "간단 근거"
    }
  ],
  "rationale": "2~4문장 참고용 요약"
}
`;

const parseJsonOutput = (value) => {
  if (!value) return null;
  const raw = value.trim();
  try {
    return JSON.parse(raw);
  } catch (error) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch (innerError) {
        return null;
      }
    }
    return null;
  }
};

const riskScore = (riskLevel) => {
  if (riskLevel === 'high') return 3;
  if (riskLevel === 'medium') return 2;
  if (riskLevel === 'low') return 1;
  return 0;
};

const normalizeRisk = (value) => {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return undefined;
};

const normalizeFindings = (findings = []) => {
  if (!Array.isArray(findings)) return [];
  return findings.map((item) => {
    const referenceId = item?.referenceId;
    const safeReferenceId = referenceId && LEGAL_REFERENCE_MAP[referenceId] ? referenceId : undefined;
    return {
      text: typeof item?.text === 'string' ? item.text.trim() : '',
      violationType: typeof item?.violationType === 'string' && item.violationType.trim() ? item.violationType.trim() : '법령 위반 가능성',
      riskLevel: normalizeRisk(item?.riskLevel) || 'low',
      referenceId: safeReferenceId,
      rationale: typeof item?.rationale === 'string' ? item.rationale.trim() : ''
    };
  }).filter((item) => item.text);
};

const computeRiskFromFindings = (findings) => {
  const counts = findings.reduce(
    (acc, item) => {
      acc[item.riskLevel] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
  const overallRisk = counts.high > 0 ? 'high' : counts.medium > 0 ? 'medium' : counts.low > 0 ? 'low' : 'low';
  const penalty = counts.high * 30 + counts.medium * 15 + counts.low * 5;
  const passScore = Math.max(0, Math.min(100, 100 - penalty));
  return { overallRisk, passScore };
};

export const analyzeAdWithOpenAI = async ({ adName, imageDataUrl, ocrText }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }
  const client = new OpenAI({ apiKey });

  const prompt = [
    ANALYSIS_PROMPT.trim(),
    '',
    `광고명: ${adName}`,
    `OCR 텍스트(참고용): ${ocrText || '없음'}`,
    '',
    '법령 기준 요약:',
    LEGAL_GUIDELINES_TEXT,
    '',
    '허용되는 법령 근거 ID 목록:',
    LEGAL_REFERENCE_LIST_TEXT
  ].join('\n');

  const response = await client.responses.create({
    model: MODEL,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: imageDataUrl }
        ]
      }
    ]
  });

  const outputText = response.output_text?.trim();
  const parsed = parseJsonOutput(outputText);
  if (!parsed) {
    throw new Error('AI 응답에서 JSON을 파싱하지 못했습니다.');
  }

  const findings = normalizeFindings(parsed.findings);
  const derived = computeRiskFromFindings(findings);
  const passScore = Number.isFinite(parsed.passScore) ? Math.max(0, Math.min(100, Math.round(parsed.passScore))) : derived.passScore;
  const riskLevel = normalizeRisk(parsed.riskLevel) || derived.overallRisk;
  const rationale = typeof parsed.rationale === 'string' ? parsed.rationale.trim() : '';

  return {
    passScore,
    riskLevel,
    findings,
    rationale
  };
};

const SUMMARY_PROMPT = `
다음은 의료 광고 OCR 결과와 금지 표현 탐지 결과입니다.
이 정보를 바탕으로 심의 참고용 분석 사유를 한국어로 2~4문장으로 작성하세요.
과장이나 단정적 판단은 피하고, "참고용"임을 명시하세요.
`;

export const generateRationaleWithOpenAI = async ({ adName, ocrText, findings, legalSummary }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: MODEL,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: SUMMARY_PROMPT },
          { type: 'input_text', text: `광고명: ${adName}` },
          { type: 'input_text', text: `OCR 텍스트: ${ocrText || '없음'}` },
          { type: 'input_text', text: `탐지 결과: ${findings.length > 0 ? JSON.stringify(findings) : '없음'}` },
          { type: 'input_text', text: `법령 근거 요약:\n${legalSummary}` }
        ]
      }
    ]
  });

  const text = response.output_text?.trim();
  if (!text) {
    return legalSummary || '분석 사유를 제공받지 못했습니다.';
  }
  const suffix = legalSummary ? `\n\n법령 근거 요약:\n${legalSummary}` : '';
  return `${text}${suffix}`;
};
