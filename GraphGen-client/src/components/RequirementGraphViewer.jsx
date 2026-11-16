import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import ForceGraph2D from 'react-force-graph-2d';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

// ── Canonical Node Colors ─────────────────────────────────────
const NODE_COLORS = {
  REQUIREMENT: '#38bdf8', // sky blue
  ACTOR:       '#60a5fa', // blue
  ENTITY:      '#34d399', // emerald green
  ACTION:      '#fbbf24', // amber
  CONDITION:   '#c084fc', // purple
  CONSTRAINT:  '#f472b6', // pink
  EVENT:       '#fb923c', // orange
  STATE:       '#facc15', // yellow
};

const DEFAULT_COLOR = '#94a3b8';

function getNodeRadius(node) {
  if (node.type === 'REQUIREMENT') return 12;
  if (node.type === 'ACTOR' || node.type === 'ENTITY') return 10;
  return 8;
}

/** Rounded-rect path utility for canvas */
function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Control Button Styles ──────────────────────────────────────
const controlBtnStyle = {
  background: '#1e293b',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  borderRadius: 7,
  color: '#f8fafc',
  padding: '0.4rem 0.65rem',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  userSelect: 'none',
};

const expandBtnStyle = {
  background: 'rgba(56, 189, 248, 0.14)',
  border: '1px solid rgba(56, 189, 248, 0.5)',
  borderRadius: 7,
  color: '#38bdf8',
  padding: '0.4rem 0.85rem',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const exitBtnStyle = {
  background: '#dc2626',
  border: '1px solid #ef4444',
  borderRadius: 7,
  color: '#ffffff',
  padding: '0.42rem 0.95rem',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  fontSize: '0.82rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 2px 10px rgba(220, 38, 38, 0.45)',
  transition: 'all 0.15s ease',
};

function RequirementGraphViewer({ graph, loading, error, validation, onRetry }) {
  const inlineFgRef = useRef(null);
  const modalFgRef = useRef(null);
  const inlineContainerRef = useRef(null);
  const modalContainerRef = useRef(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [inlineDim, setInlineDim] = useState({ width: 600, height: 460 });
  const [modalDim, setModalDim] = useState({ width: 1200, height: 750 });
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // ── ResizeObserver for Inline Container ──────────────────────
  useEffect(() => {
    const el = inlineContainerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        setInlineDim({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    window.addEventListener('resize', updateSize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // ── ResizeObserver for Modal Container ───────────────────────
  useEffect(() => {
    if (!isExpanded) return;
    const el = modalContainerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        setModalDim({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);

    const timer = setTimeout(updateSize, 120);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [isExpanded]);

  // ── Lock Background Scroll & Listen for Escape ───────────────
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setIsExpanded(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isExpanded]);

  // ── Build Canonical Graph Data ───────────────────────────────
  const { nodes, links, nodeMap } = useMemo(() => {
    const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const rawEdges = Array.isArray(graph?.edges) ? graph.edges : [];

    const nMap = new Map();
    const nList = rawNodes.map((node, index) => {
      const id = String(node.id || `node-${index}`);
      const entry = {
        ...node,
        id,
        name: node.name || node.id || `Node ${index + 1}`,
        color: NODE_COLORS[node.type] || DEFAULT_COLOR,
        val: node.type === 'REQUIREMENT' ? 18 : node.type === 'ACTOR' || node.type === 'ENTITY' ? 14 : 11,
      };
      nMap.set(id, entry);
      return entry;
    });

    const lList = [];
    const seenEdgeKeys = new Set();

    rawEdges.forEach((edge, index) => {
      const sId = String(typeof edge.source === 'object' ? edge.source?.id : edge.source);
      const tId = String(typeof edge.target === 'object' ? edge.target?.id : edge.target);

      if (sId && tId && sId !== tId && nMap.has(sId) && nMap.has(tId)) {
        const edgeKey = `${sId}->${tId}:${edge.type || 'rel'}`;
        if (!seenEdgeKeys.has(edgeKey)) {
          seenEdgeKeys.add(edgeKey);
          lList.push({
            ...edge,
            id: edge.id || `edge-${index}`,
            source: sId,
            target: tId,
            label: edge.label || edge.type || 'relates',
            color: '#64748b',
          });
        }
      }
    });

    return { nodes: nList, links: lList, nodeMap: nMap };
  }, [graph]);

  // ── Topology-Accurate Statistics & Isolated Node Detection ───
  const stats = useMemo(() => {
    const connectedNodeIds = new Set();
    links.forEach((link) => {
      const s = String(typeof link.source === 'object' ? link.source.id : link.source);
      const t = String(typeof link.target === 'object' ? link.target.id : link.target);
      connectedNodeIds.add(s);
      connectedNodeIds.add(t);
    });

    const isolatedNodesList = nodes.filter((n) => !connectedNodeIds.has(String(n.id)));
    const isolatedCount = isolatedNodesList.length;

    return {
      totalNodes: nodes.length,
      totalEdges: links.length,
      isolatedNodes: isolatedCount,
      isolatedNodeNames: isolatedNodesList.map((n) => n.name || n.id),
      unmappedRequirements: validation?.statistics?.unmappedRequirements || 0,
    };
  }, [nodes, links, validation]);

  const isValid = stats.isolatedNodes === 0 && (validation?.isValid !== false);

  // ── Fresh Clones for Separate Canvas Simulations ─────────────
  // D3 mutates link.source and link.target into node references.
  // Supplying fresh objects with string IDs prevents cross-canvas pointer pollution.
  const inlineGraphData = useMemo(() => {
    return {
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({
        ...l,
        source: String(typeof l.source === 'object' ? l.source.id : l.source),
        target: String(typeof l.target === 'object' ? l.target.id : l.target),
      })),
    };
  }, [nodes, links]);

  const modalGraphData = useMemo(() => {
    return {
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({
        ...l,
        source: String(typeof l.source === 'object' ? l.source.id : l.source),
        target: String(typeof l.target === 'object' ? l.target.id : l.target),
      })),
    };
  }, [nodes, links, isExpanded]);

  // ── Force Configuration ──────────────────────────────────────
  const configureForces = useCallback((fgInstance) => {
    if (!fgInstance) return;
    try {
      fgInstance.d3Force('charge')?.strength(-400);
      fgInstance.d3Force('link')?.distance(90).strength(0.45);
      fgInstance.d3Force('collision')?.radius((node) => getNodeRadius(node) + 24);
    } catch (_) {}
  }, []);

  // ── Fit-to-Screen Helper ─────────────────────────────────────
  const fitView = useCallback((ref, padding = 50, duration = 400) => {
    if (ref.current && nodes.length > 0) {
      configureForces(ref.current);
      ref.current.zoomToFit(duration, padding);
    }
  }, [nodes.length, configureForces]);

  // Auto-fit inline view on data change / resize
  useEffect(() => {
    if (!isExpanded && nodes.length > 0 && inlineDim.width > 0) {
      const t = setTimeout(() => fitView(inlineFgRef, 50, 400), 220);
      return () => clearTimeout(t);
    }
  }, [nodes, inlineDim, isExpanded, fitView]);

  // Auto-fit modal view when opened
  useEffect(() => {
    if (isExpanded && nodes.length > 0 && modalDim.width > 0) {
      const t = setTimeout(() => fitView(modalFgRef, 60, 400), 260);
      return () => clearTimeout(t);
    }
  }, [isExpanded, nodes, modalDim, fitView]);

  // ── Zoom Controls ────────────────────────────────────────────
  const handleZoom = (ref, factor) => {
    if (!ref.current) return;
    const currentZoom = ref.current.zoom();
    ref.current.zoom(currentZoom * factor, 300);
  };

  const handleReset = (ref) => {
    if (!ref.current) return;
    ref.current.centerAt(0, 0, 300);
    setTimeout(() => fitView(ref, 50, 400), 160);
  };

  // ── Selection State ──────────────────────────────────────────
  const selectedNode = nodeMap.get(String(selectedNodeId)) || null;
  const selectedEdge = links.find((e) => e.id === selectedEdgeId) || null;

  const clearSelection = () => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const edgeSrcId = selectedEdge
    ? (typeof selectedEdge.source === 'object' ? selectedEdge.source?.id : selectedEdge.source) || ''
    : '';
  const edgeTgtId = selectedEdge
    ? (typeof selectedEdge.target === 'object' ? selectedEdge.target?.id : selectedEdge.target) || ''
    : '';

  // ── Canvas Node Rendering ────────────────────────────────────
  const renderNode = useCallback((node, ctx, globalScale) => {
    const isSelected = node.id === selectedNodeId;
    const isHovered = node.id === hoveredNodeId;
    const radius = getNodeRadius(node);

    // Glow halo on selection / hover
    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI, false);
      ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.18)';
      ctx.fill();
    }

    // Node body
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color || DEFAULT_COLOR;
    ctx.fill();
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.strokeStyle = isSelected ? '#38bdf8' : '#ffffff';
    ctx.stroke();

    // Node label with pill background
    if (globalScale < 0.35) return;
    const label = node.name || node.id || '';
    const fontSize = Math.max(10, Math.min(13, 11 / globalScale));
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const textX = node.x;
    const textY = node.y + radius + fontSize + 4;
    const padX = 6;
    const padY = 2;

    ctx.fillStyle = 'rgba(5, 10, 22, 0.92)';
    drawRoundRect(
      ctx,
      textX - textWidth / 2 - padX,
      textY - fontSize + 1,
      textWidth + padX * 2,
      fontSize + padY * 2,
      4
    );
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = isSelected ? '#38bdf8' : '#f8fafc';
    ctx.fillText(label, textX, textY);
  }, [selectedNodeId, hoveredNodeId]);

  // ── Canvas Link Label Rendering ──────────────────────────────
  const renderLink = useCallback((link, ctx, globalScale) => {
    if (globalScale < 0.45) return;
    const label = link.label || link.type || '';
    if (!label) return;

    const src = link.source;
    const tgt = link.target;
    if (!src?.x || !tgt?.x) return;

    const mx = (src.x + tgt.x) * 0.5;
    const my = (src.y + tgt.y) * 0.5;

    const fontSize = Math.max(8.5, Math.min(11, 9.5 / globalScale));
    ctx.font = `${fontSize}px Inter, sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const boxWidth = textWidth + 8;
    const boxHeight = fontSize + 4;

    ctx.fillStyle = 'rgba(10, 16, 32, 0.88)';
    drawRoundRect(ctx, mx - boxWidth / 2, my - boxHeight / 2, boxWidth, boxHeight, 3);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = link.id === selectedEdgeId ? '#38bdf8' : '#cbd5e1';
    ctx.fillText(label, mx, my);
  }, [selectedEdgeId]);

  // ── Legend Element ───────────────────────────────────────────
  const LegendBar = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      {Object.entries(NODE_COLORS).map(([type, color]) => (
        <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#94a3b8' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span>{type}</span>
        </span>
      ))}
    </div>
  );

  // ── Toolbar Element ──────────────────────────────────────────
  const Toolbar = ({ fgRef, expanded = false }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        padding: '0.65rem 1.15rem',
        borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
        background: '#0d1527',
        zIndex: 20,
        flexShrink: 0,
      }}
    >
      {/* Title & Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <Layers size={18} color="#38bdf8" />
        <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: expanded ? '1.02rem' : '0.92rem' }}>
          {expanded ? 'Requirement Graph — Expanded Workspace' : 'Requirement Graph'}
        </span>
        <span
          style={{
            fontSize: '0.74rem',
            background: '#1e293b',
            color: '#94a3b8',
            padding: '2px 8px',
            borderRadius: 12,
            fontWeight: 500,
          }}
        >
          {stats.totalNodes} nodes · {stats.totalEdges} edges
        </span>
        <span
          style={{
            fontSize: '0.74rem',
            padding: '2px 9px',
            borderRadius: 12,
            background: isValid ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
            color: isValid ? '#34d399' : '#fbbf24',
            fontWeight: 600,
          }}
        >
          {isValid ? 'Valid ✓' : `Invalid (${stats.isolatedNodes} isolated) ⚠`}
        </span>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          style={controlBtnStyle}
          onClick={() => handleZoom(fgRef, 1.25)}
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          style={controlBtnStyle}
          onClick={() => handleZoom(fgRef, 0.8)}
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          style={controlBtnStyle}
          onClick={() => fitView(fgRef, expanded ? 60 : 50, 400)}
          title="Fit to Screen"
        >
          <Maximize2 size={15} />
        </button>
        <button
          type="button"
          style={controlBtnStyle}
          onClick={() => handleReset(fgRef)}
          title="Reset View"
        >
          <RotateCcw size={15} />
        </button>

        {/* Expand / Minimize Exit Button */}
        {expanded ? (
          <button
            type="button"
            style={exitBtnStyle}
            onClick={() => setIsExpanded(false)}
            title="Exit Expanded View (Esc)"
          >
            <Minimize2 size={16} />
            <span>Minimize</span>
            <span
              style={{
                fontSize: '0.68rem',
                opacity: 0.85,
                padding: '1px 5px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 4,
              }}
            >
              Esc
            </span>
          </button>
        ) : (
          <button
            type="button"
            style={expandBtnStyle}
            onClick={() => setIsExpanded(true)}
            title="Expand Graph into Full Workspace"
          >
            <Maximize2 size={15} />
            <span>Expand Graph</span>
          </button>
        )}
      </div>
    </div>
  );

  // ── Sidebar for Expanded Workspace ───────────────────────────
  const Sidebar = () => (
    <div
      style={{
        width: 350,
        minWidth: 280,
        maxWidth: 400,
        background: '#090f1e',
        borderLeft: '1px solid rgba(148, 163, 184, 0.16)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 16,
        overflowY: 'auto',
      }}
    >
      {/* Graph Statistics */}
      <div style={{ background: '#0d1527', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, fontWeight: 700, color: '#f8fafc', fontSize: '0.88rem' }}>
          <Info size={16} color="#38bdf8" />
          <span>Graph Statistics</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: '#131d31', borderRadius: 8, padding: '8px 12px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Nodes</span>
            <strong style={{ color: '#f8fafc', fontSize: '1.2rem' }}>{stats.totalNodes}</strong>
          </div>
          <div style={{ background: '#131d31', borderRadius: 8, padding: '8px 12px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Edges</span>
            <strong style={{ color: '#f8fafc', fontSize: '1.2rem' }}>{stats.totalEdges}</strong>
          </div>
          <div style={{ background: '#131d31', borderRadius: 8, padding: '8px 12px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Isolated</span>
            <strong style={{ color: stats.isolatedNodes > 0 ? '#fbbf24' : '#34d399', fontSize: '1.2rem' }}>
              {stats.isolatedNodes}
            </strong>
          </div>
          <div style={{ background: '#131d31', borderRadius: 8, padding: '8px 12px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Unmapped</span>
            <strong style={{ color: stats.unmappedRequirements > 0 ? '#fbbf24' : '#34d399', fontSize: '1.2rem' }}>
              {stats.unmappedRequirements}
            </strong>
          </div>
        </div>
      </div>

      {/* Validation Status */}
      <div style={{ background: '#0d1527', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, fontWeight: 700, color: '#f8fafc', fontSize: '0.88rem' }}>
          {isValid ? <CheckCircle2 size={16} color="#34d399" /> : <AlertTriangle size={16} color="#fbbf24" />}
          <span>Validation</span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: 10,
              background: isValid ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
              color: isValid ? '#34d399' : '#fbbf24',
              fontWeight: 600,
            }}
          >
            {isValid ? 'Valid' : 'Invalid'}
          </span>
        </div>

        {/* Isolated node warnings */}
        {stats.isolatedNodes > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.76rem', marginBottom: 4 }}>
              Isolated Nodes Detected
            </div>
            <ul style={{ paddingLeft: 16, margin: 0, color: '#fde68a', fontSize: '0.74rem', lineHeight: 1.45 }}>
              {stats.isolatedNodeNames.map((name, i) => (
                <li key={i}>Node {name} has no incident edges.</li>
              ))}
            </ul>
          </div>
        )}

        {/* Validation errors */}
        {validation?.errors?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: '#f87171', fontWeight: 600, fontSize: '0.76rem', marginBottom: 4 }}>Errors</div>
            <ul style={{ paddingLeft: 16, margin: 0, color: '#fca5a5', fontSize: '0.74rem', lineHeight: 1.45 }}>
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Validation warnings */}
        {validation?.warnings?.length > 0 && (
          <div>
            <div style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.76rem', marginBottom: 4 }}>Warnings</div>
            <ul style={{ paddingLeft: 16, margin: 0, color: '#fde68a', fontSize: '0.74rem', lineHeight: 1.45 }}>
              {validation.warnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        )}

        {stats.isolatedNodes === 0 && !validation?.errors?.length && !validation?.warnings?.length && (
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
            All nodes are connected and satisfy schema requirements.
          </div>
        )}
      </div>

      {/* Selection Details Inspector */}
      <div style={{ background: '#0d1527', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 12, padding: 14, flex: 1, minHeight: 180 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.88rem' }}>Selection Details</span>
          {(selectedNode || selectedEdge) && (
            <button
              onClick={clearSelection}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
              title="Clear selection"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {selectedNode ? (
          <div style={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.55 }}>
            <div style={{ fontWeight: 700, color: selectedNode.color, fontSize: '0.95rem', marginBottom: 6 }}>
              {selectedNode.name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 8px', marginBottom: 8 }}>
              <span style={{ color: '#94a3b8' }}>Type:</span>
              <span style={{ color: selectedNode.color, fontWeight: 600 }}>{selectedNode.type}</span>
              <span style={{ color: '#94a3b8' }}>ID:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.74rem' }}>{selectedNode.id}</span>
              <span style={{ color: '#94a3b8' }}>Source:</span>
              <span>{selectedNode.sourceRequirementId || 'n/a'}</span>
              <span style={{ color: '#94a3b8' }}>Confidence:</span>
              <span>{selectedNode.confidence ?? '0.90'}</span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.76rem', borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: 8 }}>
              {selectedNode.description || selectedNode.sourceText || 'No description provided.'}
            </div>
          </div>
        ) : selectedEdge ? (
          <div style={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.55 }}>
            <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.95rem', marginBottom: 6 }}>
              {selectedEdge.label || selectedEdge.type}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 8px' }}>
              <span style={{ color: '#94a3b8' }}>Type:</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedEdge.type}</span>
              <span style={{ color: '#94a3b8' }}>Source:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.74rem' }}>{edgeSrcId}</span>
              <span style={{ color: '#94a3b8' }}>Target:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.74rem' }}>{edgeTgtId}</span>
              <span style={{ color: '#94a3b8' }}>Trace:</span>
              <span>{selectedEdge.sourceRequirementId || 'REQ_1'}</span>
            </div>
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: '0.78rem', textAlign: 'center', padding: '24px 0' }}>
            Click any node or relationship on the canvas to inspect its properties.
          </div>
        )}
      </div>

      {/* Legend in Sidebar */}
      <div style={{ background: '#0d1527', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 12, padding: 12 }}>
        <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: 8, fontWeight: 600 }}>Node Types</div>
        <LegendBar />
      </div>
    </div>
  );

  // ── Loading / Error / Empty States ───────────────────────────
  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: 460,
          display: 'grid',
          placeItems: 'center',
          color: '#cbd5e1',
          textAlign: 'center',
          background: '#070b14',
          borderRadius: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#f8fafc' }}>Extracting Requirement Graph…</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, maxWidth: 360 }}>
            Analyzing actors, entities, relationships, and constraints.
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: 460,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          color: '#f8fafc',
          padding: 24,
          background: '#070b14',
          borderRadius: 14,
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <AlertTriangle size={36} color="#fbbf24" style={{ marginBottom: 14 }} />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Requirement Graph Generation Failed</div>
          <div style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>{error}</div>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{ ...controlBtnStyle, padding: '0.6rem 1.2rem', background: '#3b82f6', border: 'none', fontWeight: 600 }}
            >
              Retry Generation
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!graph || !nodes.length) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: 460,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          color: '#cbd5e1',
          background: '#070b14',
          borderRadius: 14,
        }}
      >
        <div>
          <Info size={36} color="#38bdf8" style={{ marginBottom: 14 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>No Requirement Graph Yet</div>
          <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 340 }}>
            Submit a diagram prompt to generate the structured requirement graph.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ════════════════════════════════════════════════════════════
          1. DEFAULT VIEW: 100% Graph Visualization (No Sidebar)
          ════════════════════════════════════════════════════════════ */}
      <div
        style={{
          width: '100%',
          height: '100%',
          minHeight: 460,
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: 14,
          background: '#070b14',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* Inline Toolbar */}
        <Toolbar fgRef={inlineFgRef} expanded={false} />

        {/* Responsive Canvas Container */}
        <div
          ref={inlineContainerRef}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            minHeight: 380,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {inlineDim.width > 0 && inlineDim.height > 0 && (
            <ForceGraph2D
              ref={inlineFgRef}
              width={inlineDim.width}
              height={inlineDim.height}
              graphData={inlineGraphData}
              d3VelocityDecay={0.3}
              warmupTicks={60}
              cooldownTicks={120}
              onEngineStop={() => fitView(inlineFgRef, 50, 400)}
              nodeRelSize={7}
              linkDirectionalArrowLength={6.5}
              linkDirectionalArrowRelPos={0.88}
              linkDirectionalArrowColor={() => '#94a3b8'}
              linkWidth={(link) => (link.id === selectedEdgeId ? 2.8 : 1.5)}
              linkColor={(link) => (link.id === selectedEdgeId ? '#38bdf8' : '#475569')}
              linkCanvasObjectMode={() => 'after'}
              linkCanvasObject={renderLink}
              nodeCanvasObject={renderNode}
              onNodeClick={(node) => {
                setSelectedEdgeId(null);
                setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
              }}
              onNodeHover={(node) => setHoveredNodeId(node?.id || null)}
              onLinkClick={(link) => {
                setSelectedNodeId(null);
                setSelectedEdgeId((prev) => (prev === link.id ? null : link.id));
              }}
              onBackgroundClick={clearSelection}
            />
          )}
        </div>

        {/* Inline Footer Legend */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            padding: '0.45rem 1rem',
            borderTop: '1px solid rgba(148, 163, 184, 0.12)',
            background: '#090f1d',
            fontSize: '0.74rem',
            color: '#94a3b8',
            flexShrink: 0,
          }}
        >
          <LegendBar />
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              cursor: 'pointer',
              fontSize: '0.74rem',
              fontWeight: 600,
              textDecoration: 'underline',
            }}
          >
            Expand to view full stats & validation →
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          2. EXPANDED WORKSPACE: React Portal directly into body
          Permanently visible top toolbar with Minimize button,
          generous canvas, and independently scrollable sidebar.
          ════════════════════════════════════════════════════════════ */}
      {isExpanded &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999999,
              background: '#070b14',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {/* Top Toolbar: Sticky and unmissable */}
            <Toolbar fgRef={modalFgRef} expanded={true} />

            {/* Main Area: Canvas (Left) + Sidebar (Right) */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden',
                position: 'relative',
                width: '100%',
                height: 'calc(100vh - 56px - 36px)',
              }}
            >
              {/* Massive Canvas */}
              <div
                ref={modalContainerRef}
                style={{
                  flex: 1,
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  background: '#070b14',
                }}
              >
                {modalDim.width > 0 && modalDim.height > 0 && (
                  <ForceGraph2D
                    ref={modalFgRef}
                    width={modalDim.width}
                    height={modalDim.height}
                    graphData={modalGraphData}
                    d3VelocityDecay={0.3}
                    warmupTicks={70}
                    cooldownTicks={140}
                    onEngineStop={() => fitView(modalFgRef, 60, 400)}
                    nodeRelSize={8}
                    linkDirectionalArrowLength={7}
                    linkDirectionalArrowRelPos={0.88}
                    linkDirectionalArrowColor={() => '#94a3b8'}
                    linkWidth={(link) => (link.id === selectedEdgeId ? 3.0 : 1.6)}
                    linkColor={(link) => (link.id === selectedEdgeId ? '#38bdf8' : '#475569')}
                    linkCanvasObjectMode={() => 'after'}
                    linkCanvasObject={renderLink}
                    nodeCanvasObject={renderNode}
                    onNodeClick={(node) => {
                      setSelectedEdgeId(null);
                      setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
                    }}
                    onNodeHover={(node) => setHoveredNodeId(node?.id || null)}
                    onLinkClick={(link) => {
                      setSelectedNodeId(null);
                      setSelectedEdgeId((prev) => (prev === link.id ? null : link.id));
                    }}
                    onBackgroundClick={clearSelection}
                  />
                )}
              </div>

              {/* Information Sidebar */}
              <Sidebar />
            </div>

            {/* Bottom Legend Bar */}
            <div
              style={{
                height: 36,
                display: 'flex',
                alignItems: 'center',
                padding: '0 1.25rem',
                borderTop: '1px solid rgba(148, 163, 184, 0.12)',
                background: '#090f1d',
                fontSize: '0.74rem',
                color: '#94a3b8',
                flexShrink: 0,
              }}
            >
              <LegendBar />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default RequirementGraphViewer;
