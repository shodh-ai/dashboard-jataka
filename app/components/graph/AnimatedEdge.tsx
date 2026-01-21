"use client";

import React from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';

export interface AnimatedEdgeData {
  isHighlighted?: boolean;
  isDimmed?: boolean;
  label?: string; // Edge label support (CALLS, REFERENCES, etc.)
}

const AnimatedEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
}: EdgeProps<AnimatedEdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.3, // Slightly increased curve for better separation
  });

  const isHighlighted = data?.isHighlighted ?? false;
  const isDimmed = data?.isDimmed ?? false;
  const label = data?.label;

  // Gradient ID unique per edge
  const gradientId = `edge-gradient-${id}`;

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {/* Blue theme: Blue-500 (#3b82f6) and Blue-400 (#60a5fa) */}
          <stop offset="0%" stopColor={isHighlighted ? "#3b82f6" : "#475569"} />
          <stop offset="50%" stopColor={isHighlighted ? "#60a5fa" : "#64748b"} />
          <stop offset="100%" stopColor={isHighlighted ? "#3b82f6" : "#475569"} />
        </linearGradient>
      </defs>

      {/* Background path (glow effect when highlighted) */}
      {isHighlighted && (
        <path
          d={edgePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={6}
          strokeOpacity={0.15}
          filter="blur(4px)"
          className="react-flow__edge-path"
        />
      )}

      {/* Main edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={isHighlighted ? 2.5 : 1.5}
        strokeLinecap="round"
        className="react-flow__edge-path transition-all duration-300"
        style={{
          ...style,
          opacity: isDimmed ? 0.15 : 1,
          strokeDasharray: isHighlighted ? '8 4' : '6 3',
          animation: 'flowingDash 1s linear infinite',
        }}
      />

      {/* Arrow marker at the end */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={10}
        markerEnd={`url(#arrow-${isHighlighted ? 'highlighted' : 'default'})`}
      />

      {/* Edge Label Renderer - Shows relationship type (CALLS, REFERENCES, etc.) */}
      {label && !isDimmed && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="px-2 py-0.5 rounded bg-slate-900/90 border border-white/10 text-[9px] font-mono text-slate-400 shadow-xl tracking-wider"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

// Custom arrow markers component to be included in the SVG defs
export const EdgeMarkerDefs = () => (
  <svg style={{ position: 'absolute', width: 0, height: 0 }}>
    <defs>
      {/* Default arrow */}
      <marker
        id="arrow-default"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
      </marker>
      {/* Highlighted arrow (Blue theme) */}
      <marker
        id="arrow-highlighted"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
      </marker>
    </defs>
  </svg>
);

export default AnimatedEdge;
