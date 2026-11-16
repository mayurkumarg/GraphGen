import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUp, Download, Loader2, AlertCircle, Boxes, Key } from 'lucide-react';
import useTitle from '../../utils/useTitle';
import api from '../../utils/api';
import useHistory from '../../utils/useHistory';
import useApiKeyStatus from '../../utils/useApiKeyStatus';
import { Graphviz } from 'graphviz-react';
import geminiIcon from '../../assets/gemini-icon.png';
import RequirementGraphViewer from '../../components/RequirementGraphViewer';
import { generateRequirementGraph } from '../../utils/requirementGraphClient';
import './UMLDiagram.css';

const AVAILABLE_MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash' },
  { id: 'gemma-4-26b-a4b-it',    label: 'Gemma 4 26B' },
  { id: 'gemma-4-31b-it',        label: 'Gemma 4 31B' },
  { id: 'gemini-flash-latest',   label: 'Gemini Flash Latest' },
];

const EXAMPLE_PROMPTS = [
  "Class diagram for an e-commerce system with User, Product, Cart, and Order",
  "Sequence diagram showing user login flow with frontend, backend, and database",
  "Use case diagram for an online banking system",
  "Activity diagram for an order processing workflow",
  "State diagram for a bug tracking system ticket lifecycle",
];

export default function UMLDiagram() {
  useTitle('UML Diagram Generator');
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
  const [activeTab, setActiveTab] = useState('diagram');
  const requestIdRef = useRef(0);

  const { saveHistory } = useHistory('uml-diagram');
  const { hasApiKey } = useApiKeyStatus();

  /* â”€â”€ Restore from History page navigation â”€â”€ */
  useEffect(() => {
    if (location.state?.fromHistory) {
      if (location.state.outputData?.vizCode) setVizCode(location.state.outputData.vizCode);
      if (location.state.inputData?.prompt) setDescription(location.state.inputData.prompt);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  /* â”€â”€ Sanitize DOT code from common AI mistakes â”€â”€ */
  const sanitizeDotCode = (code) => {
    let sanitized = code;

    // Fix invalid edge operators: -o, --, <- all become ->
    // Match patterns like `NodeA -o NodeB` or `NodeA -- NodeB` (outside of quoted strings)
    sanitized = sanitized.replace(/(\w+["']?\s+)-o(\s+)/g, '$1->$2');
    sanitized = sanitized.replace(/(\w+["']?\s+)--(\s+)/g, '$1->$2');
    sanitized = sanitized.replace(/(\w+["']?\s+)<-(\s+)/g, '$1->$2');

    // Also handle quoted node names: "Node A" -o "Node B"
    sanitized = sanitized.replace(/(["']\s*)-o(\s*)/g, '$1->$2');
    sanitized = sanitized.replace(/(["']\s*)--(\s*)/g, '$1->$2');
    sanitized = sanitized.replace(/(["']\s*)<-(\s*)/g, '$1->$2');

    // Fix \n inside record labels to \l (but not \\n which is already escaped)
    // Only replace \n that appears inside label="..." of record-shaped nodes
    sanitized = sanitized.replace(/(label\s*=\s*"[^"]*")/g, (match) => {
      return match.replace(/\\n/g, '\\l');
    });

    return sanitized;
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please provide a UML description.');
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
      const [diagramResult, graphResult] = await Promise.allSettled([
        api.post('/api/diagram/uml', {
          query: description,
          model: selectedModel,
        }),
        generateRequirementGraph({ prompt: description, diagramType: 'UML Diagram', category: 'UML' }),
      ]);

      if (requestId !== requestIdRef.current) return;

      if (diagramResult.status === 'fulfilled') {
        const response = diagramResult.value;
        if (response.data.status === 'success' && response.data.data.vizCode) {
          let rawCode = response.data.data.vizCode;

          rawCode = rawCode.replace(/```[a-zA-Z]*\n/gi, '').replace(/```/g, '').trim();

          const graphMatch = rawCode.match(/(?:strict\s+)?(?:di)?graph\s+.*?\{[\s\S]*\}/i);
          if (graphMatch) {
            rawCode = graphMatch[0];
          }

          rawCode = sanitizeDotCode(rawCode);
          setVizCode(rawCode);
          saveHistory({ prompt: description }, { vizCode: rawCode });
        } else {
          setError('Failed to generate diagram. Invalid response format.');
        }
      } else {
        console.error('Error generating UML Diagram:', diagramResult.reason);
        setError(
          diagramResult.reason.response?.data?.message ||
            'Failed to connect to the server. Please check your API key and try again.'
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
    const svgElement = document.querySelector('.uml-viz-container svg');
    if (!svgElement) return;

    const viewBox = svgElement.viewBox.baseVal;
    let width = viewBox.width || svgElement.getBoundingClientRect().width;
    let height = viewBox.height || svgElement.getBoundingClientRect().height;

    const scale = 3;
    width *= scale;
    height *= scale;

    const svgData = new XMLSerializer().serializeToString(svgElement);
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
      link.download = 'uml-diagram.png';
      link.href = pngUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = url;
  };

  return (
    <div className="uml-page">
      <div className="uml-container">
        {/* Left Pane - Inputs */}
        <div className="uml-input-pane">

          {/* No API Key Banner */}
          {!hasApiKey && (
            <div className="no-key-banner" onClick={() => navigate('/home')}>
              <Key size={14} />
              <span>No API key configured. <strong>Go to Dashboard</strong> to add your Gemini key.</span>
            </div>
          )}
          <div className="uml-pane-header">
            <div className="uml-title-row">
              <Boxes size={22} className="uml-title-icon" />
              <h2>UML Diagram</h2>
            </div>
            <p>
              Describe a system, workflow, or interaction and generate its UML diagram
              automatically. Supports Class, Sequence, Use Case, Activity, and State diagrams.
            </p>
          </div>

          <div className="uml-input-group uml-flex-grow">
            <label htmlFor="umlDescription">Diagram Description</label>
            <div className="prompt-input-wrapper">
              <textarea
                id="umlDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Class diagram for an e-commerce system with User, Product, Cart, and Order..."
                className="uml-textarea"
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
                title="Generate UML Diagram"
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

          {error && (
            <div className="uml-error-message">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right Pane - Output */}
        <div className="uml-output-pane">
          <div className="uml-pane-header uml-output-header">
            <h2>Generated Diagram</h2>
            {activeTab === 'diagram' && vizCode && (
              <button className="uml-btn-download" onClick={handleDownloadPNG} title="Download PNG">
                <Download size={18} />
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

          <div className={`uml-viz-render-area${activeTab === "requirement-graph" ? " rg-dark-canvas" : ""}`}>
            {activeTab === 'diagram' ? (
              loading ? (
                <div className="uml-loading-state">
                  <Loader2 className="uml-spinner-large" />
                  <p>Analyzing description & generating UML diagram...</p>
                  <span className="uml-loading-subtext">
                    The AI is determining the diagram type and building the structure. This may take a
                    moment.
                  </span>
                </div>
              ) : vizCode ? (
                <div className="uml-viz-container">
                  <Graphviz
                    dot={vizCode}
                    options={{ zoom: true, height: '100%', width: '100%', fit: true }}
                  />
                </div>
              ) : (
                <div className="uml-empty-state">
                  <div className="uml-empty-icon">
                    <Boxes size={48} strokeWidth={1} />
                  </div>
                  <p>No diagram generated yet.</p>
                  <span>
                    Describe a system or process on the left and press <strong>Enter</strong> or click the arrow to generate.
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
