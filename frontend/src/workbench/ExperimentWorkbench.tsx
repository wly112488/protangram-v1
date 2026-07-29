import React, { useState } from 'react';
import { Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import FunctionBar from './FunctionBar';
import type { ResearchObject } from './EquipmentManagerWindow';

interface GeneratedExperiment {
  id: string;
  name: string;
  designName: string;
  designSummary: {
    factorCount: number;
    runCount: number;
    blockCount: number;
    wholePlotCount: number;
    wholePlotRunCount: number;
    wholePlotReplicateCount: number;
    subPlotReplicateCount: number;
    hardToChangeFactor: string;
    wholePlotGenerator: string;
    note: string;
  };
  worksheetData: Record<string, string>;
  extraItems: string[];
}

const OBJECT_STORAGE_KEY = 'protangram-research-objects';
const EXPERIMENT_STORAGE_KEY = 'protangram-generated-experiments';

const columns = Array.from({ length: 20 }, (_, index) => `C${index + 1}`);
const rows = Array.from({ length: 24 }, (_, index) => index + 1);
const createPresetWorksheetData = (designName: string, experimentIndex: number): Record<string, string> => ({
  '1-C1': 'Run',
  '1-C2': 'A',
  '1-C3': 'B',
  '1-C4': '响应',
  '2-C1': '1',
  '2-C2': '-1',
  '2-C3': '-1',
  '2-C4': '82.4',
  '3-C1': '2',
  '3-C2': '1',
  '3-C3': '-1',
  '3-C4': '86.1',
  '4-C1': '3',
  '4-C2': '-1',
  '4-C3': '1',
  '4-C4': '84.7',
  '5-C1': '4',
  '5-C2': '1',
  '5-C3': '1',
  '5-C4': '91.3',
  '7-C1': '方案',
  '7-C2': designName,
  '8-C1': '实验',
  '8-C2': `实验${experimentIndex}`,
});

const createPresetDesignSummary = (designName: string): GeneratedExperiment['designSummary'] => ({
  factorCount: designName.includes('裂区') ? 2 : 2,
  runCount: designName.includes('裂区') ? 16 : 8,
  blockCount: designName.includes('裂区') ? 2 : 1,
  wholePlotCount: designName.includes('裂区') ? 4 : 0,
  wholePlotRunCount: designName.includes('裂区') ? 4 : 0,
  wholePlotReplicateCount: designName.includes('裂区') ? 2 : 2,
  subPlotReplicateCount: designName.includes('裂区') ? 2 : 0,
  hardToChangeFactor: 'A',
  wholePlotGenerator: 'A',
  note: '所有项均不混杂。',
});

const loadResearchObjects = (): ResearchObject[] => {
  try {
    const raw = localStorage.getItem(OBJECT_STORAGE_KEY);
    return raw ? JSON.parse(raw) as ResearchObject[] : [];
  } catch {
    return [];
  }
};

const saveResearchObjects = (objects: ResearchObject[]) => {
  localStorage.setItem(OBJECT_STORAGE_KEY, JSON.stringify(objects));
};

const loadStoredExperiments = (): GeneratedExperiment[] => {
  try {
    const raw = localStorage.getItem(EXPERIMENT_STORAGE_KEY);
    const experiments = raw ? JSON.parse(raw) as GeneratedExperiment[] : [];
    return experiments.map((experiment) => ({
      ...experiment,
      designSummary: experiment.designSummary ?? createPresetDesignSummary(experiment.designName),
    }));
  } catch {
    return [];
  }
};

const saveStoredExperiments = (experiments: GeneratedExperiment[]) => {
  localStorage.setItem(EXPERIMENT_STORAGE_KEY, JSON.stringify(experiments));
};

const createExperimentTree = (experiments: GeneratedExperiment[]): DataNode[] =>
  experiments.map((experiment) => ({
    key: experiment.id,
    title: experiment.name,
    children: [
      { key: `${experiment.id}-design`, title: experiment.designName },
      { key: `${experiment.id}-summary`, title: '设计摘要' },
      ...experiment.extraItems.map((item, index) => ({
        key: `${experiment.id}-extra-${index}`,
        title: item,
      })),
    ],
  }));

const ExperimentWorkbench: React.FC = () => {
  const [navigatorWidth, setNavigatorWidth] = useState(240);
  const [worksheetHeight, setWorksheetHeight] = useState(230);
  const [experiments, setExperiments] = useState<GeneratedExperiment[]>([]);
  const [storedExperiments, setStoredExperiments] = useState<GeneratedExperiment[]>(loadStoredExperiments);
  const [researchObjects, setResearchObjects] = useState<ResearchObject[]>(loadResearchObjects);
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);
  const [activeTreeKey, setActiveTreeKey] = useState<string | null>(null);
  const activeExperiment = experiments.find((experiment) => experiment.id === activeExperimentId) ?? null;
  const showingDesignSummary = activeTreeKey?.endsWith('-summary') && activeExperiment;

  const handleResearchObjectsChange = (objects: ResearchObject[]) => {
    setResearchObjects(objects);
    saveResearchObjects(objects);
  };

  const handleDesignGenerated = (designName: string) => {
    setExperiments((prev) => {
      const nextIndex = storedExperiments.length + 1;
      const experiment: GeneratedExperiment = {
        id: `experiment-${nextIndex}`,
        name: `实验${nextIndex}`,
        designName,
        designSummary: createPresetDesignSummary(designName),
        worksheetData: createPresetWorksheetData(designName, nextIndex),
        extraItems: [],
      };
      setActiveExperimentId(experiment.id);
      setActiveTreeKey(experiment.id);
      setStoredExperiments((storedPrev) => {
        const nextStored = [...storedPrev, experiment];
        saveStoredExperiments(nextStored);
        return nextStored;
      });
      return [...prev, experiment];
    });
  };

  const handleImportExperiment = (experimentId: string) => {
    const experiment = storedExperiments.find((item) => item.id === experimentId);
    if (!experiment) return;
    setExperiments((prev) => {
      if (prev.some((item) => item.id === experimentId)) return prev;
      return [...prev, experiment];
    });
    setActiveExperimentId(experimentId);
    setActiveTreeKey(experimentId);
  };

  const startVerticalResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = navigatorWidth;
    const onMove = (moveEvent: MouseEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX;
      setNavigatorWidth(Math.min(420, Math.max(180, nextWidth)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startHorizontalResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = worksheetHeight;
    const onMove = (moveEvent: MouseEvent) => {
      const nextHeight = startHeight - (moveEvent.clientY - startY);
      setWorksheetHeight(Math.min(420, Math.max(140, nextHeight)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="layout-workbench">
      <FunctionBar
        researchObjects={researchObjects}
        onResearchObjectsChange={handleResearchObjectsChange}
        experiments={storedExperiments.map((experiment) => ({
          id: experiment.id,
          name: experiment.name,
        }))}
        onImportExperiment={handleImportExperiment}
        onAssociateObjectToExperiment={() => undefined}
        onMergeObjects={() => undefined}
        onDesignGenerated={handleDesignGenerated}
      />
      <div className="layout-content">
        <aside className="layout-navigator" style={{ width: navigatorWidth }}>
          <Tree
            blockNode
            defaultExpandAll
            selectedKeys={activeTreeKey ? [activeTreeKey] : []}
            treeData={createExperimentTree(experiments)}
            onSelect={(keys) => {
              const key = String(keys[0] ?? '');
              const experimentId = key
                .split('-design')[0]
                .split('-summary')[0]
                .split('-extra')[0];
              if (experiments.some((experiment) => experiment.id === experimentId)) {
                setActiveExperimentId(experimentId);
                setActiveTreeKey(key);
              }
            }}
          />
        </aside>
        <div className="layout-vertical-splitter" onMouseDown={startVerticalResize} />
        <section className="layout-main">
          <div className="layout-canvas">
            {showingDesignSummary && (
              <div className="design-summary-panel">
                <h3>设计摘要</h3>
                <div className="design-summary-grid">
                  <span>因子:</span>
                  <strong>{activeExperiment.designSummary.factorCount}</strong>
                  <span>整区:</span>
                  <strong>{activeExperiment.designSummary.wholePlotCount}</strong>
                  <span>难以改变的因子:</span>
                  <strong>{activeExperiment.designSummary.hardToChangeFactor}</strong>
                  <span>每个整区的运行次数:</span>
                  <strong>{activeExperiment.designSummary.wholePlotRunCount}</strong>
                  <span>试验次数:</span>
                  <strong>{activeExperiment.designSummary.runCount}</strong>
                  <span>整区仿行数:</span>
                  <strong>{activeExperiment.designSummary.wholePlotReplicateCount}</strong>
                  <span>区组:</span>
                  <strong>{activeExperiment.designSummary.blockCount}</strong>
                  <span>子区仿行数:</span>
                  <strong>{activeExperiment.designSummary.subPlotReplicateCount}</strong>
                </div>
                <p>难以改变的因子数: {activeExperiment.designSummary.hardToChangeFactor}</p>
                <p>整区生成元: {activeExperiment.designSummary.wholePlotGenerator}</p>
                <p>{activeExperiment.designSummary.note}</p>
              </div>
            )}
          </div>
          <div className="layout-horizontal-splitter" onMouseDown={startHorizontalResize} />
          <div className="layout-worksheet" style={{ height: worksheetHeight }}>
            <div className="worksheet-grid">
              <div className="worksheet-corner" />
              {columns.map((column) => (
                <div className="worksheet-column-header" key={column}>{column}</div>
              ))}
              {rows.map((row) => (
                <React.Fragment key={row}>
                  <div className="worksheet-row-header">{row}</div>
                  {columns.map((column, index) => (
                    <div
                      className={`worksheet-cell ${row === 1 && index === 0 ? 'active' : ''}`}
                      key={`${row}-${column}`}
                    >
                      {activeExperiment?.worksheetData[`${row}-${column}`] ?? ''}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
            <div className="worksheet-tabs">
              <div className="worksheet-tab active">工作表 1</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ExperimentWorkbench;
