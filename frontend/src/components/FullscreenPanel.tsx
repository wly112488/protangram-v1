import React, { useState, useEffect } from 'react';
import { Button, Card, Alert, Space } from 'antd';
import { CloseOutlined, FullscreenExitOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons';

interface FullscreenPanelProps {
  visible: boolean;
  onClose: () => void;
  url?: string;
  title?: string;
}

/**
 * 全屏面板组件
 * @description 用于显示外部URL内容的全屏面板，与主面板大小一致
 */
const FullscreenPanel: React.FC<FullscreenPanelProps> = ({
  visible,
  onClose,
  url,
  title = '外部内容'
}) => {
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 当面板显示或URL变化时重置状态
  useEffect(() => {
    if (visible && url) {
      setLoadError(false);
      setIsLoading(true);
    }
  }, [visible, url]);

  if (!visible) return null;

  /**
   * 处理iframe加载错误
   */
  const handleIframeError = () => {
    setLoadError(true);
    setIsLoading(false);
  };

  /**
   * 处理iframe加载成功
   */
  const handleIframeLoad = () => {
    setLoadError(false);
    setIsLoading(false);
  };

  /**
   * 重新加载iframe
   */
  const handleReload = () => {
    setLoadError(false);
    setIsLoading(true);
  };

  /**
   * 在新窗口打开URL
   */
  const handleOpenInNewWindow = () => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <Card
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 40px)',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        styles={{
          body: {
            padding: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部工具栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            backgroundColor: '#fafafa',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FullscreenExitOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
            {url && (
              <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
                {url}
              </span>
            )}
          </div>
          <Space>
            {url && (
              <>
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={handleReload}
                  title="重新加载"
                />
                <Button
                  type="text"
                  icon={<LinkOutlined />}
                  onClick={handleOpenInNewWindow}
                  title="在新窗口打开"
                />
              </>
            )}
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </Space>
        </div>

        {/* 内容区域 */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {url ? (
            <>
              {loadError && (
                <div style={{ padding: 16 }}>
                  <Alert
                    message="无法加载页面"
                    description={
                      <div>
                        <p>该网站可能不允许在iframe中显示，这通常是由于安全策略限制。</p>
                        <p><strong>解决方案：</strong></p>
                        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                          <li>点击"在新窗口打开"按钮在浏览器新标签页中查看</li>
                          <li>尝试使用支持iframe嵌入的URL</li>
                          <li>使用本地服务或API接口地址</li>
                        </ul>
                      </div>
                    }
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    action={
                      <Space>
                        <Button size="small" onClick={handleReload}>
                          重试
                        </Button>
                        <Button size="small" type="primary" onClick={handleOpenInNewWindow}>
                          新窗口打开
                        </Button>
                      </Space>
                    }
                  />
                </div>
              )}
              
              {isLoading && !loadError && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#1890ff',
                    fontSize: 16,
                  }}
                >
                  正在加载页面...
                </div>
              )}
              
              <iframe
                key={url} // 强制重新渲染
                src={url}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderRadius: '0 0 12px 12px',
                  display: loadError ? 'none' : 'block',
                }}
                title={title}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#999',
                fontSize: 16,
              }}
            >
              请提供要加载的URL地址
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default FullscreenPanel;
