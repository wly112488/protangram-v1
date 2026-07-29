import React, { useEffect, useState } from 'react';
import { Tree, Card, Typography, Spin, message, Tag, Table } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import useAppStore from '@/stores/useAppStore';
import { parseTestCsv } from '@/utils/csvParser';

const { Title, Text } = Typography;

const TEST_CSV = `试验大类,具体试验项
环境适应性类,高低温试验
环境适应性类,温度冲击试验
环境适应性类,湿热试验
环境适应性类,低气压/高度试验
环境适应性类,淋雨/防水试验
环境适应性类,防尘试验
环境适应性类,盐雾试验
环境适应性类,霉菌试验
环境适应性类,日照/辐射试验
力学环境与可靠性类,振动试验（正弦、随机、冲击响应谱）
力学环境与可靠性类,冲击试验（半正弦、梯形、后峰锯齿）
力学环境与可靠性类,跌落试验
力学环境与可靠性类,运输试验
力学环境与可靠性类,颠震试验
力学环境与可靠性类,碰撞试验
力学环境与可靠性类,稳定性试验（静稳、动稳、倾覆稳定性）
力学环境与可靠性类,强度与刚度试验
力学环境与可靠性类,疲劳耐久试验
力学环境与可靠性类,可靠性增长/可靠性鉴定试验
性能与功能类,功能检查试验
性能与功能类,性能参数测试
性能与功能类,精度/准确度试验
性能与功能类,负载/额定工况试验
性能与功能类,过载试验
性能与功能类,连续工作试验
性能与功能类,启动/停机试验
性能与功能类,调速/变速/变工况试验
性能与功能类,联动/协同控制试验
安全与防护类,安全保护试验（急停、限位、联锁）
安全与防护类,绝缘/耐压/接地试验
安全与防护类,电磁兼容EMC试验
安全与防护类,防火/阻燃试验
安全与防护类,防爆试验
安全与防护类,噪声测试
安全与防护类,泄漏试验（气密、液密）
综合与考核类,系统联调试验
综合与考核类,工况模拟试验
综合与考核类,外场考核试验
综合与考核类,极限工况试验
综合与考核类,故障注入/容错试验
综合与考核类,维修性/拆装试验
综合与考核类,人机工效试验`;

/**
 * 试验科目页面
 * @description 展示试验科目层级结构（需求1.1.2）
 */
const TestSubjects: React.FC = () => {
  const { testSubjects, setTestSubjects } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    try {
      const subjects = parseTestCsv(TEST_CSV);
      setTestSubjects(subjects);
    } catch {
      message.error('试验科目数据解析失败');
    } finally {
      setLoading(false);
    }
  }, [setTestSubjects]);

  const treeData = testSubjects.map((cat) => ({
    key: cat.key,
    title: (
      <span>
        <BookOutlined style={{ marginRight: 4, color: '#1890ff' }} />
        <strong>{cat.title}</strong>
        <Tag color="blue" style={{ marginLeft: 8 }}>
          {cat.children?.length || 0}项
        </Tag>
      </span>
    ),
    children: cat.children?.map((child) => ({
      key: child.key,
      title: child.title,
    })),
  }));

  // 构建表格数据
  const tableData = testSubjects.flatMap((cat) =>
    (cat.children || []).map((child, idx) => ({
      key: child.key,
      category: cat.title,
      name: child.title,
      index: idx + 1,
    }))
  );

  const filteredTableData = selectedCategory
    ? tableData.filter((d) => d.category === selectedCategory)
    : tableData;

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Title level={4} style={{ flexShrink: 0 }}>试验科目</Title>
      <Text type="secondary" style={{ marginBottom: 12, display: 'block', flexShrink: 0 }}>
        基于test.csv文件按层级结构展示试验科目
      </Text>
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        <Card title="科目树" style={{ width: 400, height: '100%', overflow: 'auto' }}>
          <Tree
            treeData={treeData}
            onSelect={(keys) => {
              if (keys.length > 0) {
                const node = testSubjects.find((n) => n.key === keys[0]);
                setSelectedCategory(node ? node.title : '');
              } else {
                setSelectedCategory('');
              }
            }}
          />
        </Card>
        <Card
          title={
            <span>
              科目列表
              {selectedCategory && (
                <Tag color="orange" style={{ marginLeft: 8 }}>
                  {selectedCategory}
                </Tag>
              )}
            </span>
          }
          style={{ flex: 1, height: '100%', overflow: 'auto' }}
        >
          <Table
            dataSource={filteredTableData}
            columns={[
              { title: '序号', dataIndex: 'index', key: 'index', width: 60 },
              {
                title: '试验大类',
                dataIndex: 'category',
                key: 'category',
                render: (text: string) => <Tag color="blue">{text}</Tag>,
              },
              { title: '具体试验项', dataIndex: 'name', key: 'name' },
            ]}
            size="small"
            pagination={{ pageSize: 15 }}
          />
        </Card>
      </div>
    </div>
  );
};

export default TestSubjects;
