import React from 'react';
import type { ModelContract } from '@/types/businessContext';

interface ModelChoiceStripProps {
  models: ModelContract[];
  value?: string;
  onChange: (model: ModelContract) => void;
  ariaLabel: string;
  isDisabled?: (model: ModelContract) => boolean;
}

const ModelChoiceStrip: React.FC<ModelChoiceStripProps> = ({ models, value, onChange, ariaLabel, isDisabled }) => (
  <div className="workspace-top-choice-group" role="group" aria-label={ariaLabel}>
    <div className="workspace-top-choice-options">
      {models.map((model) => {
        const selected = value === model.modelId;
        const disabled = isDisabled?.(model) ?? false;
        return <button
          type="button"
          key={model.modelId}
          className={`workspace-top-choice ${selected ? 'is-selected' : ''}`}
          aria-pressed={selected}
          disabled={disabled}
          title={`${model.modelName} ${model.version}｜${model.status ?? '可用'}｜可信范围 ${model.trustedRange}`}
          onClick={() => onChange(model)}
        >
          {model.modelName} {model.version}
        </button>;
      })}
    </div>
  </div>
);

export default ModelChoiceStrip;
