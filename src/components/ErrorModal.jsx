import { useApp } from '../store/AppContext';
import { X } from 'lucide-react';

export default function ErrorModal() {
  const { state, dismissError } = useApp();
  const error = state.ui.error;
  if (!error) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <X size={16} className="text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">操作失败</h3>
          </div>
          <button onClick={dismissError} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed">{error}</p>
        <div className="mt-6 flex justify-end">
          <button onClick={dismissError} className="btn-primary">知道了</button>
        </div>
      </div>
    </div>
  );
}
