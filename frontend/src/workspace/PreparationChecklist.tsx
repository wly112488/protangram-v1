import React from 'react';
import { CheckCircleFilled } from '@ant-design/icons';
import { Card } from 'antd';
import './preparationChecklist.css';

export interface PreparationItem {
  key: string;
  label: string;
  value?: React.ReactNode;
  preview?: React.ReactNode;
  confirmed: boolean;
  onClick?: () => void;
}

interface PreparationChecklistProps {
  title?: string;
  items: PreparationItem[];
  actions?: React.ReactNode;
}

const PreparationChecklist: React.FC<PreparationChecklistProps> = ({ title = '准备状态', items, actions }) => (
  <Card size="small" className="workspace-business-card workspace-preparation-card" title={title}>
    <div className="workspace-preparation-list">
      {items.map((item) => {
        const content = (
          <>
            <span className={`workspace-preparation-status${item.confirmed ? ' confirmed' : ''}`}>
              {item.confirmed ? <CheckCircleFilled /> : '○'}
            </span>
            <span className="workspace-preparation-copy">
              <strong>{item.label}</strong>
              {item.value !== undefined && <small>{item.value}</small>}
            </span>
          </>
        );

        return (
          <div key={item.key} className={`workspace-preparation-row${item.confirmed ? ' confirmed' : ''}`}>
            {item.onClick ? (
              <button type="button" className="workspace-preparation-item" onClick={item.onClick}>{content}</button>
            ) : (
              <div className="workspace-preparation-item">{content}</div>
            )}
            <div className="workspace-preparation-preview" aria-live="polite">
              {item.confirmed ? item.preview ?? item.value : <span className="workspace-preparation-preview-empty">确认后在此显示成果预览</span>}
            </div>
          </div>
        );
      })}
    </div>
    {actions && <div className="workspace-preparation-actions">{actions}</div>}
  </Card>
);

export default PreparationChecklist;
