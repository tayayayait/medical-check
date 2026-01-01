import fs from 'fs';
import vision from '@google-cloud/vision';

let client;

const getClient = () => {
  if (!client) {
    client = new vision.ImageAnnotatorClient();
  }
  return client;
};

const getApiKey = () =>
  process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_API_KEY || '';

const hasServiceAccount = () => {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return !!credPath && fs.existsSync(credPath);
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

const detectTextWithRest = async (base64Image, imageContext) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    const hint = process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? `GOOGLE_APPLICATION_CREDENTIALS 경로를 확인하세요: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`
      : 'GOOGLE_APPLICATION_CREDENTIALS 또는 GOOGLE_VISION_API_KEY가 필요합니다.';
    throw new Error(hint);
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
      requests: [
        request
      ]
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Vision API error (${response.status}): ${message || '요청 실패'}`);
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

const riskScore = (riskLevel) => {
  if (riskLevel === 'high') return 3;
  if (riskLevel === 'medium') return 2;
  if (riskLevel === 'low') return 1;
  return 0;
};

const normalizeForMatch = (value) => value.toLowerCase().replace(/[\s\u200b]+/g, '');

const pickVertices = (boundingBox) =>
  boundingBox?.vertices?.length ? boundingBox.vertices : boundingBox?.normalizedVertices || [];

const computeBoxRisk = (text, forbiddenList) => {
  let boxRisk = 'none';
  if (!text) return boxRisk;
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeForMatch(text);
  for (const phrase of forbiddenList) {
    if (!phrase.phrase) continue;
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

const buildFindings = (text, forbiddenList) => {
  const findings = [];
  const lowerText = text.toLowerCase();
  const normalizedText = normalizeForMatch(text);
  const seen = new Set();
  forbiddenList.forEach((phrase) => {
    const keyword = phrase.phrase?.trim();
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
        violationType: phrase.violationType || '금지 표현 포함',
        riskLevel: phrase.riskLevel,
        referenceId: phrase.referenceId || undefined
      });
    }
  });
  return findings;
};

const summarizeRisk = (findings) => {
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

export const analyzeImageWithVision = async (base64Image, forbiddenList) => {
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
  const imageContext = buildImageContext();
  const requestPayload = { image: { content: cleanBase64 }, ...(imageContext ? { imageContext } : {}) };
  const result = hasServiceAccount()
    ? (await getClient().documentTextDetection(requestPayload))[0]
    : await detectTextWithRest(cleanBase64, imageContext);

  const textAnnotations = result.textAnnotations || [];
  const ocrFullText = result.fullTextAnnotation?.text
    || (textAnnotations.length > 0 ? textAnnotations[0].description : '');

  const findings = buildFindings(ocrFullText, forbiddenList);
  const { overallRisk, passScore } = summarizeRisk(findings);

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
    ocrBoxes = textAnnotations.slice(1).map((annotation) => {
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
    }).filter((box) => box.w > 0 && box.h > 0 && box.text);
  }

  return {
    passScore,
    riskLevel: overallRisk,
    ocrFullText,
    findings,
    ocrBoxes
  };
};
