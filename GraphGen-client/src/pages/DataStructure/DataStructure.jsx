import { useState, useEffect, Component, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, Download, Loader2, AlertCircle, Network, RefreshCcw, Key } from 'lucide-react';
import useTitle from '../../utils/useTitle';
import api from '../../utils/api';
import useHistory from '../../utils/useHistory';
import useApiKeyStatus from '../../utils/useApiKeyStatus';
import { Graphviz } from 'graphviz-react';
import geminiIcon from '../../assets/gemini-icon.png';
import RequirementGraphViewer from '../../components/RequirementGraphViewer';
import { generateRequirementGraph } from '../../utils/requirementGraphClient';
import './DataStructure.css';

/* â”€â”€ Error Boundary to catch Graphviz rendering crashes â”€â”€ */
class GraphvizErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || 'Unknown rendering error' };
  }

  reset = () => this.setState({ hasError: false, errorMsg: '' });

  render() {
    if (this.state.hasError) {
      return (
        <div className="ds-empty-state">
          <div className="ds-empty-icon" style={{ background: 'linear-gradient(135deg, #fecaca, #f87171)' }}>
            <AlertCircle size={44} strokeWidth={1.2} color="#991b1b" />
          </div>
          <p>Diagram rendering failed</p>
          <span style={{ marginBottom: '1rem' }}>
            The generated DOT code couldn't be rendered. Try generating again.
          </span>
          <button
            className="ds-btn-download"
            onClick={() => {
              this.reset();
              if (this.props.onRetry) this.props.onRetry();
            }}
          >
            <RefreshCcw size={15} />
            <span>Try Again</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* â”€â”€ Example prompts â”€â”€ */
const AVAILABLE_MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash' },
  { id: 'gemma-4-26b-a4b-it',    label: 'Gemma 4 26B' },
  { id: 'gemma-4-31b-it',        label: 'Gemma 4 31B' },
  { id: 'gemini-flash-latest',   label: 'Gemini Flash Latest' },
];

const EXAMPLE_PROMPTS = [
  'Create a BST by inserting 50, 30, 70, 20, 40, 60, 80',
  'Visualize a singly linked list with values 10 â†’ 20 â†’ 30 â†’ 40',
  'Show a max-heap with elements [90, 80, 70, 50, 60, 40, 30]',
  'Draw a stack with elements: A, B, C, D (D on top)',
  'Draw an undirected graph with 5 vertices and edges A-B, B-C, C-D, D-E, E-A, A-C',
];

export default function DataStructure() {
  useTitle('Data Structure Visualizer');
  const location = useLocation();
  const navigate = useNavigate();

  const [description, setDescription] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash-lite');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vizCode, setVizCode] = useState('');
  const [requirementGraph, setRequirementGraph] = useState(null);
  const [requirementGraphLoading, setRequirementGraphLoading] = useState(false);
  const [requirementGraphError, setRequirementGraphError] = useState(null);
  const [requirementGraphValidation, setRequirementGraphValidation] = useState(null);
  const [renderKey, setRenderKey] = useState(0);
  const [activeTab, setActiveTab] = useState('diagram');
  const requestIdRef = useRef(0);

  const { saveHistory } = useHistory('data-structure');
  const { hasApiKey } = useApiKeyStatus();

  /* â”€â”€ Restore from History page navigation â”€â”€ */
  useEffect(() => {
    if (location.state?.fromHistory) {
      if (location.state.outputData?.vizCode) {
        setVizCode(location.state.outputData.vizCode);
        setRenderKey((k) => k + 1);
      }
      if (location.state.inputData?.prompt) setDescription(location.state.inputData.prompt);
      // Clear state so refreshing doesn't re-trigger
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please describe the data structure you want to visualize.');
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
    setVizCode('');
    setActiveTab('diagram');

    try {
      const [diagramResult, graphResult] = await Promise.allSettled([
        api.post('/api/diagram/ds', {
          query: description,
          model: selectedModel,
        }),
        generateRequirementGraph({ prompt: description, diagramType: 'Data Structure', category: 'DATA_STRUCTURE' }),
      ]);

      if (requestId !== requestIdRef.current) return;

      if (diagramResult.status === 'fulfilled') {
        const response = diagramResult.value;
        if (response.data.status === 'success' && response.data.data.vizCode) {
          let rawCode = response.data.data.vizCode;

          rawCode = rawCode.replace(/```[a-zA-Z]*\n/gi, '').replace(/```/g, '').trim();

          const graphMatch = rawCode.match(/(?:strict\s+)?(?:di)?graph\s+.*?\{[\s\S]*\}/i);
          if (graphMatch) rawCode = graphMatch[0];

          if (rawCode.includes('<->')) {
            rawCode = rawCode.replace(/\bdigraph\b/i, 'graph');
            rawCode = rawCode.replace(/<->/g, '--');
          }

          if (/^\s*graph\b/i.test(rawCode) && rawCode.includes('->')) {
            rawCode = rawCode.replace(/->/g, '--');
          }

          if (/^\s*digraph\b/i.test(rawCode) && /\s--\s/.test(rawCode)) {
            rawCode = rawCode.replace(/\s--\s/g, ' -> ');
          }

          setVizCode(rawCode);
          setRenderKey((k) => k + 1);
          saveHistory({ prompt: description }, { vizCode: rawCode });
        } else {
          setError('Failed to generate diagram. Please try again.');
        }
      } else {
        console.error('Data Structure error:', diagramResult.reason);
        setError(
          diagramResult.reason.response?.data?.message ||
            'Failed to connect. Please check your API key and try again.'
        );
      }

      if (graphResult.status === 'fulfilled') {
        setRequirementGraph(graphResult.value?.graph || null);
        setRequirementGraphValidation(graphResult.value?.validation || null);
      } else {
        const err = graphResult.reason;
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleDownloadPNG = () => {
    const svgEl = document.querySelector('.ds-viz-container svg');
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
      link.download = 'data-structure.png';
      link.href = pngUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = url;
  };

  return (
    <div className="ds-page">
      <div className="ds-container">
        {/* â•â• LEFT PANE â•â• */}
        <div className="ds-input-pane">

          {/* No API Key Banner */}
          {!hasApiKey && (
            <div className="no-key-banner" onClick={() => navigate('/home')}>
              <Key size={14} />
              <span>No API key configured. <strong>Go to Dashboard</strong> to add your Gemini key.</span>
            </div>
          )}
          <div className="ds-pane-header">
            <div className="ds-title-row">
              <Network size={22} className="ds-title-icon" />
              <h2>Data Structure Visualizer</h2>
            </div>
            <p>
              Describe any data structure and visualize it instantly â€” BST, Linked Lists,
              Heaps, Graphs, Stacks, Queues, and more.
            </p>
          </div>

          {/* Description */}
          <div className="ds-input-group ds-flex-grow">
            <label htmlFor="dsDescription">Describe your data structure</label>
            <div className="prompt-input-wrapper">
              <textarea
                id="dsDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Create a BST by inserting 50, 30, 70, 20, 40, 60, 80"
                className="ds-textarea"
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
                title="Generate Diagram"
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

          {/* Error */}
          {error && (
            <div className="ds-error-message">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* â•â• RIGHT PANE â•â• */}
        <div className="ds-output-pane">
          <div className="ds-pane-header ds-output-header">
            <h2>Generated Diagram</h2>
            {activeTab === 'diagram' && vizCode && (
              <button className="ds-btn-download" onClick={handleDownloadPNG}>
                <Download size={16} />
                <span>Export PNG</span>
              </button>
            )}
          </div>

          <div className="output-tabs">
            <button className={`output-tab ${activeTab === 'diagram' ? 'active' : ''}`} onClick={() => setActiveTab('diagram')}>
              Generated Diagram
            </button>
            <button className={`output-tab ${activeTab === 'requirement-graph' ? 'active' : ''}`} onClick={() => setActiveTab('requirement-graph')}>
              Requirement Graph
            </button>
          </div>

          <div className={`ds-viz-render-area${activeTab === "requirement-graph" ? " rg-dark-canvas" : ""}`}>
            {activeTab === 'diagram' ? (
              loading ? (
                <div className="ds-loading-state">
                  <Loader2 className="ds-spinner-large" />
                  <p>Building your data structureâ€¦</p>
                  <span className="ds-loading-subtext">
                    The AI is analyzing nodes, edges, and relationships. This may take a moment.
                  </span>
                </div>
              ) : vizCode ? (
                <GraphvizErrorBoundary
                  key={renderKey}
                  onRetry={() => setVizCode('')}
                >
                  <div className="ds-viz-container">
                    <Graphviz
                      dot={vizCode}
                      options={{
                        useWorker: false,
                        zoom: true,
                        height: '100%',
                        width: '100%',
                        fit: true,
                      }}
                    />
                  </div>
                </GraphvizErrorBoundary>
              ) : (
                <div className="ds-empty-state">
                  <div className="ds-empty-icon">
                    <Network size={44} strokeWidth={1.2} />
                  </div>
                  <p>No diagram generated yet</p>
                  <span>
                    Describe a data structure on the left and press <strong>Enter</strong> or click the arrow to visualize it.
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
