import * as XLSX from "xlsx";

function fmtDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export function exportConfigToExcel(config) {
  const wb = XLSX.utils.book_new();

  /* ── Sheet 1: SOP提取字段 ── */
  const sopData = config.sopFields.map((f, i) => ({
    序号: i + 1,
    字段标识: f.key,
    字段名称: f.label,
    约束说明: f.description || "",
  }));
  const ws1 = XLSX.utils.json_to_sheet(sopData);
  ws1["!cols"] = [{ wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, "SOP提取字段");

  /* ── Sheet 2: PFMEA列配置 ── */
  const colData = config.pfmeaColumns.map((c, i) => ({
    序号: i + 1,
    字段标识: c.key,
    字段名称: c.label,
    类型: c.type || "text",
    自动计算: c.autoCalc ? "是" : "否",
    约束说明: c.description || "",
  }));
  const ws2 = XLSX.utils.json_to_sheet(colData);
  ws2["!cols"] = [{ wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, "PFMEA列配置");

  /* ── Sheet 3: 评分准则 ── */
  const sevData = config.severityRules.map((r) => ({
    类型: "S严重度",
    等级: r.level,
    标题: r.label,
    关键词: r.keywords.join("、"),
    描述: r.desc,
  }));
  const occData = config.occurrenceRules.map((r) => ({
    类型: "O频度数",
    等级: r.level,
    标题: r.label,
    关键词: r.keywords.join("、"),
    描述: r.desc,
    DPMO: r.dpmo,
    CPK: r.cpk,
  }));
  const detData = config.detectionRules.map((r) => ({
    类型: "D探测度",
    等级: r.level,
    标题: r.label,
    关键词: r.keywords.join("、"),
    描述: r.desc,
  }));
  const ruleData = [...sevData, ...occData, ...detData];
  const ws3 = XLSX.utils.json_to_sheet(ruleData);
  ws3["!cols"] = [{ wch: 12 }, { wch: 6 }, { wch: 14 }, { wch: 36 }, { wch: 44 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, "评分准则");

  /* ── Sheet 4: API配置 ── */
  const apiData = [
    { 配置项: "供应商", 值: config.apiConfig.provider },
    { 配置项: "接口地址", 值: config.apiConfig.endpoint },
    { 配置项: "模型", 值: config.apiConfig.model },
    { 配置项: "API密钥", 值: config.apiConfig.apiKey },
  ];
  const ws4 = XLSX.utils.json_to_sheet(apiData);
  ws4["!cols"] = [{ wch: 12 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws4, "API配置");

  /* ── Sheet 5: Prompt配置 ── */
  const promptData = [
    { 配置项: "SOP提取Prompt", 内容: config.sopExtPrompt || "" },
    { 配置项: "PFMEA生成Prompt", 内容: config.pfmeaGenPrompt || "" },
  ];
  const ws5 = XLSX.utils.json_to_sheet(promptData);
  ws5["!cols"] = [{ wch: 20 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws5, "Prompt配置");

  /* ── 下载 ── */
  XLSX.writeFile(wb, `PFMEA配置_${fmtDate()}.xlsx`);
}

export function importConfigFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array", cellDates: false });
        const getRows = (sheetName) => {
          const sheet = wb.Sheets[sheetName];
          if (!sheet) return [];
          return XLSX.utils.sheet_to_json(sheet, { defval: "" });
        };

        const config = {};

        /* SOP提取字段 */
        const sopRows = getRows("SOP提取字段");
        config.sopFields = sopRows.map((r) => ({
          key: String(r["字段标识"] || ""),
          label: String(r["字段名称"] || ""),
          description: String(r["约束说明"] || ""),
        }));

        /* PFMEA列配置 */
        const colRows = getRows("PFMEA列配置");
        config.pfmeaColumns = colRows.map((r) => ({
          key: String(r["字段标识"] || ""),
          label: String(r["字段名称"] || ""),
          type: String(r["类型"] || "text"),
          autoCalc: String(r["自动计算"] || "").includes("是"),
          description: String(r["约束说明"] || ""),
        }));

        /* 评分准则 */
        const ruleRows = getRows("评分准则");
        const byType = {};
        for (const [key, typeLabel] of Object.entries({
          severityRules: "S严重度",
          occurrenceRules: "O频度数",
          detectionRules: "D探测度",
        })) {
          const filtered = ruleRows.filter((r) => String(r["类型"] || "").trim() === typeLabel);
          byType[key] = filtered.map((r) => {
            const obj = {
              level: Number(r["等级"]) || 1,
              label: String(r["标题"] || ""),
              keywords: String(r["关键词"] || "").split(/[、,，]/).filter(Boolean),
              desc: String(r["描述"] || ""),
            };
            if (typeLabel === "O频度数") {
              obj.dpmo = Number(r["DPMO"]) || 0;
              obj.cpk = String(r["CPK"] || "");
            }
            return obj;
          });
        }
        config.severityRules = byType.severityRules;
        config.occurrenceRules = byType.occurrenceRules;
        config.detectionRules = byType.detectionRules;

        /* API配置 */
        const apiRows = getRows("API配置");
        const apiCfg = {};
        for (const r of apiRows) {
          const key = String(r["配置项"] || "");
          const val = String(r["值"] || "");
          if (key.includes("供应商")) apiCfg.provider = val;
          else if (key.includes("接口")) apiCfg.endpoint = val;
          else if (key.includes("模型")) apiCfg.model = val;
          else if (key.includes("密钥")) apiCfg.apiKey = val;
        }
        config.apiConfig = apiCfg;

        /* Prompt配置 */
        const promptRows = getRows("Prompt配置");
        for (const r of promptRows) {
          const key = String(r["配置项"] || "");
          const val = String(r["内容"] || "");
          if (key.includes("SOP")) config.sopExtPrompt = val;
          else if (key.includes("PFMEA")) config.pfmeaGenPrompt = val;
        }

        resolve(config);
      } catch (err) {
        reject(new Error("配置文件格式错误：" + err.message));
      }
    };
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsArrayBuffer(file);
  });
}
