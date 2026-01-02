import crypto from 'crypto';
import { analyzeAdWithOpenAI, generateRationaleWithOpenAI } from '../server/openai.js';
import { DEFAULT_FORBIDDEN_PHRASES, LEGAL_REFERENCE_MAP } from '../server/legalReferences.js';

const MAX_IMAGE_BYTES = Number(process.env.DEMO_MAX_IMAGE_BYTES || 2 * 1024 * 1024);

const json = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const readJsonBody = async (req) => {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const extractBase64 = (value) => {
  if (!value) return '';
  const match = /^data:(.+);base64,(.*)$/.exec(value);
  return match ? match[2] : value;
};

const estimateBytes = (base64Data) => Math.floor((base64Data.length * 3) / 4);

const riskScore = (riskLevel) => {
  if (riskLevel === 'high') return 3;
  if (riskLevel === 'medium') return 2;
  if (riskLevel === 'low') return 1;
  return 0;
};

const summarizeRisk = (findings) => {
  const counts = findings.reduce(
    (acc, item) => {
      const level = item?.riskLevel;
      if (level === 'high' || level === 'medium' || level === 'low') {
        acc[level] += 1;
      }
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );

  const overallRisk = counts.high > 0 ? 'high' : counts.medium > 0 ? 'medium' : 'low';
  const penalty = counts.high * 30 + counts.medium * 15 + counts.low * 5;
  const passScore = Math.max(0, Math.min(100, 100 - penalty));
  return { overallRisk, passScore };
};

const normalizeForMatch = (value) => value.toLowerCase().replace(/[\s\u200b]+/g, '');

const buildFindingsFromOcr = (text, forbiddenList) => {
  const findings = [];
  if (!text) return findings;
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeForMatch(text);
  const seen = new Set();

  forbiddenList.forEach((phrase) => {
    const keyword = phrase?.phrase?.trim();
    if (!keyword) return;
    const keywordLower = keyword.toLowerCase();
    const normalizedKeyword = normalizeForMatch(keyword);
    if (
      (lowerText.includes(keywordLower) || normalizedText.includes(normalizedKeyword))
      && !seen.has(keyword)
    ) {
      seen.add(keyword);
      findings.push({
        text: keyword,
        violationType: phrase.violationType || 'Forbidden phrase detected',
        riskLevel: phrase.riskLevel || 'low',
        referenceId: phrase.referenceId || undefined
      });
    }
  });

  return findings;
};

const getLanguageHints = () => {
  const rawHints = process.env.OCR_LANGUAGE_HINTS || process.env.GOOGLE_VISION_LANGUAGE_HINTS || 'ko';
  return rawHints
    .split(',')
    .map((hint) => hint.trim())
    .filter(Boolean);
};

const buildImageContext = () => {
  const languageHints = getLanguageHints();
  return languageHints.length > 0 ? { languageHints } : undefined;
};

const getApiKey = () => process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_API_KEY || '';

const detectTextWithRest = async (base64Image, imageContext) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GOOGLE_VISION_API_KEY is not configured.');
  }

  const request = {
    image: { content: base64Image },
    features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
  };
  if (imageContext) {
    request.imageContext = imageContext;
  }

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [request]
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Vision API error (${response.status}): ${message || 'request failed'}`);
  }

  const data = await response.json();
  return data.responses?.[0] || {};
};

const normalizeVertices = (vertices) => {
  if (!vertices || vertices.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  const xs = vertices.map((v) => v.x ?? 0);
  const ys = vertices.map((v) => v.y ?? 0);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY)
  };
};

const pickVertices = (boundingBox) =>
  boundingBox?.vertices?.length ? boundingBox.vertices : boundingBox?.normalizedVertices || [];

const computeBoxRisk = (text, forbiddenList) => {
  let boxRisk = 'none';
  if (!text) return boxRisk;
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeForMatch(text);
  for (const phrase of forbiddenList) {
    if (!phrase?.phrase) continue;
    const phraseLower = phrase.phrase.toLowerCase();
    const normalizedPhrase = normalizeForMatch(phrase.phrase);
    if (lowerText.includes(phraseLower) || normalizedText.includes(normalizedPhrase)) {
      if (riskScore(phrase.riskLevel) > riskScore(boxRisk)) {
        boxRisk = phrase.riskLevel;
      }
    }
  }
  return boxRisk;
};

const buildOcrBoxes = (result, forbiddenList) => {
  const textAnnotations = result.textAnnotations || [];

  let ocrBoxes = [];
  if (result.fullTextAnnotation?.pages?.length) {
    result.fullTextAnnotation.pages.forEach((page) => {
      page.blocks?.forEach((block) => {
        block.paragraphs?.forEach((paragraph) => {
          paragraph.words?.forEach((word) => {
            const text = word.symbols?.map((symbol) => symbol.text).join('') || '';
            const vertices = pickVertices(word.boundingBox);
            if (!text || vertices.length === 0) return;
            const box = normalizeVertices(vertices);
            if (box.w <= 0 || box.h <= 0) return;
            ocrBoxes.push({
              x: box.x,
              y: box.y,
              w: box.w,
              h: box.h,
              text,
              riskLevel: computeBoxRisk(text, forbiddenList)
            });
          });
        });
      });
    });
  } else if (textAnnotations.length > 1) {
    ocrBoxes = textAnnotations
      .slice(1)
      .map((annotation) => {
        const description = annotation.description || '';
        const vertices = pickVertices(annotation.boundingPoly);
        const box = normalizeVertices(vertices);
        return {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          text: description,
          riskLevel: computeBoxRisk(description, forbiddenList)
        };
      })
      .filter((box) => box.w > 0 && box.h > 0 && box.text);
  }

  return ocrBoxes;
};

const analyzeImageWithVision = async (base64Image, forbiddenList) => {
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
  const imageContext = buildImageContext();

  const result = await detectTextWithRest(cleanBase64, imageContext);

  const textAnnotations = result.textAnnotations || [];
  const ocrFullText = result.fullTextAnnotation?.text
    || (textAnnotations.length > 0 ? textAnnotations[0].description : '');

  const findings = buildFindingsFromOcr(ocrFullText, forbiddenList);
  const { overallRisk, passScore } = summarizeRisk(findings);
  const ocrBoxes = buildOcrBoxes(result, forbiddenList);

  return {
    passScore,
    riskLevel: overallRisk,
    ocrFullText,
    findings,
    ocrBoxes
  };
};

const buildReferences = (findings) => {
  const references = new Map();
  findings.forEach((finding) => {
    const refId = finding?.referenceId;
    if (!refId) return;
    const ref = LEGAL_REFERENCE_MAP[refId];
    if (ref) {
      references.set(ref.id, ref);
    } else {
      references.set(refId, {
        id: refId,
        title: 'Legal reference',
        clause: 'Reference summary',
        excerpt: 'No summary is available for this reference.'
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
    return 'No risky phrases were detected in the OCR text.';
  }
  const lines = findings.map((finding) => {
    const refLabel = finding.referenceId ? ` (${finding.referenceId})` : '';
    return `- "${finding.text}": ${finding.violationType}${refLabel}`;
  });
  return `Detected ${findings.length} potentially risky phrases.\n${lines.join('\n')}`;
};

const buildLegalNotes = () => (
  'This is a reference-only result based on medical advertising guidelines. '
  + 'Final legal decisions should be made through official review.'
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const body = await readJsonBody(req);
  const { adName, base64Image } = body ?? {};

  if (!adName || !base64Image) {
    return json(res, 400, { error: 'adName and base64Image are required.' });
  }

  const base64Data = extractBase64(base64Image);
  if (!base64Data) {
    return json(res, 400, { error: 'Invalid base64Image.' });
  }

  const estimatedBytes = estimateBytes(base64Data);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    return json(res, 413, {
      error: `Image is too large. Max ${MAX_IMAGE_BYTES} bytes allowed for demo mode.`
    });
  }

  try {
    const forbiddenList = DEFAULT_FORBIDDEN_PHRASES;
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
      aiError = error instanceof Error ? error.message : 'AI analysis failed.';
      console.error(`[AI] analyze failed (${adName}):`, aiError);
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
      } catch {
        rationale = legalSummary;
      }
    } else if (!rationale.includes('Legal summary')) {
      rationale = `${rationale}\n\nLegal summary:\n${legalSummary}`;
    }

    const result = {
      id: `AN-${Date.now()}`,
      adName,
      createdAt: new Date().toISOString(),
      passScore,
      riskLevel,
      analysisSource,
      aiError,
      status: 'done',
      ocrFullText: visionResult.ocrFullText,
      hasOcrBoxes: (visionResult.ocrBoxes ?? []).length > 0,
      ocrBoxes: visionResult.ocrBoxes,
      findings,
      aiRationale: rationale,
      references
    };

    return json(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed.';
    return json(res, 500, { error: message, requestId: crypto.randomUUID() });
  }
}
