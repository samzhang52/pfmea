import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { Loader2, X } from 'lucide-react';

export default function LoadingOverlay() {
  const { state, dispatch, setLoading } = useApp();
  const { loading, loadingMessage, loadingProgress, loadingCancel } = state.ui;
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (loading) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading]);

  if (!loading) return null;

  const handleCancel = () => {
    if (loadingCancel) {
      loadingCancel();
    } else {
      setLoading(false, '');
    }
  };

  const progress = loadingProgress;
  const percentage = progress ? Math.round((progress.completed / progress.total) * 100) : null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-8 text-center">
        <Loader2 size={40} className="animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-gray-700 font-medium mb-2">{loadingMessage || '正在处理...'}</p>

        {progress && (
          <div className="mb-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
              <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${percentage}%` }}></div>
            </div>
            <p className="text-xs text-gray-500">
              已处理 {progress.completed}/{progress.total} 段，提取 {progress.rows} 个工站 ({percentage}%)
            </p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">已等待 {elapsed} 秒，请耐心等待...</p>

        <button onClick={handleCancel} className="btn-secondary mt-4 text-sm">
          <X size={14} className="inline mr-1" />取消操作
        </button>
      </div>
    </div>
  );
}
