import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { loadConfig, saveConfig } from '../utils/storage';
import {
  DEFAULT_SOP_FIELDS, DEFAULT_PFMEA_COLUMNS,
  DEFAULT_SEVERITY_RULES, DEFAULT_OCCURRENCE_RULES, DEFAULT_DETECTION_RULES,
  DEFAULT_API_CONFIG
} from '../config/constants';

const AppContext = createContext(null);

const initialState = {
  config: {
    sopFields: [...DEFAULT_SOP_FIELDS],
    pfmeaColumns: [...DEFAULT_PFMEA_COLUMNS],
    severityRules: [...DEFAULT_SEVERITY_RULES],
    occurrenceRules: [...DEFAULT_OCCURRENCE_RULES],
    detectionRules: [...DEFAULT_DETECTION_RULES],
    sopExtPrompt: '',
    pfmeaGenPrompt: '',
    apiConfig: { ...DEFAULT_API_CONFIG },
  },
  sop: {
    rawText: '',
    parsedRows: [],
    confirmed: false,
    prerequisiteText: '',
    prerequisiteSummary: '',
    prerequisiteFileNames: [],
  },
  pfmea: {
    stations: [],
    currentStationIndex: 0,
    generatedCount: 0,
    confirmedStationIds: [],
    allGenerated: false,
  },
  ui: {
    loading: false,
    loadingMessage: '',
    loadingProgress: null,
    loadingCancel: null,
    toast: null,
    error: null,
    currentPage: 'sop',
  },
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: action.payload };

    case 'SET_SOP_RAW_TEXT':
      return { ...state, sop: { ...state.sop, rawText: action.payload } };

    case 'SET_SOP_PARSED_ROWS':
      return { ...state, sop: { ...state.sop, parsedRows: action.payload } };

    case 'UPDATE_SOP_ROW': {
      const rows = [...state.sop.parsedRows];
      rows[action.index] = { ...rows[action.index], ...action.payload };
      return { ...state, sop: { ...state.sop, parsedRows: rows } };
    }

    case 'ADD_SOP_ROW':
      return { ...state, sop: { ...state.sop, parsedRows: [...state.sop.parsedRows, action.payload] } };

    case 'REMOVE_SOP_ROW': {
      const rows = state.sop.parsedRows.filter((_, i) => i !== action.index);
      return { ...state, sop: { ...state.sop, parsedRows: rows } };
    }

    case 'APPEND_PREREQUISITE_FILE': {
      const { text, summary, fileName } = action.payload;
      const sep = state.sop.prerequisiteText ? '\n\n' : '';
      const ssep = state.sop.prerequisiteSummary ? '\n\n---\n\n' : '';
      return {
        ...state,
        sop: {
          ...state.sop,
          prerequisiteText: state.sop.prerequisiteText + sep + text,
          prerequisiteSummary: state.sop.prerequisiteSummary + ssep + summary,
          prerequisiteFileNames: [...state.sop.prerequisiteFileNames, fileName],
        }
      };
    }
    case 'CLEAR_PREREQUISITE':
      return { ...state, sop: { ...state.sop, prerequisiteText: '', prerequisiteSummary: '', prerequisiteFileNames: [] } };

    case 'CONFIRM_SOP':
      return { ...state, sop: { ...state.sop, confirmed: true } };

    case 'BULK_SET_PFMEA': {
      // payload is from generatePfmeaDirectFromFile: [{ stepNo, stationName, ..., rows: [...] }]
      const stations = action.payload.map((s, i) => ({
        id: i,
        stationData: {
          stepNo: String(s.stepNo || (i + 1)),
          stationName: s.stationName || '',
          operationDesc: s.operationDesc || '',
          keyParams: s.keyParams || '',
          materials: s.materials || '',
          equipment: s.equipment || '',
          inspectionMethod: s.inspectionMethod || '',
          specialChar: s.specialChar || "",
        },
        rows: (s.rows || []).map(r => ({
          stepNo: String(s.stepNo || ''),
          station: s.stationName || '',
          processFunction: s.operationDesc || '',
          requirement: String(s.requirement || r.requirement || ''),
          failureMode: String(r.failureMode || ''),
          failureEffect: String(r.failureEffect || ''),
          severity: Number(r.severity) || 0,
          cause: String(r.cause || ''),
          occurrence: Number(r.occurrence) || 0,
          preventionControl: String(r.preventionControl || ''),
          detectionControl: String(r.detectionControl || ''),
          detection: Number(r.detection) || 0,
          so: (Number(r.severity) || 0) * (Number(r.occurrence) || 0),
          rpn: (Number(r.severity) || 0) * (Number(r.occurrence) || 0) * (Number(r.detection) || 0),
          recommendedAction: String(r.recommendedAction || ''),
        })),
        n: 6,
        generated: true,
        confirmed: false,
      }));
      return {
        ...state,
        sop: { ...state.sop, confirmed: true },
        pfmea: { stations, currentStationIndex: 0, confirmedStationIds: [], allGenerated: true },
      };
    }
    case 'SET_PFMEA_STATIONS': {
      const stationRows = action.payload;
      const stations = stationRows.map((row, i) => ({
        id: i,
        stationData: row,
        rows: [],
        confirmed: false,
        n: 6,
        generated: false,
      }));
      return {
        ...state,
        pfmea: { ...state.pfmea, stations, currentStationIndex: 0, confirmedStationIds: [], allGenerated: false },
      };
    }

    case 'SET_STATION_ROWS': {
      const stations = [...state.pfmea.stations];
      stations[action.stationIndex] = {
        ...stations[action.stationIndex],
        rows: action.payload,
        generated: true,
      };
      return { ...state, pfmea: { ...state.pfmea, stations } };
    }

    case 'SET_STATION_N': {
      const stations = [...state.pfmea.stations];
      stations[action.stationIndex].n = action.payload;
      return { ...state, pfmea: { ...state.pfmea, stations } };
    }

    case 'APPEND_STATION_ROWS': {
      const stations = [...state.pfmea.stations];
      const existing = stations[action.stationIndex].rows;
      stations[action.stationIndex].rows = [...existing, ...action.payload];
      return { ...state, pfmea: { ...state.pfmea, stations } };
    }

    case 'UPDATE_PFMEA_ROW': {
      const stations = [...state.pfmea.stations];
      const rows = [...stations[action.stationIndex].rows];
      rows[action.rowIndex] = { ...rows[action.rowIndex], ...action.payload };
      stations[action.stationIndex].rows = rows;
      return { ...state, pfmea: { ...state.pfmea, stations } };
    }

    case 'REMOVE_PFMEA_ROW': {
      const stations = [...state.pfmea.stations];
      stations[action.stationIndex].rows = stations[action.stationIndex].rows.filter((_, i) => i !== action.rowIndex);
      return { ...state, pfmea: { ...state.pfmea, stations } };
    }

    case 'CONFIRM_STATION': {
      const stations = [...state.pfmea.stations];
      stations[action.stationIndex].confirmed = true;
      const confirmed = [...state.pfmea.confirmedStationIds];
      if (!confirmed.includes(action.stationIndex)) confirmed.push(action.stationIndex);
      return { ...state, pfmea: { ...state.pfmea, stations, confirmedStationIds: confirmed } };
    }

    case 'SET_CURRENT_STATION':
      return { ...state, pfmea: { ...state.pfmea, currentStationIndex: action.payload } };

    case 'SET_ALL_GENERATED':
      return { ...state, pfmea: { ...state.pfmea, allGenerated: true } };

    case 'SET_LOADING':
      return { ...state, ui: { ...state.ui, loading: action.payload.loading, loadingMessage: action.payload.message || '', loadingProgress: action.payload.progress || null,
        loadingCancel: action.payload.cancel || null } };

    case 'SET_TOAST':
      return { ...state, ui: { ...state.ui, toast: action.payload } };

    case 'SET_ERROR':
      return { ...state, ui: { ...state.ui, error: action.payload } };

    case 'SET_PAGE':
      return { ...state, ui: { ...state.ui, currentPage: action.payload } };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    const savedConfig = loadConfig();
    return {
      ...initialState,
      config: savedConfig || initialState.config,
    };
  });

  useEffect(() => { saveConfig(state.config); }, [state.config]);


  const setLoading = useCallback((loading, message, progress, cancel) => {
    dispatch({ type: 'SET_LOADING', payload: { loading, message, progress, cancel } });
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    dispatch({ type: 'SET_TOAST', payload: { message, type } });
    setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 3000);
  }, []);

  const showError = useCallback((message) => {
    dispatch({ type: 'SET_ERROR', payload: message });
  }, []);

  const dismissError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const value = { state, dispatch, setLoading, showToast, showError, dismissError };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}


