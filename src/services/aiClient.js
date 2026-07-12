import { API_TIMEOUT_MS, API_CONCURRENCY } from '../config/constants';
import { buildSopExtractionPrompt, buildPfmeaGenerationPrompt, buildRegeneratePfmeaPrompt } from '../prompts/promptTemplates';

export async function callAiApi(messages, config, signal) {
  const { endpoint, apiKey, model } = config;

  if (!apiKey) {
    throw new Error('API密钥未配置，请在配置中心设置API Key');
  }

  const url = endpoint.replace(/\/+$/, '') + '/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('API密钥未配置，请在配置中心设置API Key');
    }
    if (response.status === 429) {
      throw new Error('API请求频率过高(429)，请稍后重试');
    }
    throw new Error(`AI服务错误({response.status})：${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI返回数据为空，请重试');
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error('AI返回的数据格式异常，已跳过该行。可点击该行的【AI重提】按钮重新生成');
  }
}

export async function extractSopWithAi(text, apiConfig, sopFields, onProgress, signal) {
  const chunks = splitIntoChunks(text);
  const allResults = [];
  let completedChunks = 0;

  const queue = [];
  for (let i = 0; i < chunks.length; i++) {
    queue.push({ index: i, chunk: chunks[i] });
  }

  const running = [];
  for (let i = 0; i < Math.min(API_CONCURRENCY, queue.length); i++) {
    running.push(processChunk(queue.shift()));
  }
  await Promise.all(running);

  async function processChunk(item) {
    if (signal?.aborted) return;

    const { index, chunk } = item;
    const prompt = buildSopExtractionPrompt(sopFields, chunk, apiConfig.sopExtPrompt || '');

    try {
      const result = await callWithRetry(
        () => callAiApi(
          [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          apiConfig,
          combineSignals(signal, AbortSignal.timeout(API_TIMEOUT_MS))
        ),
        2
      );

      const rows = Array.isArray(result) ? result : [result];
      const labelMap = {};
      for (const f of sopFields) { labelMap[f.key] = f.label; }
      allResults.push(...rows.map(r => ({
        stepNo: String(r.stepNo || r[labelMap.stepNo] || (allResults.length + 1)).trim(),
        stationName: (r.stationName || r[labelMap.stationName] || '').trim(),
        operationDesc: (r.operationDesc || r[labelMap.operationDesc] || '').trim(),
        keyParams: (r.keyParams || r[labelMap.keyParams] || '').trim(),
        materials: (r.materials || r[labelMap.materials] || '').trim(),
        equipment: (r.equipment || r[labelMap.equipment] || '').trim(),
        inspectionMethod: (r.inspectionMethod || r[labelMap.inspectionMethod] || '').trim(),
        specialChar: (r.specialChar || r[labelMap.specialChar] || '').trim(),
      })));
    } catch (err) {
      const failedChunk = {
        _error: true,
        _errorMsg: err.message,
        _chunkIndex: index,
        stepNo: '',
        stationName: '',
        operationDesc: '',
        keyParams: '',
        materials: '',
        equipment: '',
        inspectionMethod: '',
        specialChar: '',
      };
      allResults.push(failedChunk);
    }

    completedChunks++;
    onProgress?.({
      completed: completedChunks,
      total: chunks.length,
      rows: allResults.filter(r => !r._error).length,
    });

    if (queue.length > 0 && !signal?.aborted) {
      await processChunk(queue.shift());
    }
  }

  return allResults;
}

export async function generatePfmeaWithAi(stationData, apiConfig, pfmeaColumns, severityRules, occurrenceRules, detectionRules, count, prerequisiteContext, signal) {
  const prompt = buildPfmeaGenerationPrompt(
    stationData,
    pfmeaColumns,
    severityRules,
    occurrenceRules,
    detectionRules,
    count
  );

  const result = await callWithRetry(
    () => callAiApi(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      apiConfig,
      combineSignals(signal, AbortSignal.timeout(API_TIMEOUT_MS))
    ),
    1
  );

  const rows = Array.isArray(result) ? result : [result];
  return rows.map((r, i) => {
    const row = {};
    for (const col of pfmeaColumns) {
      const val = r[col.key];
      if (col.type === 'number' && !col.autoCalc) {
        row[col.key] = val !== undefined && val !== '' ? Number(val) : 0;
      } else {
        row[col.key] = val !== undefined ? String(val).trim() : '';
      }
    }
    if (!row.severityType) row.severityType = 0;
    if (!row.severity) row.severity = 0;
    if (!row.occurrence) row.occurrence = 0;
    if (!row.detection) row.detection = 0;
    row.so = row.severity * row.occurrence;
    row.rpn = row.severity * row.occurrence * row.detection;
    return row;
  });
}


export async function generatePfmeaDirectFromFile(rawText, apiConfig, pfmeaColumns, severityRules, occurrenceRules, detectionRules, minRows, maxRows, prerequisiteContext, signal) {
  const { buildDirectPfmeaPrompt } = await import('../prompts/promptTemplates.js');
  const prompt = buildDirectPfmeaPrompt(rawText, pfmeaColumns, null, severityRules, occurrenceRules, detectionRules, minRows, maxRows, prerequisiteContext);

  const result = await callWithRetry(
    () => callAiApi(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      apiConfig,
      combineSignals(signal, AbortSignal.timeout(120000))
    ),
    1
  );

  const stations = Array.isArray(result) ? result : [result];
  return stations.map((s, si) => ({
    stepNo: String(s.stepNo || (si + 1)).trim(),
    stationName: (s.stationName || '').trim(),
    operationDesc: (s.operationDesc || '').trim(),
    keyParams: (s.keyParams || '').trim(),
    materials: (s.materials || '').trim(),
    equipment: (s.equipment || '').trim(),
    inspectionMethod: (s.inspectionMethod || "").trim(),
    requirement: (s.requirement || "").trim(),
    specialChar: (s.specialChar || '').trim(),
    rows: (s.rows || []).map(r => {
      const sev = Number(r.severity) || 0;
      const occ = Number(r.occurrence) || 0;
      const det = Number(r.detection) || 0;
      return {
        requirement: String(r.requirement || '').trim(),
        failureMode: String(r.failureMode || '').trim(),
        failureEffect: String(r.failureEffect || '').trim(),
        severity: sev,
        cause: String(r.cause || '').trim(),
        occurrence: occ,
        preventionControl: String(r.preventionControl || '').trim(),
        detectionControl: String(r.detectionControl || '').trim(),
        detection: det,
        so: sev * occ,
        rpn: sev * occ * det,
        recommendedAction: String(r.recommendedAction || '').trim(),
      };
    }),
  }));
}


export async function extractPrerequisiteInfo(text, apiConfig, signal) {
  const result = await callWithRetry(
    () => callAiApi(
      [
        { role: 'system', content: '\u4f60\u662f\u4e00\u4e2aFMEA\u4e13\u5bb6\u3002\u8bf7\u4ece\u4ee5\u4e0b\u8d44\u6599\u4e2d\u63d0\u53d6\u4e0ePFMEA\u76f8\u5173\u7684\u5173\u952e\u4fe1\u606f\u3002\u63d0\u53d6\u8981\u70b9\u8981\u4e13\u4e1a\u3001\u7b80\u6d01\uff0c\u4fbf\u4e8e\u540e\u7eed\u4f5c\u4e3a\u53c2\u8003\u4f9d\u636e\u751f\u6210PFMEA\u3002\n\n\u8bf7\u8fd4\u56deJSON\u683c\u5f0f\uff1a{\"summary\": \"\u63d0\u53d6\u7684\u5173\u952e\u4fe1\u606f\u6c47\u603b\"}' },
        { role: 'user', content: '\u8bf7\u63d0\u53d6\u4ee5\u4e0b\u8d44\u6599\u4e2d\u7684\u5173\u952ePFMEA\u53c2\u8003\u4fe1\u606f\uff1a\n\n' + text }
      ],
      apiConfig,
      combineSignals(signal, AbortSignal.timeout(60000))
    ),
    1
  );
  return result && result.summary ? result.summary : (typeof result === 'string' ? result : JSON.stringify(result, null, 2));
}
export async function regeneratePfmeaRow(rowData, apiConfig, pfmeaColumns, severityRules, occurrenceRules, detectionRules, signal) {
  const fieldKeys = pfmeaColumns.filter(c => !c.autoCalc).map(c => c.key);
  const prompt = buildRegeneratePfmeaPrompt(rowData, fieldKeys, severityRules, occurrenceRules, detectionRules);

  const result = await callWithRetry(
    () => callAiApi(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      apiConfig,
      combineSignals(signal, AbortSignal.timeout(API_TIMEOUT_MS))
    ),
    1
  );

  const r = Array.isArray(result) ? result[0] : result;
  const row = {};
  for (const col of pfmeaColumns) {
    const val = r[col.key];
    if (col.type === 'number' && !col.autoCalc) {
      row[col.key] = val !== undefined && val !== '' ? Number(val) : 0;
    } else {
      row[col.key] = val !== undefined ? String(val).trim() : '';
    }
  }
  if (!row.severity) row.severity = 0;
  if (!row.occurrence) row.occurrence = 0;
  if (!row.detection) row.detection = 0;
  row.so = row.severity * row.occurrence;
  row.rpn = row.severity * row.occurrence * row.detection;
  return row;
}

async function callWithRetry(fn, maxRetries) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isRetryable(err)) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function isRetryable(err) {
  const msg = err.message || '';
  return msg.includes('重试') || msg.includes('timeout') || msg.includes('限流')
    || msg.includes('503') || msg.includes('502') || msg.includes('500');
}

function combineSignals(...signals) {
  const clean = signals.filter(Boolean);
  if (clean.length <= 1) return clean[0] || null;
  const ctrl = new AbortController();
  for (const s of clean) {
    if (s.aborted) { ctrl.abort(); return ctrl.signal; }
    s.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return ctrl.signal;
}

function splitIntoChunks(text) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks = [];
  let current = [];

  for (const para of paragraphs) {
    const paraLen = para.length;
    const currentLen = current.join('\n').length;
    if (currentLen + paraLen > 3000 && current.length > 0) {
      chunks.push(current.join('\n\n'));
      current = [para];
    } else {
      current.push(para);
    }
  }
  if (current.length > 0) chunks.push(current.join('\n\n'));
  return chunks.length > 0 ? chunks : [text];
}



