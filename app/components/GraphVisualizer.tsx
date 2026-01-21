"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from "@clerk/nextjs";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Loader2, 
  Network, 
  Clock, 
  Calendar,
  Radar,
} from 'lucide-react';

// Custom components
import GlassNode, { GlassNodeData } from './graph/GlassNode';
import AnimatedEdge, { EdgeMarkerDefs, AnimatedEdgeData } from './graph/AnimatedEdge';

// --- Custom Node & Edge Types ---
const nodeTypes = {
  glassNode: GlassNode,
};

const edgeTypes = {
  animatedEdge: AnimatedEdge,
};

// --- Layout Logic (Increased Spacing for Readability) ---
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  // nodesep: Horizontal spacing between nodes in a row
  // ranksep: Vertical spacing between rows
  dagreGraph.setGraph({ rankdir: direction, nodesep: 20, ranksep: 200 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 100,
        y: nodeWithPosition.y - 40,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// --- Interfaces ---
interface GraphVisualizerProps {
  baseUrl: string | undefined;
}

interface ApiNode {
  id: string;
  label: string;
  type: string;
  risk: string;
  createdAt?: string;
}

interface ApiEdge {
  source: string;
  target: string;
  relationType?: string;
}

// --- Main Component ---
export default function GraphVisualizer({ baseUrl }: GraphVisualizerProps) {
  const { getToken } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [timelineValue, setTimelineValue] = useState(100); // 100 = Today, 0 = Last Week
  
  const [nodes, setNodes, onNodesChange] = useNodesState<GlassNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AnimatedEdgeData>([]);

  // Get connected node IDs for spotlight effect
  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    
    const connected = new Set<string>([hoveredNodeId]);
    edges.forEach((edge) => {
      if (edge.source === hoveredNodeId) connected.add(edge.target);
      if (edge.target === hoveredNodeId) connected.add(edge.source);
    });
    return connected;
  }, [hoveredNodeId, edges]);

  // Get connected edge IDs
  const connectedEdgeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    
    const connected = new Set<string>();
    edges.forEach((edge) => {
      if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
        connected.add(edge.id);
      }
    });
    return connected;
  }, [hoveredNodeId, edges]);

  // Find the oldest node date in the current dataset for dynamic timeline range
  const oldestDate = useMemo(() => {
    if (nodes.length === 0) return new Date();
    
    // Get all valid dates from nodes
    const dates = nodes
      .map(n => n.data.createdAt ? new Date(n.data.createdAt).getTime() : Date.now())
      .filter(t => !isNaN(t));
    
    if (dates.length === 0) return new Date();
    return new Date(Math.min(...dates));
  }, [nodes]);

  // Calculate the effective range in days (dynamic based on data)
  const effectiveRange = useMemo(() => {
    const now = new Date();
    const maxDaysDiff = Math.ceil((now.getTime() - oldestDate.getTime()) / (1000 * 3600 * 24));
    // Ensure at least 7 days range so the slider isn't useless on Day 1
    return Math.max(maxDaysDiff, 7);
  }, [oldestDate]);

  // Apply spotlight effect to nodes with real timeline logic (Dynamic Range)
  const styledNodes = useMemo(() => {
    const now = new Date();
    
    // Slider 0 = Go back 'effectiveRange' days (oldest)
    // Slider 100 = Today (newest)
    const daysBack = effectiveRange * ((100 - timelineValue) / 100);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - daysBack);

    return nodes.map((node) => {
      const isHighlighted = hoveredNodeId ? connectedNodeIds.has(node.id) : false;
      const isDimmed = hoveredNodeId ? !connectedNodeIds.has(node.id) : false;
      
      // --- REAL TIMELINE LOGIC (Production - Dynamic Range) ---
      let timelineStatus: 'deleted' | 'new' | 'unchanged' = 'unchanged';
      
      // Check Real Data from Neo4j createdAt timestamp
      // Only apply timeline logic if we have a valid createdAt timestamp
      if (node.data.createdAt && node.data.createdAt.length > 0) {
        try {
          const nodeDate = new Date(node.data.createdAt);
          
          // Validate that the date is valid
          if (!isNaN(nodeDate.getTime())) {
            // If node was created AFTER the cutoff date, it is "New" in this historical view
            // (i.e., it didn't exist at the time we're viewing)
            if (nodeDate > cutoffDate) {
              timelineStatus = 'new';
            }
          }
        } catch {
          // Invalid date format - keep as unchanged
        }
        
        // Note: To show "Deleted", you would need a soft-delete system in DB
        // with a 'deleted_at' timestamp. For now, "New" is accurate based on creation time.
      }
      // If no createdAt, node remains 'unchanged' (unknown creation date)
      // --- END REAL TIMELINE LOGIC ---

      return {
        ...node,
        data: {
          ...node.data,
          isHighlighted,
          isDimmed,
          timelineStatus,
        },
      };
    });
  }, [nodes, hoveredNodeId, connectedNodeIds, timelineValue, effectiveRange]);

  // Apply spotlight effect to edges
  const styledEdges = useMemo(() => {
    return edges.map((edge) => {
      const isHighlighted = hoveredNodeId ? connectedEdgeIds.has(edge.id) : false;
      const isDimmed = hoveredNodeId ? !connectedEdgeIds.has(edge.id) : false;

      return {
        ...edge,
        data: {
          ...edge.data,
          isHighlighted,
          isDimmed,
        },
      };
    });
  }, [edges, hoveredNodeId, connectedEdgeIds]);

  // Node hover handlers
  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  // Fetch data
  const handleSearch = async () => {
    const freshToken = await getToken();
    if (!searchTerm.trim()  || !baseUrl) return;
    
    setNodes([]);
    setEdges([]);
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${baseUrl}/brum-proxy/graph/impact`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}` 
        },
        body: JSON.stringify({ field_name: searchTerm }),
      });

      if (!res.ok) throw new Error('Failed to fetch dependency graph');

      const data = await res.json();
      
      // Transform API response to React Flow format with custom node type
      const rawNodes: Node<GlassNodeData>[] = data.nodes.map((n: ApiNode) => ({
        id: n.id,
        type: 'glassNode',
        data: { 
          label: n.label,
          type: (n.type as 'Field' | 'Apex' | 'Flow') || 'Flow',
          risk: (n.risk as 'Critical' | 'Safe') || 'Safe',
          apiName: n.id,
          createdAt: n.createdAt, // Map real timestamp from Neo4j
          timelineStatus: 'unchanged' as const,
          isHighlighted: false,
          isDimmed: false,
        },
        position: { x: 0, y: 0 },
      }));

      const rawEdges: Edge<AnimatedEdgeData>[] = data.edges.map((e: ApiEdge, i: number) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        type: 'animatedEdge',
        data: {
          isHighlighted: false,
          isDimmed: false,
          label: e.relationType, // Pass relationship type as edge label (CALLS, REFERENCES, etc.)
        },
      }));

      const layouted = getLayoutedElements(rawNodes, rawEdges);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Could not load graph';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Timeline label (Dynamic based on effective range)
  const getTimelineLabel = useCallback(() => {
    const daysBack = Math.round(effectiveRange * ((100 - timelineValue) / 100));
    
    if (daysBack === 0) return 'Today';
    if (daysBack === 1) return '1 Day Ago';
    if (daysBack < 7) return `${daysBack} Days Ago`;
    if (daysBack < 14) return '1 Week Ago';
    if (daysBack < 30) return `${Math.round(daysBack / 7)} Weeks Ago`;
    if (daysBack < 60) return '1 Month Ago';
    return `${Math.round(daysBack / 30)} Months Ago`;
  }, [effectiveRange, timelineValue]);

  // MiniMap node color
  const nodeColor = (node: Node<GlassNodeData>) => {
    const type = node.data?.type;
    if (type === 'Field') return '#3b82f6';
    if (type === 'Apex') return '#10b981';
    if (type === 'Flow') return '#a855f7';
    return '#64748b';
  };

  return (
    <div className="rounded-xl bg-slate-950 border border-white/10 overflow-hidden flex flex-col h-[650px] relative">
      {/* Edge Marker Definitions */}
      <EdgeMarkerDefs />

      {/* Header / Search Bar */}
      <div className="p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-sm z-20 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Network className="text-blue-400" size={20} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
            Dependency Graph
            </h3>
          </div>
        </div>
        
        <div className="flex w-full sm:w-auto gap-2">
          <div className="relative flex-1 sm:w-72">
            <input
              type="text"
              className="w-full rounded-lg bg-slate-900/80 px-4 py-2.5 text-sm text-white placeholder-slate-600 
                         border border-white/5 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20
                         outline-none pl-10 font-mono transition-all"
              placeholder="Enter a field name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
          </div>
          <button 
            onClick={handleSearch}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg 
                       transition-all disabled:opacity-50 flex items-center gap-2 
                       shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Trace'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative graph-canvas">
        {/* Empty State */}
        <AnimatePresence>
          {nodes.length === 0 && !loading && !error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                <Radar size={64} className="text-slate-700 relative" strokeWidth={1} />
              </div>
              <p className="mt-4 text-slate-600 text-sm font-mono">
                Enter a field name to trace dependencies
              </p>
              <p className="mt-1 text-slate-700 text-xs">
                Field → Apex Classes → Flows & Triggers
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20"
            >
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-2 rounded-lg text-sm backdrop-blur-sm">
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={1.5}
          defaultEdgeOptions={{
            type: 'animatedEdge',
          }}
        >
          {/* Dotted Grid Background */}
          <Background 
            variant={BackgroundVariant.Dots}
            color="#1e293b" 
            gap={24} 
            size={1}
          />
          
          {/* Styled Controls */}
          <Controls 
            className="!bg-slate-900/80 !backdrop-blur-sm !border-white/5 !rounded-lg !shadow-xl !m-3"
            showInteractive={false}
          />

          {/* HUD-style MiniMap */}
          <MiniMap
            nodeColor={nodeColor}
            nodeStrokeWidth={2}
            nodeBorderRadius={4}
            maskColor="rgba(15, 23, 42, 0.85)"
            className="!bg-slate-900/90 !backdrop-blur-sm !border-white/5 !rounded-lg !shadow-xl"
            style={{
              width: 140,
              height: 90,
            }}
          />
        </ReactFlow>

        {/* Timeline Slider Overlay */}
        {nodes.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
          >
            <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl px-5 py-3 shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock size={14} />
                  <span className="text-xs font-medium">Timeline</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <Calendar size={12} className="text-slate-600" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={timelineValue}
                    onChange={(e) => setTimelineValue(Number(e.target.value))}
                    className="w-32 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer
                               [&::-webkit-slider-thumb]:appearance-none
                               [&::-webkit-slider-thumb]:w-3
                               [&::-webkit-slider-thumb]:h-3
                               [&::-webkit-slider-thumb]:rounded-full
                               [&::-webkit-slider-thumb]:bg-blue-500
                               [&::-webkit-slider-thumb]:shadow-lg
                               [&::-webkit-slider-thumb]:shadow-blue-500/50
                               [&::-webkit-slider-thumb]:cursor-pointer
                               [&::-webkit-slider-thumb]:transition-all
                               [&::-webkit-slider-thumb]:hover:scale-125"
                  />
                  <Calendar size={12} className="text-blue-400" />
                </div>

                <div className="min-w-[80px] text-right">
                  <span className="text-xs font-mono text-blue-400">
                    {getTimelineLabel()}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      
      {/* Legend */}
      <div className="px-4 py-2.5 bg-slate-900/50 border-t border-white/5 flex items-center justify-between">
        <div className="flex gap-5 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
            <span className="font-mono">FIELD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span className="font-mono">APEX</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
            <span className="font-mono">FLOW</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono">CRITICAL</span>
          </div>
        </div>
        
        <div className="text-[10px] text-slate-600 font-mono">
          {nodes.length > 0 && `${nodes.length} nodes · ${edges.length} connections`}
        </div>
      </div>
    </div>
  );
}
