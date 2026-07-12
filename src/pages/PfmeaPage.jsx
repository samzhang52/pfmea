import { useState, useCallback, useEffect, useRef } from 'react';
import { useTableResize } from '../utils/tableResize';
import { useApp } from '../store/AppContext';
import { generatePfmeaWithAi, regeneratePfmeaRow, generatePfmeaDirectFromFile } from '../services/aiClient';
import { parseFile } from '../utils/fileParser';
import { exportToExcel, exportToCsv } from '../utils/excelExporter';
import { Download, Sparkles, Check, RefreshCw, ChevronLeft, ChevronRight, Trash2, FileDown, Settings2, Upload } from 'lucide-react';
export default function PfmeaPage() {
  const { state, dispatch, setLoading, showToast, showError } = useApp();
  const { pfmeaColumns, severityRules, occurrenceRules, detectionRules } = state.config;
  const { stations, currentStationIndex } = state.pfmea;

const [generating, setGenerating] = useState(false);
  const cancelRef = useRef(null);
  const [rangeMin, setRangeMin] = useState(state.config.apiConfig.defaultMinRows || 3);
  const [rangeMax, setRangeMax] = useState(state.config.apiConfig.defaultMaxRows || 5);
  const directFileRef = useRef(null);
  const { startColResize } = useTableResize();
  const autoGrow = useCallback((el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  useEffect(() => {
    const el = document.querySelector(".pfmea-table");
    if (!el) return;
    const tas = el.querySelectorAll("textarea");
    if (!tas.length) return;
    const fn = () => tas.forEach((t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; });
    fn();
    const ro = new ResizeObserver(fn);
    tas.forEach((t) => ro.observe(t));
    return () => ro.disconnect();
  }, [state.pfmea.stations]);
  const [regeneratingRow, setRegeneratingRow] = useState(null);

  const currentStation = stations[currentStationIndex];
  const allConfirmed = stations.length > 0 && stations.every(s => s.confirmed);
  const hasStations = stations.length > 0;

  const handleGenerateAll = async () => {
    if (!state.config.apiConfig.apiKey) {
      showError('请先在配置中心填写API信息后再使用');
      return;
    }
    if (stations.length === 0) {
      showError('没有工站数据，请先在SOP解析页面确认提取结果');
      return;
    }

    const controller = new AbortController();
    cancelRef.current = controller;
    setGenerating(true);
    try {
      const total = stations.length;
      for (let i = 0; i < stations.length; i++) {
        if (controller.signal.aborted) break;
        const station = stations[i];
        setLoading(true, `正在生成第 ${i+1}/${total} 个工站的PFMEA...`, { completed: i, total }, () => { controller.abort(); setLoading(false); });

        const rows = await generatePfmeaWithAi(
          station.stationData,
          state.config.apiConfig,
          pfmeaColumns,
          severityRules,
          occurrenceRules,
          detectionRules,
          station.n,
          state.sop.prerequisiteSummary,
          controller.signal
        );

        if (controller.signal.aborted) break;
        dispatch({ type: 'SET_STATION_ROWS', stationIndex: i, payload: rows });
      }

      if (!controller.signal.aborted) {
        dispatch({ type: 'SET_CURRENT_STATION', payload: 0 });
        dispatch({ type: 'SET_ALL_GENERATED' });
        showToast('所有工站PFMEA已生成', 'success');
      } else {
        showToast('已取消生成', 'info');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast('已取消生成', 'info');
      } else {
        showError(err.message || '生成失败');
      }
    } finally {
      setGenerating(false);
      setLoading(false);
      cancelRef.current = null;
    }
  };

  const handleGenerateCurrent = async () => {
    if (!state.config.apiConfig.apiKey) {
      showError('请先在配置中心填写API信息后再使用');
      return;
    }

    const station = stations[currentStationIndex];
    if (!station) return;

    setGenerating(true);
    try {
      setLoading(true, `正在生成第 ${currentStationIndex + 1} 个工站的PFMEA...`);

      const rows = await generatePfmeaWithAi(
        station.stationData,
        state.config.apiConfig,
        pfmeaColumns,
        severityRules,
        occurrenceRules,
        detectionRules,
        station.n,
      state.sop.prerequisiteSummary,
    );

      dispatch({ type: 'SET_STATION_ROWS', stationIndex: currentStationIndex, payload: rows });
      showToast(`工站 ${station.stationData.stationName || currentStationIndex + 1} PFMEA已生成`, 'success');
    } catch (err) {
      showError(err.message || '生成失败');
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  };

  const handleConfirmStation = () => {
    const station = stations[currentStationIndex];
    if (!station || station.rows.length === 0) {
      showError('当前工站没有PFMEA数据，请先生成');
      return;
    }
    dispatch({ type: 'CONFIRM_STATION', stationIndex: currentStationIndex });
      // 重置表格布局
      document.querySelectorAll('table tbody tr').forEach(function(el) { el.style.height = ''; el.style.minHeight = ''; });
      document.querySelectorAll('[data-cidx]').forEach(function(el) { el.style.width = ''; el.style.minWidth = ''; el.style.maxWidth = ''; });

    // 自动跳到下个未确认的工站
    const nextUnconfirmed = stations.findIndex((s, i) => i > currentStationIndex && !s.confirmed);
    if (nextUnconfirmed !== -1) {
      dispatch({ type: 'SET_CURRENT_STATION', payload: nextUnconfirmed });
    }

    showToast(`工站「${station.stationData.stationName || currentStationIndex + 1}」已确认`, 'success');
  };

  const handleConfirmAll = () => {
    const ungenerated = stations.filter(s => s.rows.length === 0);
    if (ungenerated.length > 0) {
      showError('有 ' + ungenerated.length + ' 个工站尚未生成PFMEA，请先生成');
      return;
    }
    for (let i = 0; i < stations.length; i++) {
      dispatch({ type: 'CONFIRM_STATION', stationIndex: i });
    }
    dispatch({ type: 'SET_CURRENT_STATION', payload: 0 });
    showToast('全部 ' + stations.length + ' 个工站已确认', 'success');
  };

  const handleRegenerateRow = async (rowIndex) => {
    if (!state.config.apiConfig.apiKey) {
      showError('请先在配置中心填写API信息后再使用');
      return;
    }

    const station = stations[currentStationIndex];
    setRegeneratingRow(rowIndex);
    try {
      const newRow = await regeneratePfmeaRow(
        station.rows[rowIndex],
        state.config.apiConfig,
        pfmeaColumns,
        severityRules,
        occurrenceRules,
        detectionRules,
      );

      dispatch({ type: 'UPDATE_PFMEA_ROW', stationIndex: currentStationIndex, rowIndex, payload: newRow });
      showToast('该行已重新生成', 'success');
    } catch (err) {
      showError(err.message || '重生成失败');
    } finally {
      setRegeneratingRow(null);
    }
  };

  const handleDirectUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!state.config.apiConfig.apiKey) {
      showError('请先在配置中心填写API信息后再使用');
      return;
    }
    try {
      setGenerating(true);
      setLoading(true, '正在解析文件...');
      const text = await parseFile(file);
      if (text.length > 80000) {
        showError('文件内容过长（超过80000字），建议拆分成小文件');
        setGenerating(false);
        setLoading(false);
        return;
      }
      setLoading(true, '正在快速生成（范围 ' + rangeMin + '~' + rangeMax + ' 条/工站）...');
      const result = await generatePfmeaDirectFromFile(
        text, state.config.apiConfig, pfmeaColumns,
        severityRules, occurrenceRules, detectionRules,
        rangeMin, rangeMax,
      state.sop.prerequisiteSummary,
    );
      dispatch({ type: 'BULK_SET_PFMEA', payload: result });
      showToast('快速生成完成，共 ' + result.length + ' 个工站', 'success');
    } catch (err) {
      showError(err.message || '快速生成失败');
    } finally {
      setGenerating(false);
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleCellEdit = (rowIndex, fieldKey, value) => {
    const station = stations[currentStationIndex];
    const row = station.rows[rowIndex];
    const updates = { [fieldKey]: value };

    if (['severity', 'occurrence', 'detection'].includes(fieldKey)) {
      const s = fieldKey === 'severity' ? Number(value) : (Number(row.severity) || 0);
      const o = fieldKey === 'occurrence' ? Number(value) : (Number(row.occurrence) || 0);
      const d = fieldKey === 'detection' ? Number(value) : (Number(row.detection) || 0);
      updates.so = s * o;
      updates.rpn = s * o * d;
    }

    dispatch({ type: 'UPDATE_PFMEA_ROW', stationIndex: currentStationIndex, rowIndex, payload: updates });
  };

  const handleRemoveRow = (rowIndex) => {
    dispatch({ type: 'REMOVE_PFMEA_ROW', stationIndex: currentStationIndex, rowIndex });
  };

  const handleExport = (format) => {
    const confirmedRows = [];
    for (const station of stations) {
      if (station.confirmed) {
        for (const row of station.rows) {
          confirmedRows.push({ ...row, station: station.stationData.stationName || '' });
        }
      }
    }

    const exportData = confirmedRows.length > 0
      ? confirmedRows
      : stations.flatMap(s => s.rows.map(r => ({ ...r, station: s.stationData.stationName || '' })));

    if (exportData.length === 0) {
      showError('没有可导出的数据，请先生成并确认PFMEA内容');
      return;
    }

    try {
      const prefix = confirmedRows.length > 0 ? '已确认' : '全部';
      const filename = `PFMEA_${prefix}_${formatDate()}.${format}`;

      if (format === 'xlsx') {
        exportToExcel(exportData, pfmeaColumns, filename);
      } else {
        exportToCsv(exportData, pfmeaColumns, filename);
      }
      const saved = filename;
      showToast(`${filename} 已保存到浏览器下载文件夹`, 'success');
    } catch (err) {
      showError(err.message || '导出失败');
    }
  };

  const handleSetN = (n) => {
    dispatch({ type: 'SET_STATION_N', stationIndex: currentStationIndex, payload: Math.max(1, Math.min(20, Number(n) || 6)) });
  };

  if (!hasStations) {
    return (
      <div className="p-6">
          <Upload size={48} className="mx-auto text-gray-300 mb-4" />
        <div className="card p-12 text-center">
          <h2 className="text-lg font-medium text-gray-700 mb-2">快速生成PFMEA</h2>
          <p className="text-sm text-gray-500 mb-4">直接上传文件，AI自动识别工站并生成PFMEA</p>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">范围</label>
              <input type="number" value={rangeMin} min="1" max="20"
                onChange={e => setRangeMin(Math.max(1, Math.min(rangeMax, Number(e.target.value)||1)))}
                className="w-14 px-2 py-1.5 border border-gray-200 rounded text-sm text-center" />
              <span className="text-xs text-gray-400">~</span>
              <input type="number" value={rangeMax} min="1" max="20"
                onChange={e => setRangeMax(Math.max(rangeMin, Math.min(20, Number(e.target.value)||5)))}
                className="w-14 px-2 py-1.5 border border-gray-200 rounded text-sm text-center" />
              <span className="text-xs text-gray-400">条/工站</span>
            </div>
          </div>
          <button onClick={() => directFileRef.current?.click()} disabled={generating} className="btn-primary px-6">
            <Upload size={18} className="inline mr-2" />上传文件生成
          </button>
          <input ref={directFileRef} type="file" accept=".docx,.xlsx,.xls,.txt" onChange={handleDirectUpload} className="hidden" />
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-400 mb-3">或者先提取工站再生成（可审核编辑）</p>
            <button onClick={() => dispatch({ type: "SET_PAGE", payload: "sop" })} className="btn-secondary px-6">
              前往文件解析
            </button>
          </div>
          </div>
        </div>
      );
  }

  return (
    <div className="p-6 space-y-4">
      {/* 顶部工具栏 */}
      <div className="card p-4 flex items-center flex-wrap gap-3">
        {/* 工站导航 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: 'SET_CURRENT_STATION', payload: Math.max(0, currentStationIndex - 1) })}
            disabled={currentStationIndex === 0}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>

          <select
            value={currentStationIndex}
            onChange={(e) => dispatch({ type: 'SET_CURRENT_STATION', payload: Number(e.target.value) })}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm"
          >
            {stations.map((s, i) => (
              <option key={i} value={i}>
                {s.stationData.stationName || `工站 ${i+1}`}
                {s.confirmed ? ' ✓' : s.generated ? ' ⚡' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={() => dispatch({ type: 'SET_CURRENT_STATION', payload: Math.min(stations.length - 1, currentStationIndex + 1) })}
            disabled={currentStationIndex >= stations.length - 1}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200"></div>

        {/* 生成参数 */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">N=</label>
          <input
            type="number"
            value={currentStation?.n || 6}
            onChange={(e) => handleSetN(e.target.value)}
            min="1" max="20"
            className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-center"
          />
          <span className="text-xs text-gray-400">条/工站</span>
        </div>


        <div className="w-px h-6 bg-gray-200"></div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">范围</label>
          <input type="number" value={rangeMin} min="1" max="20"
            onChange={e => setRangeMin(Math.max(1, Math.min(rangeMax, Number(e.target.value)||1)))}
            className="w-12 px-1 py-1 border border-gray-200 rounded text-sm text-center" />
          <span className="text-xs text-gray-400">~</span>
          <input type="number" value={rangeMax} min="1" max="20"
            onChange={e => setRangeMax(Math.max(rangeMin, Math.min(20, Number(e.target.value)||5)))}
            className="w-12 px-1 py-1 border border-gray-200 rounded text-sm text-center" />
          <span className="text-xs text-gray-400">条/工站</span>
        </div>
        <div className="w-px h-6 bg-gray-200"></div>

        {/* 操作按钮 */}
        <button onClick={handleGenerateCurrent} disabled={generating} className="btn-secondary text-sm">
          <RefreshCw size={14} className="inline mr-1" />生成当前工站
        </button>
        <button
          onClick={handleConfirmStation}
          disabled={!currentStation?.generated || currentStation?.confirmed}
          className={`btn-success text-sm ${currentStation?.confirmed ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Check size={14} className="inline mr-1" />确认当前工站
        </button>

        <div className="w-px h-6 bg-gray-200"></div>
        <button onClick={handleGenerateAll} disabled={generating} className="btn-primary text-sm">
          <Sparkles size={14} className="inline mr-1" />全部生成
        </button>
        <button onClick={handleConfirmAll} disabled={generating || stations.length === 0} className="btn-success text-sm">
          <Check size={14} className="inline mr-1" />全部确认
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => handleExport('xlsx')} className="btn-secondary text-sm">
            <Download size={14} className="inline mr-1" />导出xlsx
          </button>
          <button onClick={() => handleExport('csv')} className="btn-secondary text-sm">
            <FileDown size={14} className="inline mr-1" />导出csv
          </button>
          <button onClick={() => dispatch({ type: 'SET_PAGE', payload: 'config' })} className="btn-secondary text-sm">
            <Settings2 size={14} className="inline mr-1" />配置
          </button>
        </div>
      </div>

      {/* 进度指示 */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>工站进度：</span>
        {stations.map((s, i) => (
          <span key={i} className={`px-2 py-0.5 rounded-full text-xs ${
            s.confirmed ? 'bg-green-100 text-green-700' :
            s.generated ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-400'
          }`}>
            {i + 1}
          </span>
        ))}
        {allConfirmed && <span className="text-green-600 font-medium ml-2">全部已确认 ✓</span>}
      </div>

      {/* PFMEA表格 */}
      {currentStation && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="pfmea-table w-full text-sm border-collapse" style={{ tableLayout: "auto" }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 w-8 border-r border-gray-100 relative select-none">#<div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400/40 z-10" onMouseDown={startColResize} /></th>
                  {pfmeaColumns.map((c, i) => (
                    <th key={c.key} className={`px-2 py-2 text-left text-xs font-medium whitespace-nowrap border-r border-gray-100 last:border-r-0 ${
                      c.autoCalc ? "text-gray-400 bg-gray-50" : "text-gray-600 relative select-none"
                    }`}>
                      {c.label}
                      {!c.autoCalc && <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400/40 z-10" onMouseDown={startColResize} />}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-xs font-medium text-gray-600 w-16 relative select-none">操作<div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400/40 z-10" onMouseDown={startColResize} /></th>
                </tr>
              </thead>
              <tbody>
                {currentStation.rows.length === 0 ? (
                  <tr>
                    <td colSpan={pfmeaColumns.length + 2} className="px-4 py-12 text-center text-sm text-gray-400">
                      点击「生成当前工站」或「全部生成」开始生成PFMEA
                    </td>
                  </tr>
                ) : (
                 currentStation.rows.map((row, i) => {
                   const rpn = row.rpn || (Number(row.severity) || 0) * (Number(row.occurrence) || 0) * (Number(row.detection) || 0);
                   const rpnClass = rpn > 150 ? 'bg-red-50' : rpn > 100 ? 'bg-orange-50' : '';





                    return (
                      <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors relative ${rpnClass}`}>
                        <td className="px-2 py-1.5 text-xs text-gray-400 align-middle relative" style={{ position: "relative", minWidth: "32px" }}>{i + 1}</td>
                        {pfmeaColumns.map((c, colIdx) => (
                          <td key={c.key} className="px-2 py-1.5 border-r border-gray-50 last:border-r-0 align-middle relative">
                            {c.autoCalc ? (
                              <span className="text-gray-500 text-xs">
                                {c.key === 'so'
                                  ? (Number(row.severity) || 0) * (Number(row.occurrence) || 0)
                                  : Number(row.severity || 0) * Number(row.occurrence || 0) * Number(row.detection || 0)
                                }
                              </span>
                            ) : c.type === 'number' ? (
                              <input
                                type="number"
                                value={row[c.key] !== undefined ? row[c.key] : ''}
                                onChange={(e) => {
                                handleCellEdit(i, c.key, e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = e.target.scrollHeight + "px";
                              }}
                                min="1" max="10"
                                className="w-14 px-1.5 py-1 border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none rounded text-sm bg-transparent font-mono text-center"
                              />
                            ) : (
                              <textarea
                                value={row[c.key] !== undefined && row[c.key] !== null ? String(row[c.key]) : ''}
                                onChange={(e) => {
                                handleCellEdit(i, c.key, e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = e.target.scrollHeight + "px";
                              }}
                               rows={Math.max(1, Math.min(4, Math.ceil((String(row[c.key] || '').length / 25) + 1)))}
                                ref={autoGrow}
                                className="w-full px-1.5 py-1 border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none rounded text-sm bg-transparent min-h-[2rem] resize-none overflow-hidden"
                                style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', minWidth: '60px' }}
                              />
                            )}
                          </td>
                        ))}
                    <td className="px-2 py-1.5 align-middle">
                      <div className="flex gap-1">
                        <button onClick={() => handleRegenerateRow(i)}
                          disabled={regeneratingRow === i}
                          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="AI重生成该行">
                          <RefreshCw size={12} className={regeneratingRow === i ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => handleRemoveRow(i)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded" title="删除该行">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="w-full h-4 cursor-row-resize mt-1 rounded hover:bg-indigo-50 flex items-center justify-center select-none" data-row-resize>
                        <div className="w-full border-t border-gray-200" />
                      </div>
                    </td>
                      </tr>);
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className={`px-4 py-2 text-xs border-t ${
            currentStation.confirmed ? 'text-green-600 bg-green-50' : 'text-gray-400'
          }`}>
            {currentStation.confirmed
              ? `✓ 工站「${currentStation.stationData.stationName || currentStationIndex + 1}」已确认（${currentStation.rows.length} 条PFMEA）`
              : currentStation.generated
                ? `${currentStation.rows.length} 条PFMEA已生成，请审核后点击「确认当前工站」`
                : '等待生成...'
            }
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}
















