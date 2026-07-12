import { useApp } from '../store/AppContext';

export default function Toast() {
  const { state } = useApp();
  const toast = state.ui.toast;
  if (!toast) return null;

  const colors = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500 text-black',
    error: 'bg-red-500',
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm ${colors[toast.type] || colors.info}`}>
        {toast.message}
      </div>
    </div>
  );
}
