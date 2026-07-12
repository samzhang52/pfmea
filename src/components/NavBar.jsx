import { useApp } from '../store/AppContext';
import { Upload, FileText, Settings } from 'lucide-react';
import UsageGuide from './UsageGuide';

const pages = [
  { key: 'sop', label: '文件解析', icon: Upload },
  { key: 'pfmea', label: 'PFMEA生成', icon: FileText },
  { key: 'config', label: '配置中心', icon: Settings },
];

export default function NavBar() {
  const { state, dispatch } = useApp();
  const current = state.ui.currentPage;

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-1">
      {pages.map(p => (
        <button
          key={p.key}
          onClick={() => dispatch({ type: 'SET_PAGE', payload: p.key })}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            current === p.key
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <p.icon size={16} />
          {p.label}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-1">
        <UsageGuide />
        <div className="text-xs text-gray-400">智能PFMEA生成器 v1.0</div>
      </div>
    </nav>
  );
}
