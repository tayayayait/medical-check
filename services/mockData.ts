import { AnalysisResult, Metrics, Reference } from '../types';

export const MOCK_REFERENCES: Reference[] = [
  { id: "REF-001", title: "의료법 제56조", clause: "거짓·과장 광고 금지", excerpt: "의료인등은 거짓된 내용을 표시하거나 과장된 내용을 포함한 광고를 해서는 안 된다." },
  { id: "REF-002", title: "심의 기준 2.1", clause: "전후 비교 사진", excerpt: "전후 비교 사진은 동일한 조건 하에 촬영되어야 하며 조작이 없어야 한다." },
  { id: "REF-003", title: "광고 규정 제4조", clause: "최상급 표현", excerpt: "'최고', '최상', '제일' 등의 절대적 표현은 객관적 근거 없이 사용할 수 없다." }
];

export const MOCK_HISTORY: AnalysisResult[] = [
  {
    id: "AN-2023-001",
    adName: "피부과 프로모션 A안",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    passScore: 45,
    riskLevel: 'high',
    status: 'done',
    imageUrl: "https://picsum.photos/400/600",
    ocrFullText: "세계 최고의 피부 시술! 여드름 100% 완치 보장.",
    hasOcrBoxes: false,
    aiRationale: "이 광고는 객관적 근거 없이 '최고'라는 최상급 표현을 사용하였으며, 치료 효과를 보장하는 '100% 완치'라는 문구를 사용하여 의료법을 위반할 소지가 높습니다.",
    findings: [
      { text: "세계 최고의 피부 시술", violationType: "최상급 표현 사용", riskLevel: "medium", referenceId: "REF-003" },
      { text: "100% 완치 보장", violationType: "치료 효과 보장 금지 위반", riskLevel: "high", referenceId: "REF-001" }
    ],
    references: [MOCK_REFERENCES[0], MOCK_REFERENCES[2]]
  },
  {
    id: "AN-2023-002",
    adName: "임플란트 할인 이벤트",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    passScore: 85,
    riskLevel: 'low',
    status: 'done',
    imageUrl: "https://picsum.photos/400/400",
    aiRationale: "전반적으로 광고 심의 규정을 준수하고 있습니다. 가격 표기가 명확하며 허위 사실이 포함되지 않았습니다.",
    findings: [],
    references: []
  },
  {
    id: "AN-2023-003",
    adName: "다이어트 보조제",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    passScore: 60,
    riskLevel: 'medium',
    status: 'done',
    imageUrl: "https://picsum.photos/300/500",
    aiRationale: "체중 감량 속도에 대해 다소 과장된 표현이 포함되어 있습니다.",
    findings: [
      { text: "1주일에 10kg 감량", violationType: "과장 광고 소지", riskLevel: "medium", referenceId: "REF-001" }
    ],
    references: [MOCK_REFERENCES[0]]
  }
];

export const MOCK_METRICS: Metrics = {
  totalAnalyses: 128,
  highRiskCount: 14,
  mediumRiskCount: 32,
  lowRiskCount: 82,
  riskDistribution: [
    { name: '고위험', value: 14, color: '#E53935' },
    { name: '중위험', value: 32, color: '#FB8C00' },
    { name: '저위험', value: 82, color: '#43A047' },
  ]
};