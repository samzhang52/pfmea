import { useState, useRef, useCallback, useEffect } from 'react';
import { useTableResize } from '../utils/tableResize';
import { useApp } from '../store/AppContext';
import { parseFile, splitIntoChunks } from '../utils/fileParser';
import { extractSopWithAi, extractPrerequisiteInfo } from '../services/aiClient';
import { Upload, RefreshCw, Plus, Trash2, Check, ArrowRight, AlertCircle } from 'lucide-react';

export default function SopPage() {
  const { state, dispatch, setLoading, showToast, showError } = useApp();
  const { sopFields } = state.config;
  const { rawText, parsedRows, confirmed } = state.sop;
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [regeneratingRow, setRegeneratingRow] = useState(null);
  const prereqFileRef = useRef(null);
  const [prereqFileName, setPrereqFileName] = useState('');
  const [extractingPrereq, setExtractingPrereq] = useState(false);
  const { startColResize } = useTableResize();
  const autoGrow = useCallback((el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  useEffect(() => {
    const el = document.querySelector(".sop-table");
    if (!el) return;
    const tas = el.querySelectorAll("textarea");
    if (!tas.length) return;
    const fn = () => tas.forEach((t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; });
    fn();
    const ro = new ResizeObserver(fn);
    tas.forEach((t) => ro.observe(t));
    return () => ro.disconnect();
  }, [state.sop.parsedRows]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      setProcessing(true);
      setLoading(true, '正在解析文件...');
      const text = await parseFile(file);
      dispatch({ type: 'SET_SOP_RAW_TEXT', payload: text });

      const chunks = splitIntoChunks(text);
      setLoading(true, `正在调用AI提取工站信息（共${chunks.length}段）...`);

      const rows = await extractSopWithAi(
        text,
        state.config.apiConfig,
        sopFields,
        (progress) => {
          setLoading(true, `正在调用AI提取工站信息（${progress.completed}/${progress.total}段）...`, progress);
        }
      );

      dispatch({ type: 'SET_SOP_PARSED_ROWS', payload: rows });
      // 重置表格布局
      document.querySelectorAll('table tbody tr').forEach(function(el) { el.style.height = ''; el.style.minHeight = ''; });
      document.querySelectorAll('[data-cidx]').forEach(function(el) { el.style.width = ''; el.style.minWidth = ''; el.style.maxWidth = ''; });

      const errorRows = rows.filter(r => r._error);
      if (errorRows.length > 0) {
        showToast(`${errorRows.length} 段提取失败，可在页面下方查看具体原因`, 'warning');
      } else {
        showToast(`成功提取 ${rows.filter(r => !r._error).length} 个工站`, 'success');
      }
    } catch (err) {
      showError(err.message || '解析失败，请重试');
    } finally {
      setProcessing(false);
      setLoading(false);
    }
  };

  const handleReExtractRow = async (index) => {
    if (!state.config.apiConfig.apiKey) {
      showError('请先在配置中心填写API信息后再使用');
      return;
    }

    setRegeneratingRow(index);
    try {
      const row = parsedRows[index];
      const text = Object.entries(row)
        .filter(([k, v]) => !k.startsWith('_') && v)
        .map(([, v]) => v)
        .join('\n');

      const result = await extractSopWithAi(text, state.config.apiConfig, sopFields, () => {});
      const newRow = Array.isArray(result) ? result[0] : result;

      if (newRow && !newRow._error) {
        dispatch({ type: 'UPDATE_SOP_ROW', index, payload: {
          stepNo: String(newRow.stepNo || ''),
          stationName: newRow.stationName || '',
          operationDesc: newRow.operationDesc || '',
          keyParams: newRow.keyParams || '',
          materials: newRow.materials || '',
          equipment: newRow.equipment || '',
          inspectionMethod: newRow.inspectionMethod || '',
          specialChar: newRow.specialChar || '',
        }});
        showToast('该行已重新提取', 'success');
      } else {
        showError(newRow?._errorMsg || '重提失败，请稍后重试');
      }
    } catch (err) {
      showError(err.message || '重提失败');
    } finally {
      setRegeneratingRow(null);
    }
  };

  const handleCellEdit = (rowIndex, fieldKey, value) => {
    dispatch({ type: 'UPDATE_SOP_ROW', index: rowIndex, payload: { [fieldKey]: value } });
  };

  const handleAddRow = () => {
    dispatch({ type: 'ADD_SOP_ROW', payload: {
      stepNo: String(parsedRows.filter(r => !r._error).length + 1),
      stationName: '', operationDesc: '', keyParams: '',
      materials: '', equipment: '', inspectionMethod: '', specialChar: '',
    }});
  };

  const handleRemoveRow = (index) => {
    dispatch({ type: 'REMOVE_SOP_ROW', index });
  };

  const handleConfirm = () => {
    const validRows = parsedRows.filter(r => !r._error && r.stationName?.trim());
    if (validRows.length === 0) {
      showError('没有有效的工站数据，请先上传文件并完成提取');
      return;
    }

    // 先确认SOP，再填充PFMEA工站数据，再跳转
    dispatch({ type: 'CONFIRM_SOP' });
    dispatch({ type: 'SET_PFMEA_STATIONS', payload: validRows });
    dispatch({ type: 'SET_PAGE', payload: 'pfmea' });
    showToast(`工站信息已确认，${validRows.length} 个工站进入PFMEA生成`, 'success');
  };

  const handleReExtractAll = async () => {
    if (!state.config.apiConfig.apiKey) {
      showError('请先在配置中心填写API信息后再使用');
      return;
    }
    if (!rawText) {
      showError('没有原始文件文本，请重新上传文件');
      return;
    }

    try {
      setProcessing(true);
      setLoading(true, '正在重新提取所 工站信息...');

      const rows = await extractSopWithAi(
        rawText, state.config.apiConfig, sopFields, (progress) => {
          setLoading(true, `正在重新提取（${progress.completed}/${progress.total}段）...`, progress);
        }
      );

      dispatch({ type: 'SET_SOP_PARSED_ROWS', payload: rows });
      // 重置表格布局
      document.querySelectorAll('table tbody tr').forEach(function(el) { el.style.height = ''; el.style.minHeight = ''; });
      document.querySelectorAll('[data-cidx]').forEach(function(el) { el.style.width = ''; el.style.minWidth = ''; el.style.maxWidth = ''; });
      showToast(`重新提取完成，共 ${rows.filter(r => !r._error).length} 个工站`, 'success');
    } catch (err) {
      showError(err.message || '重新提取失败');
    } finally {
      setProcessing(false);
      setLoading(false);
    }
  };

  const handlePrereqUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPrereqFileName(file.name);
    try {
      setExtractingPrereq(true);
      setLoading(true, '正在读取前置资料...');
      const text = await parseFile(file);
      setLoading(true, '正在提取前置资料关键信息...');
      const summary = await extractPrerequisiteInfo(text, state.config.apiConfig);
      dispatch({ type: 'APPEND_PREREQUISITE_FILE', payload: { text, summary, fileName: file.name } });
      showToast('前置资料提取完成', 'success');
    } catch (err) {
      showError('前置资料处理失败：' + err.message);
    } finally {
      setExtractingPrereq(false);
      setLoading(false);
    }
  };

  const handleClearPrereq = () => {
    dispatch({ type: 'CLEAR_PREREQUISITE' });
    setPrereqFileName('');
    showToast('前置资料已清除', 'info');
  };

  const validRows = parsedRows.filter(r => !r._error);
  const errorRows = parsedRows.filter(r => r._error);
  const hasData = validRows.length > 0;


  return (
    <div className="p-6 space-y-6">
      {/* 上传区 */}
      <div className="card p-8 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.xlsx,.xls,.txt"
          onChange={handleUpload}
          className="hidden"
        />
        {!hasData && errorRows.length === 0 ? (
          <div>
            <Upload size={48} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-lg font-medium text-gray-700 mb-2">上传文件</h2>
            <p className="text-sm text-gray-500 mb-4">支持 .docx / .xlsx / .txt 格式，单文件最大200MB</p>
            <button onClick={() => fileInputRef.current?.click()} disabled={processing} className="btn-primary">选择文件</button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Upload size={16} className="text-indigo-500" />
              <span>{fileName}</span>
              <span className="text-gray-400">|</span>
              <span className="text-green-600 font-medium">{validRows.length} 个工站</span>
              {errorRows.length > 0 && <span className="text-red-500">（{errorRows.length} 段失败）</span>}
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={processing} className="btn-secondary text-sm">重新上传</button>
            <button onClick={handleReExtractAll} disabled={processing} className="btn-secondary text-sm">
              <RefreshCw size={14} className="inline mr-1" />全部重提
            </button>
          </div>
        )}
      </div>

      {/* 数据表格 - 带自动换行 */}
      {hasData && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="sop-table w-full text-sm border-collapse" style={{ tableLayout: "auto" }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  {sopFields.map((f, i) => (
                    <th key={f.key} className="px-3 py-2.5 text-left text-xs font-medium text-gray-600 whitespace-nowrap border-r border-gray-100 last:border-r-0 relative select-none" style={f.key === 'operationDesc' ? { minWidth: '360px' } : undefined}>{f.label}<div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400/40 z-10" onMouseDown={startColResize} />                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-xs font-medium text-gray-600 w-24 border-r border-gray-100 relative select-none">操作<div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-400/40 z-10" onMouseDown={startColResize} /></th>
                </tr>
              </thead>
              <tbody>
               {validRows.map((row, i) => {

                  const maxRows = Math.max(1, ...sopFields.map(f => Math.ceil(((row[f.key] || '').length / 18) + 1)));
                  return (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors relative">
                    {sopFields.map((f, colIdx) => (
                      <td key={f.key} className="px-3 py-2 border-r border-gray-50 last:border-r-0 align-middle relative">
                        
                        <textarea
                          value={row[f.key] || ''}
                          ref={autoGrow}
                          onChange={(e) => {
                            handleCellEdit(parsedRows.indexOf(row), f.key, e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = e.target.scrollHeight + "px";
                          }}
                          className="w-full px-2 py-1 border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none rounded text-sm bg-transparent min-h-[2rem] resize-none overflow-hidden"
                          style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-1 pt-1">
                        <button onClick={() => handleReExtractRow(parsedRows.indexOf(row))}
                          disabled={regeneratingRow === parsedRows.indexOf(row)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-50" title="AI重提此行">
                          <RefreshCw size={14} className={regeneratingRow === parsedRows.indexOf(row) ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => handleRemoveRow(parsedRows.indexOf(row))}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="删除此行">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="w-full h-5 cursor-row-resize mt-1 rounded hover:bg-indigo-50 flex items-center justify-center select-none" data-row-resize>
                        <div className="w-full border-t border-gray-200" />
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-gray-100">
            <button onClick={handleAddRow} className="btn-secondary text-xs">
              <Plus size={14} className="inline mr-1" />新增行
            </button>
          </div>
        </div>
      )}

      {/* 失败行详细提示 */}
      {errorRows.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800"> 有 {errorRows.length} 段提取失败</p>
              <p className="text-xs text-red-600 mt-0.5">文件已解析成功，但在发送给AI提取时失败了。以下是具体原因：</p>
            </div>
          </div>
          {errorRows.map((r, i) => (
            <div key={i} className="ml-6 pl-3 border-l-2 border-red-300">
              <p className="text-xs text-red-700 font-mono">{r._errorMsg || '未知错误'}</p>
              <p className="text-xs text-red-400 mt-0.5">可手动编辑填写该段内容，或点击「全部重提」重新尝试</p>
            </div>
          ))}
        </div>
      )}

      {/* 确认按钮 */}
      {hasData && (
        <div className="flex justify-end">
          <button onClick={handleConfirm} className="btn-success flex items-center gap-2 px-6 py-2.5">
            <Check size={18} /><span>确认提取结果，进入PFMEA生成</span><ArrowRight size={18} />
          </button>
        </div>
      )}
      {/* 前置资料区域 */}
      <div className="card p-6 mt-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">前置资料（可选）</h3>
        <p className="text-xs text-gray-500 mb-3">上传质量标准、行业规范、参考PFMEA等，AI将提取关键信息用于生成PFMEA</p>
        <div className="flex items-center gap-3">
          <input ref={prereqFileRef} type="file" accept=".docx,.xlsx,.xls,.txt" onChange={handlePrereqUpload} className="hidden" />
          <button onClick={() => prereqFileRef.current?.click()} disabled={extractingPrereq} className="btn-secondary text-sm">
            <Upload size={14} className="inline mr-1" />上传前置资料
          </button>
          {(state.sop.prerequisiteFileNames || []).length > 0 && (
            <>
              <span className="text-xs text-gray-400">{state.sop.prerequisiteFileNames.join(' | ')}</span>
              <button onClick={handleClearPrereq} className="btn-danger text-xs py-1 px-2">清除全部</button>
            </>
          )}
        </div>
        {state.sop.prerequisiteSummary && (
          <div className="mt-3">
            <label className="text-xs text-gray-500 block mb-1">提取的关键信息（可编辑，多份资料用 --- 分隔）</label>
            <textarea value={state.sop.prerequisiteSummary}
              onChange={(e) => dispatch({ type: "SET_PREREQUISITE_SUMMARY", payload: e.target.value })}
              rows={6} className="w-full px-3 py-2 border border-gray-200 rounded text-sm" />
          </div>
        )}
      </div>
    </div>
  );
}


















