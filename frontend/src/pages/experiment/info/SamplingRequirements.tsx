import React from 'react';
import { Card, Typography, Empty } from 'antd';
import { BlockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * 采样要求页面（占位）
 * @description 当前版本暂不设计，仅预留功能接口（需求1.1.4）
 */
const SamplingRequirements: React.FC = () => {
  return (
    <div>
      <Title level={4}>采样要求</Title>
      <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
        采样要求管理功能
      </Text>
      <Card style={{ marginTop: 16 }}>
        <Empty
          image={<BlockOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
          description={
            <div>
              <Text type="secondary" style={{ fontSize: 16 }}>
                该功能将在后续版本中实现
              </Text>
              <br />
              <Text type="secondary">当前版本已预留功能接口</Text>
            </div>
          }
        />
      </Card>
    </div>
  );
};

export default SamplingRequirements;
