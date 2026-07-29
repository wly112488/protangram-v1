import React from 'react';
import { Tag, Typography } from 'antd';
import type { WorksheetEdge, WorksheetNode } from './workbenchModel';

const { Text } = Typography;

const typeColor: Record<WorksheetNode['type'], string> = {
  plan: 'blue',
  raw: 'default',
  clean: 'cyan',
  factor: 'purple',
  response: 'green',
  result: 'gold',
  report: 'magenta',
};

interface WorksheetNetworkProps {
  nodes: WorksheetNode[];
  edges: WorksheetEdge[];
}

const WorksheetNetwork: React.FC<WorksheetNetworkProps> = ({ nodes, edges }) => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div className="worksheet-network">
      <svg className="worksheet-network-lines" width="1200" height="420">
        <defs>
          <marker id="network-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#91a4b7" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x + 132}
              y1={from.y + 44}
              x2={to.x}
              y2={to.y + 44}
              stroke="#91a4b7"
              strokeWidth={1.5}
              markerEnd="url(#network-arrow)"
            />
          );
        })}
      </svg>
      {nodes.map((node) => (
        <div className="worksheet-node" key={node.id} style={{ left: node.x, top: node.y }}>
          <div className="worksheet-node-title">
            <Text strong>{node.title}</Text>
            <Tag color={typeColor[node.type]}>{node.type}</Tag>
          </div>
          <Text type="secondary">{node.records} 行 / {node.fields} 字段</Text>
        </div>
      ))}
    </div>
  );
};

export default WorksheetNetwork;
