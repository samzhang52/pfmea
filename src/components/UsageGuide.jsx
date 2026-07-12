import { useState } from 'react';
import { X, Upload, FileText, Settings, ArrowRight, Check, Download, BookOpen, RefreshCw, Plus, Trash2, HelpCircle } from 'lucide-react';

export default function UsageGuide() {
  const [open, setOpen] = useState(false);

  const pages = [
    { key: 'sop', label: '文件解析', color: 'indigo' },
    { key: 'pfmea', label: 'PFMEA生成', color: 'emerald' },
    { key: 'config', label: '配置中心', color: 'amber' },
  ];

  const configItems = [
    {
      icon: FileText,
      title: '文件提取字段',
      desc: '定义AI从文件中提取哪些字段的表头名称，字段数量固定不可增减。可修改列名和约束说明（约束说明会带入AI提示词中指导生成）。',
    },
    {
      icon: Settings,
      title: 'PFMEA列配置',
      desc: 'PFMEA表的列名称、类型和约束说明。每列可设置类型（text/number）和是否自动计算。RPN/SO列为自动计算列，不可删除。约束说明会作为列描述传递给AI。',
    },
    {
      icon: HelpCircle,
      title: '评分准则',
      desc: 'S(严重度)、O(频度)、D(探测度) 三级评分标准，每级 10 档。可自定义各档的描述和关键词，AI会根据这些标准对每条PFMEA记录评分。关键词越准确，AI评分越精确。',
    },
    {
      icon: Upload,
      title: 'API 配置',
      desc: '配置AI接口的地址(endpoint)、密钥(apiKey)和模型名称。支持 OpenAI / DeepSeek 等兼容接口。默认模型为 gpt-4o-mini。可设置快速生成时每个工站的最小/最大条数范围。',
    },
    {
      icon: BookOpen,
      title: 'Prompt 配置',
      desc: '自定义AI的系统提示词补充内容，可额外指导AI的生成方向。左侧栏为文件提取prompt，右侧栏为PFMEA生成prompt。',
    },
  ];

  const tips = [
    '上传前置资料（质量标准、行业规范、参考PFMEA等）可以让AI生成更专业的PFMEA。多份前置资料会累加，不会覆盖。',
    '快速生成模式可设置 N=3-5 作为范围值，让AI根据工序复杂程度自行判断生成几条。',
    'RPN列的约束说明中填写数字（如“分数不可高于100”），AI会自动提取数字作为RPN上限，严格控制 S x O x D 不超过该值。',
    '导出Excel时会映射配置中心定义的列名称，建议先配置好列名再导出。',
    '配置中心的修改会自动保存到浏览器，刷新页面不会丢失配置。如果改乱了可以点“恢复当前页面默认”。',
    '表格的列宽和行高支持手动拖拽调整，拖动表头边缘调列宽，拖动行尾的水平线调行高。',
    '配置中心支持导出/导入配置（Excel格式），方便在多台电脑间传递配置。',
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
        title="使用说明"
      >
        <BookOpen size={16} />
        <span className="hidden sm:inline">使用说明</span>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-6 pb-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4">
            {/* Header */}
            <div className="sticky top-0 bg-white rounded-t-xl border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <BookOpen size={16} className="text-indigo-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">使用说明</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-8 max-h-[70vh] overflow-y-auto text-sm text-gray-700 leading-relaxed">

              {/* ============ OVERVIEW ============ */}
              <section>
                <h3 className="text-base font-semibold text-gray-900 mb-2">概览</h3>
                <p>智能 PFMEA 生成器是一款基于带工站信息的文件自动生成 PFMEA 分析表的工具。</p>
                <p class="mt-1">利用AI大语言模型从文件中提取工站信息，结合用户配置的评分标准生成完整的PFMEA表格。三个主页面覆盖从文件到导出的全流程。</p>
              </section>

              {/* ============ THREE PAGES ============ */}
              <section>
                <h3 className="text-base font-semibold text-gray-900 mb-3">页面导航</h3>
                <div className="grid grid-cols-3 gap-3">
                  {pages.map((p) => (
                    <div key={p.key} className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className={'text-sm font-medium text-' + p.color + '-700'}>{p.label}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {p.key === 'sop' ? '上传文件→AI提取→确认' : ''}
                        {p.key === 'pfmea' ? '生成PFMEA→确认→导出' : ''}
                        {p.key === 'config' ? '配置所有参数' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ============ SOP PAGE ============ */}
              <section>
                <h3 className="text-base font-semibold text-gray-900 mb-2">一、文件解析页</h3>
                <div className="space-y-2.5">
                  <div>
                    <h4 className="text-sm font-medium text-gray-800">上传文件</h4>
                    <p>点击“选择文件”上传文件，支持 .docx（Word）/ .xlsx（Excel）/ .txt 格式，单文件最大200MB。上传后AI会自动将文件内容按段落分块，并发提取工站信息。</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-800">编辑表格</h4>
                    <p>AI提取完成后，工站信息会显示在编辑表格中。每个单元格都可以直接编辑修改。可以新增行、删除行、对单行重新提取（点击行尾的刷新按钮），或点击“全部重提”重新提取所有工站。</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-800">表格样式调整</h4>
                    <p>将鼠标移到表头边缘，拖拽可调整列宽；将鼠标移到行尾的水平线处，拖拽可调整行高。单元格内容支持自动换行。</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-800">确认提取结果</h4>
                    <p>确认工站信息正确后，点击底部“确认提取结果，进入PFMEA生成”按钮，系统会自动跳转到PFMEA生成页。</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-800">前置资料（可选）</h4>
                    <p>可以上传质量标准、行业规范、参考PFMEA等作为前置资料。AI会提取其中的关键信息，在生成PFMEA时参考使用。支持上传多份文件，内容会累加而不会覆盖。可点击“清除全部”清空所有前置资料。</p>
                  </div>
                </div>
              </section>

              {/* ============ PFMEA PAGE ============ */}
              <section>
                <h3 className="text-base font-semibold text-gray-900 mb-2">二、PFMEA生成页</h3>
                <div className="space-y-2.5">
                  <div>
                    <h4 className="text-sm font-medium text-gray-800">模式一：标准模式（逐站生成）</h4>
                    <p>从文件解析页确认后自动转入。工站列表显示在顶部，可点击切换工站。设置每个工站生成的条数 N，点击“生成当前工站”或“全部生成”。生成的PFMEA记录显示在下方表格中，支持编辑。</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-800">模式二：快速生成模式</h4>
                    <p>在PFMEA生成页上方点击“上传文件直接生成”，可以跳过文件解析步骤，让AI一次性完成工站识别和PFMEA生成。可设置生成条数范围（如 3-5），AI根据工序复杂程度自行判断。</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-800">单条重提</h4>
                    <p>如果某条PFMEA记录不合适，可点击该行尾的刷新按钮，让AI重新生成。也可以直接编辑单元格修改。</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-800">确认与导出</h4>
                    <p>每个工站可单独确认（点击“确认当前工站”），也可以一键“全部确认”。确认后可导出为 .xlsx 或 .csv 格式，导出文件会自动使用配置中心定义的列名称。</p>
                  </div>
                </div>
              </section>

              {/* ============ CONFIG PAGE ============ */}
              <section>
                <h3 className="text-base font-semibold text-gray-900 mb-2">三、配置中心</h3>
                <div className="space-y-3">
                  {configItems.map((item, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <item.icon size={14} className="text-indigo-500 shrink-0" />
                        <h4 className="text-sm font-medium text-gray-800">{item.title}</h4>
                      </div>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 bg-amber-50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-amber-800 mb-1">约束条件机制</h4>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    在“文件提取字段”和“PFMEA列配置”中，每个字段都有“约束说明”字段。
                    你填写的内容会自动带入AI提示词，指导AI生成。
                    特别是RPN列的约束说明，代码会解析其中的数字作为RPN上限，让AI严格控制 S x O x D 不超过该值。
                  </p>
                </div>

                <div className="mt-3 bg-blue-50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-blue-800 mb-1">配置导出/导入</h4>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    配置中心右上角支持导出和导入配置（Excel格式）。
                    导出的文件每个配置项一个Sheet，方便在多台电脑间传递或备份配置。
                    同时支持每个配置页面单独“恢复当前页面默认”。
                  </p>
                </div>
              </section>

              {/* ============ TIPS ============ */}
              <section>
                <h3 className="text-base font-semibold text-gray-900 mb-3">小贴士</h3>
                <ul className="space-y-2">
                  {tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-xs text-gray-600">
                      <span className="text-indigo-400 shrink-0 mt-0.5">&bull;</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>

            </div>
          </div>
        </div>
      )}
    </>
  );
}