"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import { Database, Shield, Zap, Trash2, Sparkles } from 'lucide-react';

export interface GlassNodeData {
  label: string;
  type: 'Field' | 'Apex' | 'Flow';
  risk: 'Critical' | 'Safe';
  apiName?: string;
  createdAt?: string;
  timelineStatus?: 'deleted' | 'new' | 'unchanged';
  isHighlighted?: boolean;
  isDimmed?: boolean;
}

const typeConfig = {
  Field: {
    icon: Database,
    color: 'text-blue-400',
    bgGlow: 'shadow-blue-500/20',
    borderColor: 'border-blue-500/30',
  },
  Apex: {
    icon: Shield,
    color: 'text-emerald-400',
    bgGlow: 'shadow-emerald-500/20',
    borderColor: 'border-emerald-500/30',
  },
  Flow: {
    icon: Zap,
    color: 'text-purple-400',
    bgGlow: 'shadow-purple-500/20',
    borderColor: 'border-purple-500/30',
  },
};

const GlassNode = ({ data, selected }: NodeProps<GlassNodeData>) => {
  const config = typeConfig[data.type] || typeConfig.Flow;
  const Icon = config.icon;
  
  const isDeleted = data.timelineStatus === 'deleted';
  const isNew = data.timelineStatus === 'new';
  
  // Determine border and glow based on state
  const getBorderClass = () => {
    if (isDeleted) return 'border-red-500/60';
    if (isNew) return 'border-emerald-500/60';
    if (data.isHighlighted) return `${config.borderColor} shadow-lg ${config.bgGlow}`;
    return 'border-white/10';
  };

  const getOpacity = () => {
    if (data.isDimmed) return 'opacity-20';
    return 'opacity-100';
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: data.isDimmed ? 0.2 : 1,
      }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`
        relative px-4 py-3 min-w-[180px] max-w-[220px]
        bg-slate-900/70 backdrop-blur-md
        border ${getBorderClass()}
        rounded-xl
        transition-all duration-300 ease-out
        ${data.isHighlighted ? 'ring-1 ring-blue-400/50' : ''}
        ${selected ? 'ring-2 ring-blue-500' : ''}
        ${getOpacity()}
      `}
      style={{
        boxShadow: data.isHighlighted 
          ? '0 0 30px rgba(59, 130, 246, 0.15), 0 0 60px rgba(59, 130, 246, 0.05)' 
          : 'none',
      }}
    >
      {/* Critical Risk Pulsing Dot */}
      {data.risk === 'Critical' && (
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3"
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
          <span className="relative block w-3 h-3 rounded-full bg-red-500" />
        </motion.div>
      )}

      {/* Timeline Status Badge */}
      {isDeleted && (
        <div className="absolute -top-2 -left-2 px-1.5 py-0.5 bg-red-500/90 rounded text-[9px] font-bold text-white flex items-center gap-1">
          <Trash2 size={8} />
          REMOVED
        </div>
      )}
      {isNew && (
        <div className="absolute -top-2 -left-2 px-1.5 py-0.5 bg-emerald-500/90 rounded text-[9px] font-bold text-white flex items-center gap-1">
          <Sparkles size={8} />
          NEW
        </div>
      )}

      {/* Node Content */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`
          p-2 rounded-lg bg-slate-800/80 
          ${config.color}
          ${isDeleted ? 'opacity-50 line-through' : ''}
        `}>
          <Icon size={16} strokeWidth={1.5} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`
            text-xs font-semibold text-slate-200 truncate
            ${isDeleted ? 'line-through text-red-300/70' : ''}
            ${isNew ? 'text-emerald-300' : ''}
          `}>
            {data.label}
          </p>
          {data.apiName && (
            <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
              {data.apiName}
            </p>
          )}
          <p className={`text-[9px] mt-1 uppercase tracking-wider ${config.color} opacity-70`}>
            {data.type}
          </p>
        </div>
      </div>

      {/* Connection Handles - Subtle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-600 !border-slate-500 !-left-1 opacity-0 hover:opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-slate-600 !border-slate-500 !-right-1 opacity-0 hover:opacity-100 transition-opacity"
      />
    </motion.div>
  );
};

export default memo(GlassNode);
