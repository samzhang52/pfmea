export function buildSopExtractionPrompt(sopFields, chunkText, customPrompt) {
  const fieldDescriptions = sopFields.map((f, i) => {
      let line = `  ${i + 1}. "${f.label}"`;
      if (f.description) line += " --- " + f.description;
      return line;
    }).join("\n");

  return {
    system: `你是一个有20年经验的FMEA专家。请从文件中提取工站信息。\n严格返回JSON数组，字段如下：\n${fieldDescriptions}\n\n要求：\n- 只返回JSON数组\n- 使用双引号\n- 缺失字段返回空\n- 每条记录对应一个工站\n- 无步骤号则自动编号`,
    user: `请从以下文件中提取工站信息，返回JSON数组：\n\n${chunkText}`
  };
}
export function buildPfmeaGenerationPrompt(stationInfo, pfmeaColumns, severityRules, occurrenceRules, detectionRules, count, customPrompt, prerequisiteContext) {
  const sRules = severityRules.map(r => `${r.level}: ${r.label} - ${r.desc} (keywords: ${r.keywords.join(", ")})`).join("\n");
  const oRules = occurrenceRules.map(r => `${r.level}: ${r.label} - ${r.desc} (DPMO>=${r.dpmo}, Cpk${r.cpk}, keywords: ${r.keywords.join(", ")})`).join("\n");
  const dRules = detectionRules.map(r => `${r.level}: ${r.label} (keywords: ${r.keywords.join(", ")})`).join("\n");
  const columnDesc = pfmeaColumns.filter(c => !c.autoCalc).map(c => { let line = '    "' + c.key + '": ' + c.label; if (c.description) line += " --- " + c.description; return line; }).join("\n");
  const rpnCol = pfmeaColumns.find(c => c.key === "rpn" || c.key === "RPN");
  let constraints = "";
  if (rpnCol && rpnCol.description) {
    const nums = rpnCol.description.match(/\d+/g);
    if (nums) {
      const maxRpn = Math.min(...nums.map(Number));
      if (maxRpn > 0 && maxRpn < 1000) { constraints = "RPN constraint: max " + maxRpn; }
    }
  }
  return {
    system: "你是一个汽车行业FMEA专家。根据工站信息生成PFMEA。\n评分标准：\n\n[S 严重度]\n" + sRules + "\n\n[O 频度]\n" + oRules + "\n\n[D 探测度]\n" + dRules + "\n\n返回格式：\n- Return JSON array only\n- Use double quotes\n- Generate " + count + " 条PFMEA记录\n- severity/occurrence/detection为数字\n- 必须有recommendedAction字段\n- RPN = S x O x D 不可超过上限" + (constraints ? "\n" + constraints : ""),
    user: "为以下工站生成PFMEA：\n" + Object.entries(stationInfo).map(([k, v]) => k + ": " + v).join("\n") + "\n\n列描述：\n" + columnDesc
  };
}export function buildRegeneratePfmeaPrompt(rowData, fieldKeys, severityRules, occurrenceRules, detectionRules) {
  const sRules = severityRules.map(r => `${r.level}: ${r.label} (keywords: ${r.keywords.join(", ")})`).join("\n");
  const oRules = occurrenceRules.map(r => `${r.level}: ${r.label} (keywords: ${r.keywords.join(", ")})`).join("\n");
  const dRules = detectionRules.map(r => `${r.level}: ${r.label} (keywords: ${r.keywords.join(", ")})`).join("\n");
  return {
    system: "重新生成这条PFMEA记录。 评分标准：\n\n[S 严重度]\n" + sRules + "\n\n[O 频度]\n" + oRules + "\n\n[D 探测度]\n" + dRules + "\n\n返回JSON对象（不是数组），字段： " + fieldKeys.join(", "),
    user: "基于以下信息重新生成PFMEA记录：\n" + JSON.stringify(rowData, null, 2)
  };
}export function buildDirectPfmeaPrompt(rawText, pfmeaColumns, columnConstraints, severityRules, occurrenceRules, detectionRules, minRows, maxRows, prerequisiteContext) {
  var sRules = severityRules.map(function(r){return r.level + ": " + r.label + " - " + r.desc + " (keywords: " + r.keywords.join(", ") + ")";}).join("\n");
  var oRules = occurrenceRules.map(function(r){return r.level + ": " + r.label + " - " + r.desc + " (DPMO>=" + r.dpmo + ", Cpk" + r.cpk + ", keywords: " + r.keywords.join(", ") + ")";}).join("\n");
  var dRules = detectionRules.map(function(r){return r.level + ": " + r.label + " (keywords: " + r.keywords.join(", ") + ")";}).join("\n");
  var colDesc = "";
  pfmeaColumns.filter(function(c){return !c.autoCalc;}).forEach(function(c){
    colDesc += '  "' + c.key + '": ' + c.label;
    if (c.description) colDesc += " --- " + c.description;
    colDesc += "\n";
  });
  var rpnMax = 0;
  for (var ci2 = 0; ci2 < pfmeaColumns.length; ci2++) {
    var col = pfmeaColumns[ci2];
    if ((col.key === "rpn" || col.key === "RPN") && col.description) {
      var nums = col.description.match(/\d+/g);
      if (nums) {
        for (var ni = 0; ni < nums.length; ni++) {
          var n = parseInt(nums[ni]);
          if (n > 0 && n < 1000 && (rpnMax === 0 || n < rpnMax)) { rpnMax = n; }
        }
      }
    }
  }
  if (rpnMax > 0) { colDesc += "\nRPN constraint: max " + rpnMax; }
  var sys = "你是一个汽车行业FMEA专家。阅读文件内容，识别所有工站，为每个工站生成PFMEA。\n\n## 任务\n识别工站并生成 " + minRows + "~" + maxRows + " 条PFMEA记录 per station (simple = fewer, complex = more).\n\n## 评分标准\n\n[S 严重度]\n" + sRules + "\n\n[O 频度]\n" + oRules + "\n\n[D 探测度]\n" + dRules + "\n\n## 输出格式\nJSON array, each element: {stepNo, stationName, operationDesc, requirement, keyParams, materials, equipment, inspectionMethod, specialChar, rows: [{failureMode, failureEffect, severity, cause, occurrence, preventionControl, detectionControl, detection, recommendedAction}]}\n\n注意：\n- severity/occurrence/detection为数字（1-10）\n- 字段描述：\n" + colDesc + "\n- RPN = S*O*D 不可超过上限";
  if (prerequisiteContext) { sys += "\n\n## 参考资料\n" + prerequisiteContext + "\n\n使用以上参考资料辅助分析。"; }
  return { system: sys, user: "分析以下文件内容，识别工站并生成PFMEA：\n\n" + rawText };
}