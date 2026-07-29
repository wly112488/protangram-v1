import React from 'react';
import { Button, Tabs, Tag, Timeline, Typography } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import type { ExperimentWorkspace } from './workbenchModel';

const { Text } = Typography;

interface BottomExperimentPanelProps {
  experiment: ExperimentWorkspace;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onTabChange: (tab: ExperimentWorkspace['bottomTab']) => void;
}

const BottomExperimentPanel: React.FC<BottomExperimentPanelProps> = ({
  experiment,
  collapsed,
  onCollapsedChange,
  onTabChange,
}) => (
  <section className={`bottom-experiment-panel ${collapsed ? 'collapsed' : ''}`}>
    <div className="bottom-panel-header">
      <div>
        <Text strong>{experiment.name}</Text>
        <Text type="secondary"> 附属内容</Text>
      </div>
      <Button
        size="small"
        type="text"
        icon={collapsed ? <UpOutlined /> : <DownOutlined />}
        onClick={() => onCollapsedChange(!collapsed)}
      >
        {collapsed ? '展开' : '收起'}
      </Button>
    </div>
    {!collapsed && (
      <Tabs
        size="small"
        activeKey={experiment.bottomTab}
        onChange={(key) => onTabChange(key as ExperimentWorkspace['bottomTab'])}
        items={[
          {
            key: 'log',
            label: '实验日志',
            children: (
              <Timeline
                className="bottom-timeline"
                items={[
                  { children: '完成工作表数据网络生成' },
                  { children: '导入原始采集表 1260 行' },
                  { children: '试验大纲进入运行状态' },
                ]}
              />
            ),
          },
          {
            key: 'params',
            label: '参数明细',
            children: (
              <div className="bottom-chip-list">
                {['温度范围 20-80℃', '采样频率 100Hz', '中心点 4', '因子数 6', '响应变量 10'].map((item) => (
                  <Tag key={item}>{item}</Tag>
                ))}
              </div>
            ),
          },
          {
            key: 'runs',
            label: '运行记录',
            children: (
              <div className="bottom-table-lite">
                {['Run-001 已完成', 'Run-002 已完成', 'Run-003 执行中', 'Run-004 等待'].map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            ),
          },
          {
            key: 'changes',
            label: '数据变更',
            children: (
              <div className="bottom-table-lite">
                {['清洗数据表更新 42 行', '响应变量表新增 2 字段', '报告引用表同步 8 项'].map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            ),
          },
        ]}
      />
    )}
  </section>
);

export default BottomExperimentPanel;
