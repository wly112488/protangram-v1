import React from 'react';
import { CheckCircleFilled } from '@ant-design/icons';
import { Card } from 'antd';

export interface PreparationItem {
  key: string;
  label: string;
  value?: React.ReactNode;
  confirmed: boolean;
  onClick?: () => void;
}

interface PreparationChecklistProps {
  title?: string;
  items: PreparationItem[];
}

const PreparationChecklist: React.FC<PreparationChecklistProps> = ({ title = '准备状态', items }) => (
  <Card size="small" className="workspace-business-card workspace-preparation-card" title={title}>
    <div className="workspace-preparation-grid">
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

        return item.onClick ? (
          <button key={item.key} type="button" className="workspace-preparation-item" onClick={item.onClick}>
            {content}
          </button>
        ) : (
          <div key={item.key} className="workspace-preparation-item">
            {content}
          </div>
        );
      })}
    </div>
  </Card>
);

export default PreparationChecklist;
