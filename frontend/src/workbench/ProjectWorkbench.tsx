import React, { useMemo, useState } from 'react';
import { Empty, Tag, Tree, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import FunctionBar from './FunctionBar';
import type { ResearchObject } from './EquipmentManagerWindow';
import { buildProjectTree, resolveProjectSelection, type ProjectTreeView } from './projectTreeModel';

const { Text, Title } = Typography;

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
  factorCount: 2,
  runCount: designName.includes('裂区') ? 16 : 8,
  blockCount: designName.includes('裂区') ? 2 : 1,
  wholePlotCount: designName.includes('裂区') ? 4 : 0,
  wholePlotRunCount: designName.includes('裂区') ? 4 : 0,
  wholePlotReplicateCount: 2,
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
      worksheetData: experiment.worksheetData ?? {},
      extraItems: experiment.extraItems ?? [],
    }));
  } catch {
    return [];
  }
};

const saveStoredExperiments = (experiments: GeneratedExperiment[]) => {
  localStorage.setItem(EXPERIMENT_STORAGE_KEY, JSON.stringify(experiments));
};

const panelStyle: React.CSSProperties = {
  margin: 24,
  padding: 22,
  border: '1px solid #dde6f2',
  borderRadius: 14,
  background: '#fff',
  boxShadow: '0 8px 24px rgba(27, 55, 92, 0.07)',
};

