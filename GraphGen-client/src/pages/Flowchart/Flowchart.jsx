import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUp, Download, Loader2, AlertCircle, Workflow,
  MessageSquare, Code2, Key,
} from 'lucide-react';
import useTitle from '../../utils/useTitle';
import api from '../../utils/api';
import useHistory from '../../utils/useHistory';
import useApiKeyStatus from '../../utils/useApiKeyStatus';
import { Graphviz } from 'graphviz-react';
import Editor from '@monaco-editor/react';
import geminiIcon from '../../assets/gemini-icon.png';
import RequirementGraphViewer from '../../components/RequirementGraphViewer';
import { generateRequirementGraph } from '../../utils/requirementGraphClient';
import './Flowchart.css';

const AVAILABLE_MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash' },
  { id: 'gemma-4-26b-a4b-it',    label: 'Gemma 4 26B' },
  { id: 'gemma-4-31b-it',        label: 'Gemma 4 31B' },
  { id: 'gemini-flash-latest',   label: 'Gemini Flash Latest' },
];

/* â”€â”€ Prompt-mode examples â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const EXAMPLE_PROMPTS = [
  'Create a flowchart for a user login process with email and password.',
  'Generate a flowchart for an ATM cash withdrawal machine.',
  'Show the algorithm for finding the largest number in an array.',
  'Draw a flowchart for a library book checkout with late fee checking.',
];

/* â”€â”€ Code-mode examples â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const CODE_EXAMPLES = {
  java: `public int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}`,
  python: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr`,
  javascript: `function binarySearch(arr, target) {
    let low = 0, high = arr.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (arr[mid] === target) return mid;
        else if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}`,
};

const LANGUAGES = [
  { id: 'java',       label: 'Java' },
  { id: 'python',     label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
];

export default function Flowchart() {
  useTitle('Flowchart Generator');
  const location = useLocation();
  const navigate = useNavigate();

  /* â”€â”€ shared â”€â”€ */
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [vizCode, setVizCode] = useState('');
  const [requirementGraph, setRequirementGraph] = useState(null);
  const [requirementGraphLoading, setRequirementGraphLoading] = useState(false);
  const [requirementGraphError, setRequirementGraphError] = useState(null);
  const [requirementGraphValidation, setRequirementGraphValidation] = useState(null);
  const [activeTab, setActiveTab] = useState('diagram');
  const requestIdRef = useRef(0);

  /* â”€â”€ history (save only) â”€â”€ */
  const { saveHistory } = useHistory('flowchart');
  const { hasApiKey } = useApiKeyStatus();

  /* â”€â”€ mode: 'prompt' | 'code' â”€â”€ */
  const [mode, setMode] = useState('prompt');

  /* â”€â”€ prompt-mode state â”€â”€ */
  const [description, setDescription] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash-lite');

  /* â”€â”€ code-mode state â”€â”€ */
  const [language, setLanguage]       = useState('python');
  const [code, setCode]               = useState(CODE_EXAMPLES.python);

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const handleGenerate = async () => {
    const query = mode === 'prompt' ? description : code;

    if (!query.trim()) {
      setError(mode === 'prompt'
        ? 'Please describe the process or algorithm.'
        : 'Please paste your code to convert.');
      return;
    }

    const requestId = Date.now() + Math.random();
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    setRequirementGraphLoading(true);
    setRequirementGraphError(null);
    setRequirementGraph(null);
    setRequirementGraphValidation(null);
    setActiveTab('diagram');

    try {
      const payload = { query, model: selectedModel };
      if (mode === 'code') payload.language = language;

      const [diagramResult, graphResult] = await Promise.allSettled([
        api.post('/api/diagram/flow-chart', payload),
        generateRequirementGraph({ prompt: query, diagramType: 'Flowchart', category: 'FLOWCHART' }),
      ]);

      if (requestId !== requestIdRef.current) return;

      if (diagramResult.status === 'fulfilled') {
        const response = diagramResult.value;
        if (response.data.status === 'success' && response.data.data.vizCode) {
          let rawCode = response.data.data.vizCode;
          rawCode = rawCode.replace(/```[a-zA-Z]*\n?/gi, '').replace(/```/g, '').trim();
          const graphMatch = rawCode.match(/(?:strict\s+)?(?:di)?graph\s+[^{]*\{[\s\S]*\}/i);
          if (graphMatch) rawCode = graphMatch[0];
          setVizCode(rawCode);

          const prompt = mode === 'prompt' ? description : code;
          saveHistory({ prompt, mode, language: mode === 'code' ? language : undefined }, { vizCode: rawCode });
        } else {
          setError('Failed to generate diagram. Please try again.');
        }
      } else {
        const err = diagramResult.reason;
        console.error('Flowchart error:', err);
        setError(
          err.response?.data?.message ||
          'Failed to connect. Please check your API key and try again.'
        );
      }

      if (graphResult.status === 'fulfilled') {
        setRequirementGraph(graphResult.value?.graph || null);
        setRequirementGraphValidation(graphResult.value?.validation || null);
      } else {
        const err = graphResult.reason;
        console.error('Requirement graph error:', err);
        setRequirementGraphError(err.response?.data?.message || err.message || 'Requirement graph generation failed.');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRequirementGraphLoading(false);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && mode === 'prompt') {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleDownloadPNG = () => {
    const svgEl = document.querySelector('.fc-viz-container svg');
    if (!svgEl) return;

    const viewBox = svgEl.viewBox.baseVal;
    let width = viewBox.width || svgEl.getBoundingClientRect().width;
    let height = viewBox.height || svgEl.getBoundingClientRect().height;

    const scale = 3;
    width *= scale;
    height *= scale;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const DOMURL = window.URL || window.webkitURL || window;
    const url = DOMURL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      DOMURL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'flowchart.png';
      link.href = pngUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = url;
  };

  /* â”€â”€ Restore from History page navigation â”€â”€ */
  useEffect(() => {
    if (location.state?.fromHistory) {
      if (location.state.outputData?.vizCode) {
        setVizCode(location.state.outputData.vizCode);
      }
      if (location.state.inputData?.prompt) {
        if (location.state.inputData.mode === 'code') {
          setMode('code');
          setCode(location.state.inputData.prompt);
          if (location.state.inputData.language) setLanguage(location.state.inputData.language);
        } else {
          setMode('prompt');
          setDescription(location.state.inputData.prompt);
        }
      }
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const selectedLang = LANGUAGES.find(l => l.id === language);

  return (
    <div className="fc-page">
      <div className="fc-container">

        {/* â•â• LEFT PANE â•â• */}
        <div className="fc-input-pane">

          {/* No API Key Banner */}
          {!hasApiKey && (
            <div className="no-key-banner" onClick={() => navigate('/home')}>
              <Key size={14} />
              <span>No API key configured. <strong>Go to Dashboard</strong> to add your Gemini key.</span>
            </div>
          )}

          {/* Header */}
          <div className="fc-pane-header">
            <div className="fc-title-row">
              <Workflow size={22} className="fc-title-icon" />
              <h2>Flowchart Generator</h2>
            </div>
            <p>Convert code or text descriptions into visual flowcharts instantly.</p>
          </div>

          {/* Model Selector */}
          {/* (now rendered inline inside the prompt-input-wrapper below) */}

          {/* Mode Toggle */}
          <div className="fc-mode-toggle">
            <button
              className={`fc-mode-btn ${mode === 'prompt' ? 'fc-mode-active' : ''}`}
              onClick={() => setMode('prompt')}
            >
              <MessageSquare size={15} />
              Prompt
            </button>
            <button
              className={`fc-mode-btn ${mode === 'code' ? 'fc-mode-active' : ''}`}
              onClick={() => setMode('code')}
            >
              <Code2 size={15} />
              Code
            </button>
          </div>

          {/* â”€â”€ PROMPT MODE â”€â”€ */}
          {mode === 'prompt' && (
            <>
              <div className="fc-input-group fc-flex-grow">
                <label htmlFor="fcDescription">Describe your process or algorithm</label>
                <div className="prompt-input-wrapper">
                  <textarea
                    id="fcDescription"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. Create a flowchart for a user login process with credential checks..."
                    className="fc-textarea"
                  />
                  <select
                    className="model-select-inline"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    title="Select AI model"
                  >
                    {AVAILABLE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <button 
                    className="prompt-send-btn" 
                    onClick={handleGenerate}
                    disabled={loading || !description.trim()}
                    title="Generate Flowchart"
                  >
                    {loading ? (
                      <Loader2 className="spinner" size={18} />
                    ) : (
                      <ArrowUp size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* Example Chips */}
              <div className="prompt-examples">
                <span className="prompt-examples-label">Try an example:</span>
                <div className="prompt-examples-list">
                  {EXAMPLE_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      className="prompt-example-chip"
                      onClick={() => setDescription(prompt)}
                      title={prompt}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* â”€â”€ CODE MODE â”€â”€ */}
          {mode === 'code' && (
            <>
              {/* Code Editor */}
              <div className="fc-input-group fc-flex-grow" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <label style={{ marginBottom: 0 }}>Paste your {selectedLang.label} code</label>
                  <select 
                    value={language} 
                    onChange={e => setLanguage(e.target.value)}
                    className="fc-input"
                    style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang.id} value={lang.id}>{lang.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', minHeight: '200px', backgroundColor: '#1e1e1e' }}>
                  <Editor
                    height="100%"
                    language={language}
                    theme="vs-dark"
                    value={code}
                    onChange={(value) => setCode(value || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineHeight: 22,
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      padding: { top: 12, bottom: 12 }
                    }}
                  />
                </div>
              </div>

              {/* Inline send + model for code mode */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                <select
                  className="model-select-inline"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  title="Select AI model"
                  style={{ position: 'static' }}
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <button 
                  className="prompt-send-btn prompt-send-btn-standalone" 
                  onClick={handleGenerate}
                  disabled={loading || !code.trim()}
                  title="Generate Flowchart"
                >
                {loading ? (
                  <Loader2 className="spinner" size={18} />
                ) : (
                  <ArrowUp size={18} />
                )}
              </button>
              </div>
            </>
          )}


          {/* Error */}
          {error && (
            <div className="fc-error-message">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* â•â• RIGHT PANE â•â• */}
        <div className="fc-output-pane">
          <div className="fc-pane-header fc-output-header">
            <h2>Generated Flowchart</h2>
            {vizCode && (
              <button className="fc-btn-download" onClick={handleDownloadPNG}>
                <Download size={16} /><span>Export PNG</span>
              </button>
            )}
          </div>

          <div className="fc-output-tabs">
            <button className={`fc-output-tab ${activeTab === 'diagram' ? 'active' : ''}`} onClick={() => setActiveTab('diagram')}>
              Generated Diagram
            </button>
            <button className={`fc-output-tab ${activeTab === 'requirement-graph' ? 'active' : ''}`} onClick={() => setActiveTab('requirement-graph')}>
              Requirement Graph
            </button>
          </div>

          <div className={`fc-viz-render-area${activeTab === "requirement-graph" ? " rg-dark-canvas" : ""}`}>
            {activeTab === 'diagram' ? (
              loading ? (
                <div className="fc-loading-state">
                  <Loader2 className="fc-spinner-large" />
                  <p>Building your flowchartâ€¦</p>
                  <span className="fc-loading-subtext">
                    The AI is tracing logic flows, decisions, and loops. This may take a moment.
                  </span>
                </div>
              ) : vizCode ? (
                <div className="fc-viz-container">
                  <Graphviz
                    dot={vizCode}
                    options={{ zoom: true, height: '100%', width: '100%', fit: true }}
                  />
                </div>
              ) : (
                <div className="fc-empty-state">
                  <div className="fc-empty-icon">
                    <Workflow size={44} strokeWidth={1.2} />
                  </div>
                  <p>No flowchart yet</p>
                  <span>
                    {mode === 'prompt'
                      ? 'Describe an algorithm or process on the left and press Enter.'
                      : 'Paste your Java, Python, or JavaScript code and click the arrow.'}
                  </span>
                </div>
              )
            ) : (
              <RequirementGraphViewer
                graph={requirementGraph}
                loading={requirementGraphLoading}
                error={requirementGraphError}
                validation={requirementGraphValidation}
                onRetry={handleGenerate}
              />
            )}
          </div>
          <div className="powered-by-gemini">
            powered by <img src={geminiIcon} alt="Gemini" /> gemini
          </div>
        </div>

      </div>
    </div>
  );
}
