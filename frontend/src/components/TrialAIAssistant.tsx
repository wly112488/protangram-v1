import React, { createContext, useContext, useMemo, useState } from 'react';
import { Button, Card, Descriptions, Drawer, Input, Space, Tag, Typography } from 'antd';
import { ClearOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import type { BusinessAction } from '@/types/businessContext';
import { useSessionState } from '@/workspace/useSessionState';

const { Paragraph, Text } = Typography;

export type AIAssistantContext = {
  pageType: 'digitalTwin' | 'intelligentDesign' | 'dataAnalysis' | 'virtualCondition';
  pageName: string;
  projectName?: string;
  taskName?: string;
  modelName?: string;
  dataName?: string;
  resultSummary?: string;
  resultReady?: boolean;
  onBusinessAction?: (action: BusinessAction) => void;
};

type ChatMessage = { role: 'user' | 'assistant'; content: string; report?: boolean };

const pageConfig = {
  digitalTwin: {
    quickActions: ['解释校准结果', '为什么误差较大', '判断模型可信度', '给出模型改进建议'],
    resultActions: ['查看适用范围'],
    welcome: '已读取当前模型校准上下文。你可以让我解释校准结果、判断模型可信度或给出模型改进建议。',
  },
  intelligentDesign: {
    quickActions: ['解释推荐方案', '为什么推荐该工况', '分析方案风险', '给出调整建议'],
    resultActions: ['查看推荐工况', '调整方案'],
    welcome: '已读取当前智能试验设计条件。你可以让我解释推荐方案、分析工况风险或给出调整建议。',
  },
  dataAnalysis: {
    quickActions: ['解释当前结果', '分析异常原因', '给出下一步建议', '生成报告草稿'],
    resultActions: ['生成补充试验', '用于模型校准', '加入报告'],
    welcome: '已读取当前试验数据分析结果。当前发现 3 个异常事件，其中出口温度异常程度最高。',
  },
  virtualCondition: {
    quickActions: ['解释预测结果', '分析高风险区域', '判断可信范围', '筛选高风险工况'],
    resultActions: [],
    welcome: '已读取当前虚拟工况结果。你可以让我解释预测结果、判断可信范围或建议验证工况。',
  },
} as const;

const AssistantContext = createContext<{
  context: AIAssistantContext | null;
  setContext: React.Dispatch<React.SetStateAction<AIAssistantContext | null>>;
}>({ context: null, setContext: () => undefined });

export const TrialAIAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [context, setContext] = useState<AIAssistantContext | null>(null);
  return <AssistantContext.Provider value={{ context, setContext }}>{children}</AssistantContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTrialAIAssistant = () => useContext(AssistantContext);

const getMockAnswer = (context: AIAssistantContext, prompt: string): ChatMessage => {
  if (!context.resultReady) return { role: 'assistant', content: '' };
  if (prompt === '生成报告草稿') {
    return {
      role: 'assistant', report: true,
      content: ['分析摘要', context.taskName, context.resultSummary, context.modelName, context.dataName].filter(Boolean).join('\n\n'),
    };
  }
  const answers: Record<AIAssistantContext['pageType'], string> = {
    digitalTwin: '当前校准结果显示模型整体可信度较高，但边界工况仍存在预测偏差。建议补充边界区域实测数据，并重点复核高敏感参数。',
    intelligentDesign: '推荐工况优先覆盖历史数据不足、预计信息增益较高且处于模型可信范围内的区域。方案兼顾覆盖率、执行成本与安全边界。',
    dataAnalysis: '结合当前数据，7600rpm 后冷却流量下降、压力波动增加，同时模型历史数据覆盖不足。建议验证 7600～8200rpm 区域，并使用本次数据重新校准模型。',
    virtualCondition: '当前高风险区域靠近模型可信范围边界，预测不确定性明显增加。这张工况表就是本次虚拟工况分析结果；保存后会回到当前任务，任务报告整理时会统一读取这项成果。',
  };
  return { role: 'assistant', content: [answers[context.pageType], context.taskName ?? context.projectName ?? context.pageName, context.modelName, context.resultSummary].filter(Boolean).join('\n\n') };
};

const TrialAIAssistant: React.FC<{ sessionId?: string; embedded?: boolean }> = ({ sessionId, embedded = false }) => {
  const { context } = useTrialAIAssistant();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useSessionState<Partial<Record<string, ChatMessage[]>>>('assistantHistory', {});
  const config = context ? pageConfig[context.pageType] : null;
  const sessionKey = context ? `${sessionId ?? 'legacy'}-${context.pageType}-${context.resultReady ? 'ready' : 'pending'}` : 'workspace-idle';
  const messages: ChatMessage[] = context && config
    ? sessions[sessionKey] ?? (context.resultReady ? [{ role: 'assistant', content: config.welcome }] : [])
    : [];
  const visibleMessages = messages.flatMap(item => {
    if (item.role === 'user') return [item];
    if (/尚未完成业务执行|当前业务尚未执行完成/.test(item.content)) return [];
    const content = item.content.replace(/\n针对“[^”]*”，以上结论由当前页面 Mock 上下文生成。$/, '')
      .replace(/当前(?:任务|模型|结果)：(?:未指定|暂无摘要|暂无)[。；]?/g, '').trim();
    return content ? [{ ...item, content }] : [];
  });

  const contextItems = useMemo(() => {
    if (!context) return [];
    return [
      { key: 'page', label: '当前页面', children: context.pageName },
      context.projectName && { key: 'project', label: '当前项目', children: context.projectName },
      context.taskName && { key: 'task', label: '当前任务', children: context.taskName },
      context.modelName && { key: 'model', label: '当前模型', children: context.modelName },
      context.dataName && { key: 'data', label: '当前数据', children: context.dataName },
      context.resultSummary && { key: 'result', label: '结果摘要', children: context.resultSummary },
    ].filter(Boolean) as Array<{ key: string; label: string; children: React.ReactNode }>;
  }, [context]);

  const clearSession = () => {
    setSessions((prev) => {
      const next = { ...prev };
      delete next[sessionKey];
      return next;
    });
  };

  const appendConversation = (prompt: string) => {
    if (!context || !config || !prompt.trim()) return;
    const next = [
      ...messages,
      { role: 'user' as const, content: prompt.trim() },
      getMockAnswer(context, prompt.trim()),
    ].filter(item => item.content);
    setSessions((prev) => ({ ...prev, [sessionKey]: next }));
    setInput('');
  };

  const handleBusinessAction = (action: string) => {
    context?.onBusinessAction?.(action as BusinessAction);
    setMobileOpen(false);
  };

  const assistantBody = () => {
    if (!context || !config) {
      return (
        <div className="workspace-ai-empty">

          <Text type="secondary">项目概览阶段不会伪造业务结果。</Text>
        </div>
      );
    }

    return (
      <div className="workspace-ai-body">
        <Card size="small" className="workspace-ai-context-card" title="当前上下文">
          <Descriptions size="small" column={1} items={contextItems} />
        </Card>

        <div className="workspace-ai-quick-actions">
          {config.quickActions.map((action) => (
            <Button size="small" key={action} onClick={() => appendConversation(action)}>{action}</Button>
          ))}
        </div>

        <div className="workspace-ai-messages">
          {visibleMessages.map((item, index) => (
            <div key={`${item.role}-${index}`} className={`workspace-ai-message ${item.role}`}>
              <Tag color={item.role === 'user' ? 'blue' : 'purple'}>{item.role === 'user' ? '用户' : 'AI'}</Tag>
              <Card size="small" className="workspace-ai-message-card">
                <Paragraph style={{ whiteSpace: 'pre-line', marginBottom: 0 }}>{item.content}</Paragraph>
              </Card>
              {item.role === 'assistant' && (
                <Space wrap size={[2, 2]}>
                  {(item.report ? ['加入报告'] : config.resultActions).map((action) => (
                    <Button type="link" size="small" key={action} onClick={() => handleBusinessAction(action)}>{action}</Button>
                  ))}
                </Space>
              )}
            </div>
          ))}
        </div>

        <div className="workspace-ai-input">
          <Input.TextArea
            autoSize={{ minRows: 1, maxRows: 3 }}
            placeholder="请输入问题……"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                appendConversation(input);
              }
            }}
          />
          <Button type="primary" icon={<SendOutlined />} disabled={!input.trim()} onClick={() => appendConversation(input)} />
        </div>
      </div>
    );
  };

  if (embedded) return <div className="session-assistant-body">{assistantBody()}</div>;

  return (
    <>
      <aside className="workspace-ai-panel">
        <div className="workspace-ai-panel-head">
          <div className="workspace-ai-title"><RobotOutlined /><span><strong>试验 AI 助手</strong><small>随当前工作区同步</small></span></div>
          <Button type="text" size="small" icon={<ClearOutlined />} disabled={!context} onClick={clearSession}>清空</Button>
        </div>
        {assistantBody()}
      </aside>

      <Button
        type="primary"
        shape="round"
        icon={<RobotOutlined />}
        className="workspace-ai-mobile-trigger"
        onClick={() => setMobileOpen(true)}
      >
        AI 助手
      </Button>

      <Drawer
        title="试验 AI 助手"
        placement="right"
        size={420}
        className="workspace-ai-mobile-drawer"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        extra={<Button type="text" size="small" icon={<ClearOutlined />} disabled={!context} onClick={clearSession}>清空会话</Button>}
      >
        {assistantBody()}
      </Drawer>
    </>
  );
};

export default TrialAIAssistant;