const metricStyle: React.CSSProperties = {
  minWidth: 132,
  padding: '14px 16px',
  border: '1px solid #e3eaf4',
  borderRadius: 10,
  background: '#f8fbff',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const ProjectWorkbench: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [navigatorWidth, setNavigatorWidth] = useState(240);
  const [worksheetHeight, setWorksheetHeight] = useState(230);
  const [experiments, setExperiments] = useState<GeneratedExperiment[]>([]);
  const [storedExperiments, setStoredExperiments] = useState<GeneratedExperiment[]>(loadStoredExperiments);
  const [researchObjects, setResearchObjects] = useState<ResearchObject[]>(loadResearchObjects);
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);
  const [activeTreeKey, setActiveTreeKey] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ProjectTreeView>('overview');
  const [activeExtraIndex, setActiveExtraIndex] = useState<number | null>(null);

  const activeExperiment = experiments.find((experiment) => experiment.id === activeExperimentId) ?? null;
  const treeData = useMemo(() => buildProjectTree(experiments), [experiments]);
  const isRootRoute = location.pathname === '/';

  const handleResearchObjectsChange = (objects: ResearchObject[]) => {
    setResearchObjects(objects);
    saveResearchObjects(objects);
  };

  const selectProjectView = (experimentId: string, view: ProjectTreeView, treeKey: string, extraIndex?: number) => {
    setActiveExperimentId(experimentId);
    setActiveTreeKey(treeKey);
    setActiveView(view);
    setActiveExtraIndex(extraIndex ?? null);
    if (view === 'worksheet') setWorksheetHeight(420);
    if (!isRootRoute) navigate('/');
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
      setActiveTreeKey(`${experiment.id}-overview`);
      setActiveView('overview');
      setActiveExtraIndex(null);
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
    setExperiments((prev) => prev.some((item) => item.id === experimentId) ? prev : [...prev, experiment]);
    setActiveExperimentId(experimentId);
    setActiveTreeKey(`${experimentId}-overview`);
    setActiveView('overview');
    setActiveExtraIndex(null);
    if (!isRootRoute) navigate('/');
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

  const renderOverview = () => {
    if (!activeExperiment) {
      return (
        <div style={{ ...panelStyle, minHeight: 260, display: 'grid', placeItems: 'center' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Title level={5} style={{ marginBottom: 6 }}>暂无打开的项目</Title>
                <Text type="secondary">通过顶部现有功能新建或导入后，项目会显示在左侧。</Text>
              </div>
            }
          />
        </div>
      );
    }

    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>当前项目</Text>
            <Title level={3} style={{ margin: '4px 0 6px', color: '#0d2043' }}>{activeExperiment.name}</Title>
            <Text type="secondary">设计方法：{activeExperiment.designName}</Text>
          </div>
          <Tag color="blue">已载入工作台</Tag>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <div style={metricStyle}><Text type="secondary">试验次数</Text><strong style={{ fontSize: 22 }}>{activeExperiment.designSummary.runCount}</strong></div>
          <div style={metricStyle}><Text type="secondary">因子数量</Text><strong style={{ fontSize: 22 }}>{activeExperiment.designSummary.factorCount}</strong></div>
          <div style={metricStyle}><Text type="secondary">区组数量</Text><strong style={{ fontSize: 22 }}>{activeExperiment.designSummary.blockCount}</strong></div>
          <div style={metricStyle}><Text type="secondary">已有扩展项</Text><strong style={{ fontSize: 22 }}>{activeExperiment.extraItems.length}</strong></div>
        </div>
      </div>
    );
  };

  const renderSummary = () => activeExperiment ? (
    <div className="design-summary-panel" style={{ ...panelStyle, width: 'auto' }}>
      <h3>设计摘要</h3>
      <div className="design-summary-grid">
        <span>因子:</span><strong>{activeExperiment.designSummary.factorCount}</strong>
        <span>整区:</span><strong>{activeExperiment.designSummary.wholePlotCount}</strong>
        <span>难以改变的因子:</span><strong>{activeExperiment.designSummary.hardToChangeFactor}</strong>
        <span>每个整区的运行次数:</span><strong>{activeExperiment.designSummary.wholePlotRunCount}</strong>
        <span>试验次数:</span><strong>{activeExperiment.designSummary.runCount}</strong>
        <span>整区仿行数:</span><strong>{activeExperiment.designSummary.wholePlotReplicateCount}</strong>
        <span>区组:</span><strong>{activeExperiment.designSummary.blockCount}</strong>
        <span>子区仿行数:</span><strong>{activeExperiment.designSummary.subPlotReplicateCount}</strong>
      </div>
      <p>整区生成元: {activeExperiment.designSummary.wholePlotGenerator}</p>
      <p>{activeExperiment.designSummary.note}</p>
    </div>
  ) : renderOverview();

  const renderExtra = () => {
    const title = activeExperiment && activeExtraIndex !== null ? activeExperiment.extraItems[activeExtraIndex] : '';
    return (
      <div style={panelStyle}>
        <Text type="secondary" style={{ fontSize: 12 }}>项目已有内容</Text>
        <Title level={4} style={{ marginTop: 6 }}>{title || '未选择内容'}</Title>
        <Text type="secondary">该入口来自当前项目已经保存的内容，本次重构不新增或重算业务结果。</Text>
      </div>
    );
  };

  const renderRootCanvas = () => {
    if (activeView === 'summary') return renderSummary();
    if (activeView === 'extra') return renderExtra();
    if (activeView === 'worksheet' && activeExperiment) {
      return (
        <div style={{ ...panelStyle, marginBottom: 10 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>当前项目</Text>
          <Title level={4} style={{ margin: '4px 0 0' }}>{activeExperiment.name} · 试验工作表</Title>
        </div>
      );
    }
    return renderOverview();
  };

  return (
    <div className="layout-workbench" style={{ background: '#eef3f8', gap: 10, padding: '0 10px 10px' }}>
      <FunctionBar
        researchObjects={researchObjects}
        onResearchObjectsChange={handleResearchObjectsChange}
        experiments={storedExperiments.map((experiment) => ({ id: experiment.id, name: experiment.name }))}
        onImportExperiment={handleImportExperiment}
        onAssociateObjectToExperiment={() => undefined}
        onMergeObjects={() => undefined}
        onDesignGenerated={handleDesignGenerated}
      />

      <div className="layout-content" style={{ border: 0, borderRadius: 14, background: '#eef3f8', gap: 10, overflow: 'hidden' }}>
        <aside
          className="layout-navigator"
          style={{
            width: navigatorWidth,
            border: '1px solid #dde6f2',
            borderRadius: 14,
            boxShadow: '0 8px 24px rgba(27, 55, 92, 0.06)',
          }}
        >
          <div style={{ padding: '16px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong style={{ color: '#0d2043' }}>项目</Text>
              <div><Text type="secondary" style={{ fontSize: 11 }}>{experiments.length} 个已打开</Text></div>
            </div>
          </div>
          {experiments.length > 0 ? (
            <Tree
              blockNode
              defaultExpandAll
              selectedKeys={activeTreeKey ? [activeTreeKey] : []}
              treeData={treeData}
              onSelect={(keys) => {
                const key = String(keys[0] ?? '');
                const selection = resolveProjectSelection(experiments, key);
                if (!selection.experimentId) return;
                selectProjectView(selection.experimentId, selection.view, key, selection.extraIndex);
              }}
            />
          ) : (
            <div style={{ padding: '24px 12px' }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无项目" />
            </div>
          )}
        </aside>

        <div
          className="layout-vertical-splitter"
          style={{ width: 4, border: 0, borderRadius: 999, background: 'transparent' }}
          onMouseDown={startVerticalResize}
        />

        {isRootRoute ? (
          <section className="layout-main" style={{ borderRadius: 14, overflow: 'hidden', background: '#fff', boxShadow: '0 8px 24px rgba(27, 55, 92, 0.06)' }}>
            <div className="layout-canvas" style={{ backgroundColor: '#f8fbff' }}>
              {renderRootCanvas()}
            </div>
            {activeExperiment && (
              <>
                <div
                  className="layout-horizontal-splitter"
                  style={{ height: 8, border: 0, background: 'transparent' }}
                  onMouseDown={startHorizontalResize}
                />
                <div className="layout-worksheet" style={{ height: worksheetHeight, borderTop: '1px solid #edf2f8' }}>
                  <div style={{ height: 34, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fbff', flexShrink: 0 }}>
                    <Text strong style={{ fontSize: 12 }}>试验工作表</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{activeExperiment.name}</Text>
                  </div>
                  <div className="worksheet-grid">
                    <div className="worksheet-corner" />
                    {columns.map((column) => <div className="worksheet-column-header" key={column}>{column}</div>)}
                    {rows.map((row) => (
                      <React.Fragment key={row}>
                        <div className="worksheet-row-header">{row}</div>
                        {columns.map((column, index) => (
                          <div className={`worksheet-cell ${row === 1 && index === 0 ? 'active' : ''}`} key={`${row}-${column}`}>
                            {activeExperiment.worksheetData[`${row}-${column}`] ?? ''}
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="worksheet-tabs"><div className="worksheet-tab active">工作表 1</div></div>
                </div>
              </>
            )}
          </section>
        ) : (
          <main
            className="main-content"
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              overflow: 'auto',
              display: 'flex',
              border: '1px solid #dde6f2',
              borderRadius: 14,
              background: '#fff',
              boxShadow: '0 8px 24px rgba(27, 55, 92, 0.06)',
            }}
          >
            <Outlet />
          </main>
        )}
      </div>
    </div>
  );
};

export default ProjectWorkbench;
