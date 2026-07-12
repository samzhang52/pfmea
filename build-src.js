const fs = require('fs');
const path = require('path');
const BASE = 'C:/Users/vv/Documents/Pfmea生成/pfmea-generator/src';

function write(file, content) {
  const full = path.join(BASE, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('  ' + file);
}

// 1. config/constants.js
write('config/constants.js', `
// SOP提取默认字段 (8个)
export const DEFAULT_SOP_FIELDS = [
  { key: 'stepNo', label: '工站序号' },
  { key: 'stationName', label: '工站名称' },
  { key: 'operationDesc', label: '操作步骤描述' },
  { key: 'keyParams', label: '关键参数' },
  { key: 'materials', label: '使用物料' },
  { key: 'equipment', label: '使用设备/工装' },
  { key: 'inspectionMethod', label: '检验方法' },
  { key: 'specialChar', label: '特殊特性' },
];

// PFMEA列默认配置 (15列)
export const DEFAULT_PFMEA_COLUMNS = [
  { key: 'stepNo', label: '工序号', type: 'number' },
  { key: 'station', label: '工站', type: 'text' },
  { key: 'processFunction', label: '过程功能', type: 'text' },
  { key: 'requirement', label: '要求', type: 'text' },
  { key: 'failureMode', label: '潜在失效模式', type: 'text' },
  { key: 'failureEffect', label: '潜在失效后果', type: 'text' },
  { key: 'severity', label: '严重度S', type: 'number' },
  { key: 'cause', label: '潜在的失效起因/机理', type: 'text' },
  { key: 'occurrence', label: '频度数O', type: 'number' },
  { key: 'preventionControl', label: '现行预防过程控制', type: 'text' },
  { key: 'detectionControl', label: 'Controls Detection', type: 'text' },
  { key: 'detection', label: '可探测度D', type: 'number' },
  { key: 'so', label: '风险顺序数SO', type: 'number', autoCalc: true },
  { key: 'rpn', label: '风险顺序数RPN', type: 'number', autoCalc: true },
  { key: 'recommendedAction', label: '建议措施', type: 'text' },
];

// S严重度评分默认规则
export const DEFAULT_SEVERITY_RULES = [
  { level: 10, label: '有危害但无发出警报', keywords: ['爆炸','起火','无报警','无警告','安全'], desc: '安全特性发生故障,对人身与公司财产安全造成严重影响,且无发出报警' },
  { level: 9, label: '有危害但有发生警讯', keywords: ['有报警','有警告','人身','重大经济损失'], desc: '安全特性发生故障,但有发出报警' },
  { level: 8, label: '非常高', keywords: ['不能使用','失去功能','主要功能','报废','关键功能'], desc: '关键功能特性失效,造成产品整机报废' },
  { level: 7, label: '高', keywords: ['性能下降','维修','很不满意','重要功能'], desc: '重要功能特性失效,造成整机维修' },
  { level: 6, label: '中', keywords: ['次要功能丧失','不满意','零部件报废'], desc: '一般功能特性失效,造成零部件报废' },
  { level: 5, label: '低', keywords: ['次要功能下降','不太满意','停线'], desc: '一般功能特性失效,造成停线' },
  { level: 4, label: '非常低', keywords: ['组装异常','外观异常','缝隙','75%'], desc: '超过75%顾客发现组装/外观异常' },
  { level: 3, label: '轻微', keywords: ['50%','标签','包装异常','不可辨认'], desc: '约50%顾客发现外观/包装异常' },
  { level: 2, label: '非常轻微', keywords: ['25%','划伤','划痕'], desc: '少于25%顾客发现' },
  { level: 1, label: '无', keywords: ['无影响','不影响'], desc: '无影响' },
];

// O频度数评分默认规则
export const DEFAULT_OCCURRENCE_RULES = [
  { level: 10, label: '很高', keywords: ['不可避免','必然发生','频繁','>5000',], dpmo: 5000, cpk: '<0.33', desc: '缺陷发生几乎不可避免' },
  { level: 9, label: '很高', keywords: ['重复发生','1000'], dpmo: 1000, cpk: '>=0.33', desc: '重复的缺陷发生' },
  { level: 8, label: '高', keywords: ['高','经常','500'], dpmo: 500, cpk: '>=0.51', desc: '重复的缺陷发生' },
  { level: 7, label: '高', keywords: ['有时','100'], dpmo: 100, cpk: '>=0.67', desc: '有时失效' },
  { level: 6, label: '中等', keywords: ['偶尔','50'], dpmo: 50, cpk: '>=0.83', desc: '不能避免缺陷发生' },
  { level: 5, label: '中等', keywords: ['10'], dpmo: 10, cpk: '>=1.00', desc: '偶尔失效' },
  { level: 4, label: '低', keywords: ['5'], dpmo: 5, cpk: '>=1.17', desc: '相对较少失效' },
  { level: 3, label: '低', keywords: ['2.5'], dpmo: 2.5, cpk: '>=1.33', desc: '相对较少失效' },
  { level: 2, label: '很低', keywords: ['0.5'], dpmo: 0.5, cpk: '>=1.50', desc: '很少失效' },
  { level: 1, label: '最低', keywords: ['0.1','不可能失效','防错保证'], dpmo: 0.1, cpk: '>=1.67', desc: '可预见将来不可能失效' },
];

// D探测度评分默认规则
export const DEFAULT_DETECTION_RULES = [
  { level: 10, label: '不能检测', keywords: ['没有检查','不能检测','无检测','无检查'], desc: '不能检测或没有检查' },
  { level: 9, label: '间接/随机检查', keywords: ['间接','随机检查','抽查'], desc: '只能通过间接或随机检查来实现管制' },
  { level: 8, label: '人工检验(未验证)', keywords: ['人工目检','视觉','触觉','听觉','人工检验'], desc: '人工检验方法尚未经验证' },
  { level: 7, label: '设备检验(未验证)', keywords: ['半自动','自动检验','光学','设备检验'], desc: '设备检验方法尚未经验证' },
  { level: 6, label: '人工检验(已验证)', keywords: ['人工测量','已建立','检验指导书','目检'], desc: '人工检验方法已经建立' },
  { level: 5, label: '设备检验(已验证)', keywords: ['设备检测','自动检测','AOI','SPI'], desc: '设备检验方法已经建立' },
  { level: 4, label: '自动化探测(下游)', keywords: ['下游','自动拦截','分流'], desc: '自动化方法可在下游探测到失效模式' },
  { level: 3, label: '自动化探测(工位)', keywords: ['工位探测','在线检测','实时检测'], desc: '自动化方法可在工位上探测到失效模式' },
  { level: 2, label: '自动防错', keywords: ['防错','防呆','预防失效','无法流出'], desc: '自动防错探测,可预防失效' },
  { level: 1, label: '不可能失效', keywords: ['不可能失效','设计保证','无法发生'], desc: '设计/过程不可能失效' },
];

// 失效模式映射规则 (过程功能 -> 可能的失效模式)
export const FAILURE_MODE_MAP = {
  '拧紧': ['扭矩不足','扭矩过大','螺丝漏装','滑牙','螺丝倾斜','未按顺序拧紧'],
  '焊接': ['虚焊','漏焊','焊接不牢','飞溅','焊接变形','未焊透','锡珠'],
  '组装': ['漏装零件','组装不到位','方向装反','间隙过大','卡扣断裂'],
  '上料': ['物料拿错','物料方向错误','物料掉落','多拿','少拿'],
  '检测': ['漏检','误判','未检出缺陷','检测标准不统一'],
  '点胶': ['胶量不足','胶量过多','漏点胶','点胶位置偏移','拉丝'],
  '压接': ['压接力不足','压接过度','端子变形','压接位置偏移'],
  '清洗': ['清洗不净','残留物','清洗剂配比错误','清洗时间不足'],
  '包装': ['包装方式错误','标签贴错','数量错误','包材使用错误'],
  '搬运': ['产品碰撞','划伤','倾倒','方向错误'],
  '调试': ['参数设置错误','调试不到位','程序选择错误'],
  '贴装': ['贴偏','漏贴','贴反','立碑','偏移'],
};

// 失效后果映射 (失效模式 -> 可能的后果)
export const FAILURE_EFFECT_MAP = {
  '扭矩不足': ['连接松动','密封失效','功能丧失','异响'],
  '扭矩过大': ['螺纹滑牙','工件变形','断裂'],
  '螺丝漏装': ['连接失效','功能丧失','异响','漏油/漏水'],
  '虚焊': ['电气连接不良','功能失效','间歇性故障'],
  '漏焊': ['连接失效','功能丧失'],
  '漏装零件': ['功能丧失','组装不良','客户投诉'],
  '物料拿错': ['产品功能错误','批次混乱','质量事故'],
  '方向装反': ['功能失效','装配不良','无法安装'],
};

// SOP动作关键词 -> 工站映射
export const ACTION_TO_STATION = {
  '拿取':'上料工站','搬运':'上料工站','放置':'上料工站','上料':'上料工站','送料':'上料工站',
  '拧紧':'装配工站','锁紧':'装配工站','组装':'装配工站','安装':'装配工站','装配':'装配工站',
  '焊接':'焊接工站','锡焊':'焊接工站','点焊':'焊接工站',
  '点胶':'点胶工站','涂胶':'点胶工站','打胶':'点胶工站',
  '检测':'检测工站','测试':'检测工站','检查':'检测工站','检验':'检测工站',
  '压接':'压接工站','铆接':'压接工站',
  '贴装':'贴装工站','贴片':'贴装工站',
  '包装':'包装工站','打包':'包装工站',
  '清洗':'清洗工站','清洁':'清洗工站',
  '调试':'调试工站','校准':'调试工站',
};

// 建议措施库 (按失效模式关键词)
export const RECOMMENDATION_MAP = {
  '扭矩|拧紧': '增加扭矩传感器实时反馈,实施力矩校验',
  '漏装|漏贴|漏焊|漏检': '增加防错装置,设置到位传感器',
  '虚焊|焊接': '优化焊接参数,增加SPI/AOI检测',
  '方向|反': '增加防错装置/定位夹具,实施首件确认',
  '划伤|碰撞|变形': '优化工装夹具,增加防护垫,规范搬运方式',
  '误判|漏检': '增加自动检测设备,优化检验标准',
  '参数|设置|调试': '实施参数管理系统,增加互锁机制',
  '标签|包装': '增加扫描比对系统,实施条码管理',
};

export const TRANSPORT_KEYS = {
  stationName: '工站名称',
  operationDesc: '操作步骤描述',
  keyParams: '关键参数',
  materials: '使用物料',
  equipment: '使用设备/工装',
  inspectionMethod: '检验方法',
  specialChar: '特殊特性',
};

// 默认AI API配置
export const DEFAULT_API_CONFIG = {
  provider: 'openai',
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
};
');
console.log('All source files created');
