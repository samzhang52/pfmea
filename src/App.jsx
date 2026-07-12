import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import { useApp } from './store/AppContext';
import NavBar from './components/NavBar';
import SopPage from './pages/SopPage';
import PfmeaPage from './pages/PfmeaPage';
import ConfigPage from './pages/ConfigPage';
import Toast from './components/Toast';
import ErrorModal from './components/ErrorModal';
import LoadingOverlay from './components/LoadingOverlay';

function AppContent() {
  const { state } = useApp();
  const page = state.ui.currentPage;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main>
        {page === 'sop' && <SopPage />}
        {page === 'pfmea' && <PfmeaPage />}
        {page === 'config' && <ConfigPage />}
      </main>
      <Toast />
      <ErrorModal />
      <LoadingOverlay />
    </div>
  );
}

export default function App() {
  return (
    
      <AppProvider>
        <AppContent />
      </AppProvider>
    
  );
}
