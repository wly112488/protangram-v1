import React, { useRef } from 'react';
import { Button, Space, Typography } from 'antd';
import { CloseOutlined, CompressOutlined, ExpandOutlined, MinusOutlined } from '@ant-design/icons';
import type { WindowBounds, WorkbenchWindow as WorkbenchWindowModel } from './workbenchModel';

const { Text } = Typography;

interface WorkbenchWindowProps {
  window: WorkbenchWindowModel;
  children: React.ReactNode;
  onFocus: () => void;
  onBoundsChange: (bounds: Partial<WindowBounds>) => void;
  onMinimize: () => void;
  onClose: () => void;
}

const WorkbenchWindow: React.FC<WorkbenchWindowProps> = ({
  window,
  children,
  onFocus,
  onBoundsChange,
  onMinimize,
  onClose,
}) => {
  const dragRef = useRef<{ startX: number; startY: number; bounds: WindowBounds } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; bounds: WindowBounds } | null>(null);

  const startDrag = (event: React.MouseEvent) => {
    event.preventDefault();
    onFocus();
    dragRef.current = { startX: event.clientX, startY: event.clientY, bounds: window.bounds };
    const onMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = moveEvent.clientX - dragRef.current.startX;
      const dy = moveEvent.clientY - dragRef.current.startY;
      onBoundsChange({
        x: Math.max(0, dragRef.current.bounds.x + dx),
        y: Math.max(0, dragRef.current.bounds.y + dy),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onFocus();
    resizeRef.current = { startX: event.clientX, startY: event.clientY, bounds: window.bounds };
    const onMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = moveEvent.clientX - resizeRef.current.startX;
      const dy = moveEvent.clientY - resizeRef.current.startY;
      onBoundsChange({
        width: Math.max(320, resizeRef.current.bounds.width + dx),
        height: Math.max(220, resizeRef.current.bounds.height + dy),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <section
      className={`workbench-window ${window.minimized ? 'minimized' : ''}`}
      style={{
        left: window.bounds.x,
        top: window.bounds.y,
        width: window.bounds.width,
        height: window.minimized ? 40 : window.bounds.height,
        zIndex: window.zIndex,
      }}
      onMouseDown={onFocus}
    >
      <div className="workbench-window-titlebar" onMouseDown={startDrag}>
        <Text strong ellipsis>{window.title}</Text>
        <Space size={2} onMouseDown={(event) => event.stopPropagation()}>
          <Button
            size="small"
            type="text"
            icon={window.minimized ? <ExpandOutlined /> : <MinusOutlined />}
            onClick={onMinimize}
          />
          <Button size="small" type="text" icon={<CompressOutlined />} />
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
        </Space>
      </div>
      {!window.minimized && <div className="workbench-window-body">{children}</div>}
      {!window.minimized && <div className="workbench-window-resize" onMouseDown={startResize} />}
    </section>
  );
};

export default WorkbenchWindow;
