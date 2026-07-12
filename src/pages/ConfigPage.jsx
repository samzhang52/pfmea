import { useState, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { Save, Plus, Trash2, Eye, EyeOff, CheckCircle, XCircle, Loader2, RefreshCw, Download, Upload } from 'lucide-react';
import { exportConfigToExcel, importConfigFromExcel } from '../utils/configExporter';
import {
  DEFAULT_SOP_FIELDS, DEFAULT_PFMEA_COLUMNS,
  DEFAULT_SEVERITY_RULES, DEFAULT_OCCURRENCE_RULES, DEFAULT_DETECTION_RULES,
  DEFAULT_API_CONFIG
} from '../config/constants';

// API供应商预设
const API_PRESETS = {
  openai: { endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  deepseek: { endpoint: 'https://api.deepseek.com', model: 'deepseek-chat' },
  azure: { endpoint: '', model: 'gpt-4o-mini' },
  custom: { endpoint: '', model: '' },
};

export default function ConfigPage() {
  const { state, dispatch, showToast, showError } = useApp();
  const [activeTab, setActiveTab] = useState('sopFields');
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [testMsg, setTestMsg] = useState('')
  const fileInputRef = useRef(null);

  const handleResetTab = () => {
    const resetMap = {
      sopFields: { ...state.config, sopFields: DEFAULT_SOP_FIELDS.map(f => ({ ...f })) },
      pfmeaColumns: { ...state.config, pfmeaColumns: DEFAULT_PFMEA_COLUMNS.map(c => ({ ...c })) },
      rules: { ...state.config, severityRules: DEFAULT_SEVERITY_RULES.map(r => ({ ...r })), occurrenceRules: DEFAULT_OCCURRENCE_RULES.map(r => ({ ...r })), detectionRules: DEFAULT_DETECTION_RULES.map(r => ({ ...r })) },
      api: { ...state.config, apiConfig: { ...DEFAULT_API_CONFIG } },
      prompt: { ...state.config, sopExtPrompt: '', pfmeaGenPrompt: '' },
    };
    dispatch({ type: 'SET_CONFIG', payload: resetMap[activeTab] || state.config });
    showToast('已恢复当前页面默认设置', 'success');
  };

  const handleSave = () => {
    showToast('配置已保存', 'success');
  };

  const handleExportConfig = () => {
    try {
      exportConfigToExcel(state.config);
      showToast('配置已导出', 'success');
    } catch (err) {
      showError('导出失败：' + err.message);
    }
  };

  const handleImportConfig = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importConfigFromExcel(file);
      dispatch({ type: 'SET_CONFIG', payload: imported });
      showToast('配置已导入', 'success');
    } catch (err) {
      showError(err.message);
    }
    e.target.value = '';
  };

  const updateSopField = (i, updates) => {
    const fields = [...state.config.sopFields];
    fields[i] = { ...fields[i], ...updates };
    dispatch({ type: 'SET_CONFIG', payload: { ...state.config, sopFields: fields } });
  };

  const updatePfmeaColumn = (i, updates) => {
    const cols = [...state.config.pfmeaColumns];
    cols[i] = { ...cols[i], ...updates };
    dispatch({ type: 'SET_CONFIG', payload: { ...state.config, pfmeaColumns: cols } });
  };

  const updateRule = (ruleSet, i, updates) => {
    const rules = [...state.config[ruleSet]];
    rules[i] = { ...rules[i], ...updates };
    dispatch({ type: 'SET_CONFIG', payload: { ...state.config, [ruleSet]: rules } });
  };

  const handleProviderChange = (provider) => {
    const preset = API_PRESETS[provider];
    if (preset) {
      dispatch({ type: 'SET_CONFIG', payload: {
        ...state.config,
        apiConfig: {
          ...state.config.apiConfig,
          provider,
          endpoint: preset.endpoint || state.config.apiConfig.endpoint,
          model: preset.model || state.config.apiConfig.model,
        },
      }});
    } else {
      updateApiConfig('provider', provider);
    }
  };

  const updateApiConfig = (key, value) => {
    dispatch({ type: 'SET_CONFIG', payload: {
      ...state.config,
      apiConfig: { ...state.config.apiConfig, [key]: value },
    }});
  };

  const testConnection = async () => {
    const { endpoint, apiKey, model } = state.config.apiConfig;
    if (!apiKey) {
      showError('请先填写API密钥');
      return;
    }
    if (!endpoint) {
      showError('请先填写API端点地址');
      return;
    }

    setTestStatus('testing');
    setTestMsg('');
    try {
      const url = endpoint.replace(/\/+$/, '') + '/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: '回复"ok"即可' }],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        setTestStatus('success');
        setTestMsg('连接成功！API服务正常');
        showToast('API连接成功', 'success');
      } else {
        const body = await response.text().catch(() => '');
        setTestStatus('fail');
        if (response.status === 401) {
          setTestMsg('认证失败(401)，请检查API密钥是否正确');
        } else if (response.status === 404) {
          setTestMsg(`端点地址可能不正确(404)，请检查是否缺少 /v1 路径。正在请求: ${url}`);
        } else {
          setTestMsg(`服务返回错误(${response.status})${body ? ': ' + body.slice(0, 200) : ''}`);
        }
      }
    } catch (err) {
      setTestStatus('fail');
      if (err.name === 'TimeoutError' || err.message.includes('timed out')) {
        setTestMsg('连接超时(15秒)，请检查API端点地址和网络连接');
      } else if (err.message.includes('Failed to fetch') || err.message.includes('fetch')) {
        setTestMsg(`网络连接失败，请检查端点地址是否正确。当前请求地址: ${endpoint.replace(/\/+$/, '')}/chat/completions`);
      } else {
        setTestMsg('连接失败: ' + err.message);
      }
    }
  };

  const RuleEditor = ({ ruleSetKey }) => {
    const rules = state.config[ruleSetKey];
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500">每条规则包含：等级(1-10)、标题、关键词（逗号分隔）和描述。</p>
        {rules.map((rule, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500 w-8">#{rule.level}</span>
              <input type="number" value={rule.level}
                onChange={(e) => updateRule(ruleSetKey, i, { level: Number(e.target.value) })}
                min="1" max="100" className="w-16 px-2 py-1 border border-gray-200 rounded text-sm" />
              <input type="text" value={rule.label}
                onChange={(e) => updateRule(ruleSetKey, i, { label: e.target.value })}
                className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm" placeholder="标题" />
              <button onClick={() => {
                const newRules = rules.filter((_, j) => j !== i);
                dispatch({ type: 'SET_CONFIG', payload: { ...state.config, [ruleSetKey]: newRules } });
              }} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
            </div>
            <input type="text" value={rule.keywords.join('、')}
              onChange={(e) => updateRule(ruleSetKey, i, { keywords: e.target.value.split(/[，、,]/).filter(Boolean) })}
              className="w-full px-2 py-1 border border-gray-200 rounded text-sm" placeholder="关键词（逗号分隔）" />
            <textarea value={rule.desc}
              onChange={(e) => updateRule(ruleSetKey, i, { desc: e.target.value })}
              rows={2} className="w-full px-2 py-1 border border-gray-200 rounded text-sm" placeholder="描述" />
          </div>
        ))}
        <button onClick={() => {
          const newRules = [...rules, { level: rules.length + 1, label: '', keywords: [], desc: '' }];
          dispatch({ type: 'SET_CONFIG', payload: { ...state.config, [ruleSetKey]: newRules } });
        }} className="btn-secondary text-xs"><Plus size={14} className="inline mr-1" />新增规则</button>
      </div>
    );
  };

  const tabContent = {
    sopFields: (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">定义AI从文件中提取哪些字段的表头名称（字段数量固定）。</p>
        {state.config.sopFields.map((f, i) => (
          <div key={f.key} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 w-16 shrink-0">字段{i+1}</span>
              <input type="text" value={f.label} onChange={(e) => updateSopField(i, { label: e.target.value })}
                className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm" placeholder="字段名" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16 shrink-0">约束说明</span>
              <input type="text" value={f.description || '' } onChange={(e) => updateSopField(i, { description: e.target.value })}
                className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm" placeholder="AI提取此字段时的约束" />
            </div>
          </div>
        ))}
      </div>
    ),
    pfmeaColumns: (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">列名称可修改，约束说明将代入AI提示词中指导生成。</p>
        {state.config.pfmeaColumns.map((c, i) => (
          <div key={c.key} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              
              <span className="text-xs font-medium text-gray-500 w-16 shrink-0">列{i+1}</span>
              <input type="text" value={c.label} onChange={(e) => updatePfmeaColumn(i, { label: e.target.value })}
                className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm" disabled={c.autoCalc} placeholder="列名" />
              {c.autoCalc && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">自动计算</span>}
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{c.type}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16 shrink-0">约束说明</span>
              <input type="text" value={c.description || '' } onChange={(e) => updatePfmeaColumn(i, { description: e.target.value })}
                className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm" placeholder="AI生成此列时的约束，如：分数不高于100" />
            </div>
          </div>
        ))}
      </div>
    ),
    rules: (
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">S严重度评分规则</h3>
          <RuleEditor ruleSetKey="severityRules" />
        </div>
        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">O频度数评分规则</h3>
          <RuleEditor ruleSetKey="occurrenceRules" />
        </div>
        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">D探测度评分规则</h3>
          <RuleEditor ruleSetKey="detectionRules" />
        </div>
<div className="border-t border-gray-100 pt-6">
        </div>
      </div>
    ),
    api: (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">AI供应商</label>
          <select value={state.config.apiConfig.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="input-field">
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="azure">Azure OpenAI</option>
            <option value="custom">自定义（兼容OpenAI协议）</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API端点地址</label>
          <input type="text" value={state.config.apiConfig.endpoint}
            onChange={(e) => updateApiConfig('endpoint', e.target.value)}
            className="input-field" placeholder="https://api.openai.com/v1" />
          <p className="text-xs text-gray-400 mt-1">DeepSeek: https://api.deepseek.com</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API密钥</label>
          <div className="relative">
            <input type={showKey ? 'text' : 'password'} value={state.config.apiConfig.apiKey}
              onChange={(e) => updateApiConfig('apiKey', e.target.value)}
              className="input-field pr-8" placeholder="sk-..." />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">模型名称</label>
          <input type="text" value={state.config.apiConfig.model}
            onChange={(e) => updateApiConfig('model', e.target.value)}
            className="input-field" placeholder="gpt-4o-mini" />
          <p className="text-xs text-gray-400 mt-1">DeepSeek: deepseek-chat</p>
        </div>

        {/* 测试连接 */}
        <div className="border-t border-gray-100 pt-4">
          <button onClick={testConnection} disabled={testStatus === 'testing'}
            className="btn-secondary text-sm flex items-center gap-2">
            {testStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            测试连接
          </button>

          {testStatus === 'success' && (
            <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
              <CheckCircle size={16} /> {testMsg}
            </div>
          )}
          {testStatus === 'fail' && (
            <div className="mt-2 text-sm text-red-600">
              <div className="flex items-start gap-1">
                <XCircle size={16} className="mt-0.5 shrink-0" />
                <span>{testMsg}</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          导出文件将保存到浏览器的默认下载文件夹。API密钥仅存储在本地，不会上传到任何服务器。
        </div>
          API密钥仅存储在您的浏览器本地，不会上传到任何服务器。
        </div>
      </div>
    ),
    prompt: (
      <div className="space-y-4">
        <p className="text-xs text-gray-500">自定义AI提示词，将附加到默认prompt之后。修改后点击保存生效。</p>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">SOP提取 - 额外指令</label>
            <button onClick={() => dispatch({ type: "SET_CONFIG", payload: { ...state.config, sopExtPrompt: "" }})}
              className="text-xs text-indigo-600 hover:text-indigo-800">恢复默认</button>
          </div>
          <textarea value={state.config.sopExtPrompt || ""}
            onChange={(e) => dispatch({ type: "SET_CONFIG", payload: { ...state.config, sopExtPrompt: e.target.value }})}
            rows={4} className="w-full px-3 py-2 border border-gray-200 rounded text-sm font-mono"
            placeholder='例如：提取工站信息时，请确保每条记录的操作步骤描述完整包含动作动词和对象' />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">PFMEA生成 - 额外指令</label>
            <button onClick={() => dispatch({ type: "SET_CONFIG", payload: { ...state.config, pfmeaGenPrompt: "" }})}
              className="text-xs text-indigo-600 hover:text-indigo-800">恢复默认</button>
          </div>
          <textarea value={state.config.pfmeaGenPrompt || ""}
            onChange={(e) => dispatch({ type: "SET_CONFIG", payload: { ...state.config, pfmeaGenPrompt: e.target.value }})}
            rows={4} className="w-full px-3 py-2 border border-gray-200 rounded text-sm font-mono"
            placeholder='例如：RPN值必须严格控制在100以内，如果某条记录超过100，请调整S/O/D评分使其RPN不超过100' />
        </div>

      </div>
    ),
  };

  const tabHeaders = [
    { key: 'sopFields', label: 'SOP提取字段' },
    { key: 'pfmeaColumns', label: 'PFMEA列配置' },
    { key: 'rules', label: '评分准则' },
    { key: 'api', label: 'API配置' },
    { key: 'prompt', label: 'Prompt配置' },
  ];

  return (
    <div className="p-6">
      <div className="card">
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex">
              {tabHeaders.map(t => (
                <button key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pr-2">
              <button onClick={handleExportConfig} className="btn-secondary text-xs py-1 px-2"><Download size={14} className="inline mr-1" />导出配置</button>
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-xs py-1 px-2"><Upload size={14} className="inline mr-1" />导入配置</button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportConfig} className="hidden" />
            </div>
          </div>
        </div>
        <div className="p-4">
          {tabContent[activeTab]}
          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
            <button onClick={handleResetTab} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw size={14} />恢复当前页面默认
            </button>
            <button onClick={handleSave} className="btn-primary flex items-center gap-2">
              <Save size={16} />保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

