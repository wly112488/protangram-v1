import React, { useEffect, useState, useRef } from 'react';
import { Typography, Spin, message, Tag, Collapse, Button, Space, Upload, Modal, Input, Popconfirm } from 'antd';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  SettingOutlined,
  UploadOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import useAppStore from '@/stores/useAppStore';
import { parseBOMCsv } from '@/utils/csvParser';
import type { BOMNode, ResponseVariable } from '@/types';

const { Title, Text } = Typography;

// 内嵌BOM CSV数据（从项目根目录的BOM.csv读取）
const BOM_CSV = `部件类别,部件名称,变量1,变量2,变量3,变量4
机身结构部件,机身主体,材质（铝合金/复合材料）,尺寸（适配2-4座）,重量,蒙皮厚度
机身结构部件,机翼,翼展,材质（铝合金/碳纤维）,弦长,是否含襟翼调节机构
机身结构部件,尾翼,水平尾翼尺寸,垂直尾翼高度,材质,舵面行程
机身结构部件,起落架,类型（前三点/后三点）,轮胎规格,减震器行程,承载重量
动力系统部件,航空活塞发动机,功率（HP）,排量,燃油类型（汽油/航空煤油）,启动方式
动力系统部件,螺旋桨,桨叶数量,桨距类型（固定/可调）,直径,材质（木质/金属）
动力系统部件,燃油箱,容积,材质（铝合金/塑料）,安装位置,是否带油量传感器
动力系统部件,启动系统,启动电机功率,蓄电池容量,电压,使用寿命
航电与控制系统,基础航电套件,精度等级,显示方式（指针/数字）,工作电压,适配机型
航电与控制系统,飞行控制系统,操纵方式（钢索/拉杆）,行程范围,灵敏度,适配座椅数量
航电与控制系统,通信电台,频率范围（VHF）,发射功率,接收灵敏度,续航时间
航电与控制系统,导航设备,定位精度,导航模式（GPS/北斗）,屏幕尺寸,抗干扰等级
座舱与安全部件,座舱盖,材质（有机玻璃/复合材料）,透明度,尺寸,开启方式
座舱与安全部件,座椅,数量（2/4座）,材质,承重能力,是否可调节
座舱与安全部件,安全带,类型（三点式/五点式）,材质,承重,适配座椅类型
座舱与安全部件,灭火器/急救包,灭火器类型（干粉/二氧化碳）,急救包规格,有效期,存放位置
辅助部件,刹车系统,刹车类型（盘式/鼓式）,刹车力度,适配轮胎规格,使用寿命
辅助部件,散热系统,散热器尺寸,冷却风扇功率,散热效率,工作温度范围
辅助部件,照明系统,灯光类型（LED/卤素）,功率,照射范围,工作电压`;

/** 部件类别图标颜色映射 */
const CATEGORY_COLORS: Record<string, string> = {
  '机身结构部件': '#1890ff',
  '动力系统部件': '#f5222d',
  '航电与控制系统': '#52c41a',
  '座舱与安全部件': '#fa8c16',
  '辅助部件': '#722ed1',
};

const DEFAULT_COLORS = ['#1890ff', '#f5222d', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96', '#faad14', '#13c2c2'];

/**
 * 装备管理页面
 * @description 按层级分层展示装备结构，整合装备结构树和响应变量，支持上传CSV和编辑（需求1.1.1）
 */
const BOMManagement: React.FC = () => {
  const { bomTree, setBomTree } = useAppStore();
  const [variables, setVariables] = useState<ResponseVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTree, setEditTree] = useState<BOMNode[]>([]);
  const [addCategoryModal, setAddCategoryModal] = useState(false);
  const [addComponentModal, setAddComponentModal] = useState<{ visible: boolean; catKey: string }>({ visible: false, catKey: '' });
  const [addVarModal, setAddVarModal] = useState<{ visible: boolean; catKey: string; compKey: string }>({ visible: false, catKey: '', compKey: '' });
  const [inputValue, setInputValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const { tree, variables: vars } = parseBOMCsv(BOM_CSV);
      setBomTree(tree);
      setVariables(vars);
    } catch (err) {
      message.error('BOM数据解析失败');
    } finally {
      setLoading(false);
    }
  }, [setBomTree]);

  /**
   * 获取某部件的响应变量列表
   * @param category - 部件类别
   * @param component - 部件名称
   * @returns 响应变量数组
   */
  const getVarsFor = (category: string, component: string): ResponseVariable[] => {
    return variables.filter((v) => v.category === category && v.component === component);
  };

  /**
   * 处理CSV文件上传
   * @param file - 上传的CSV文件
   */
  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const { tree, variables: vars } = parseBOMCsv(csvText);
        setBomTree(tree);
        setVariables(vars);
        message.success(`CSV导入成功：${tree.length} 个类别，${vars.length} 个变量`);
      } catch (err) {
        message.error('CSV解析失败，请检查格式');
      }
    };
    reader.readAsText(file);
    return false;
  };

  /**
   * 进入编辑模式，深拷贝当前树
   */
  const enterEdit = () => {
    setEditTree(JSON.parse(JSON.stringify(bomTree)));
    setEditing(true);
  };

  /**
   * 保存编辑结果
   */
  const saveEdit = () => {
    setBomTree(editTree);
    // 重建variables
    const newVars: ResponseVariable[] = [];
    editTree.forEach((cat) => {
      cat.children?.forEach((child) => {
        child.variables.forEach((v) => {
          newVars.push({ category: cat.title, component: child.title, variableName: v });
        });
      });
    });
    setVariables(newVars);
    setEditing(false);
    message.success('保存成功');
  };

  /**
   * 取消编辑
   */
  const cancelEdit = () => {
    setEditTree([]);
    setEditing(false);
  };

  /**
   * 添加部件类别
   * @param name - 类别名称
   */
  const addCategory = (name: string) => {
    if (!name.trim()) return;
    setEditTree((prev) => [...prev, {
      key: `cat-${Date.now()}`,
      category: name.trim(),
      title: name.trim(),
      variables: [],
      children: [],
    }]);
    setAddCategoryModal(false);
    setInputValue('');
  };

  /**
   * 删除部件类别
   * @param catKey - 类别key
   */
  const deleteCategory = (catKey: string) => {
    setEditTree((prev) => prev.filter((c) => c.key !== catKey));
  };

  /**
   * 添加部件
   * @param catKey - 所属类别key
   * @param name - 部件名称
   */
  const addComponent = (catKey: string, name: string) => {
    if (!name.trim()) return;
    setEditTree((prev) => prev.map((cat) => {
      if (cat.key !== catKey) return cat;
      return {
        ...cat,
        children: [...(cat.children || []), {
          key: `comp-${Date.now()}`,
          category: cat.title,
          title: name.trim(),
          variables: [],
        }],
      };
    }));
    setAddComponentModal({ visible: false, catKey: '' });
    setInputValue('');
  };

  /**
   * 删除部件
   * @param catKey - 所属类别key
   * @param compKey - 部件key
   */
  const deleteComponent = (catKey: string, compKey: string) => {
    setEditTree((prev) => prev.map((cat) => {
      if (cat.key !== catKey) return cat;
      return { ...cat, children: cat.children?.filter((c) => c.key !== compKey) };
    }));
  };

  /**
   * 添加响应变量
   * @param catKey - 所属类别key
   * @param compKey - 所属部件key
   * @param varName - 变量名
   */
  const addVariable = (catKey: string, compKey: string, varName: string) => {
    if (!varName.trim()) return;
    setEditTree((prev) => prev.map((cat) => {
      if (cat.key !== catKey) return cat;
      return {
        ...cat,
        children: cat.children?.map((child) => {
          if (child.key !== compKey) return child;
          return { ...child, variables: [...child.variables, varName.trim()] };
        }),
      };
    }));
    setAddVarModal({ visible: false, catKey: '', compKey: '' });
    setInputValue('');
  };

  /**
   * 删除响应变量
   * @param catKey - 所属类别key
   * @param compKey - 所属部件key
   * @param varIndex - 变量索引
   */
  const deleteVariable = (catKey: string, compKey: string, varIndex: number) => {
    setEditTree((prev) => prev.map((cat) => {
      if (cat.key !== catKey) return cat;
      return {
        ...cat,
        children: cat.children?.map((child) => {
          if (child.key !== compKey) return child;
          const newVars = [...child.variables];
          newVars.splice(varIndex, 1);
          return { ...child, variables: newVars };
        }),
      };
    }));
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  /** 当前展示的数据源 */
  const displayTree = editing ? editTree : bomTree;

  /**
   * 构建Collapse项
   * @param tree - BOM树数据
   * @returns Collapse items数组
   */
  const buildItems = (tree: BOMNode[]) => tree.map((cat, catIdx) => {
    const color = CATEGORY_COLORS[cat.title] || DEFAULT_COLORS[catIdx % DEFAULT_COLORS.length];
    const childCount = cat.children?.length || 0;
    const varCount = cat.children?.reduce((sum, c) => sum + c.variables.length, 0) || 0;

    const componentItems = (cat.children || []).map((child) => {
      const compVars = editing ? child.variables : getVarsFor(cat.title, child.title).map((v) => v.variableName);
      return {
        key: child.key,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SettingOutlined style={{ color }} />
            <Text strong style={{ fontSize: 13 }}>{child.title}</Text>
            <Tag color="default" style={{ marginLeft: 'auto', fontSize: 11 }}>{compVars.length} 个变量</Tag>
            {editing && (
              <Space size={4} style={{ marginLeft: 4 }}>
                <Button
                  type="text" size="small" icon={<PlusOutlined />}
                  onClick={(e) => { e.stopPropagation(); setAddVarModal({ visible: true, catKey: cat.key, compKey: child.key }); setInputValue(''); }}
                  style={{ fontSize: 11, color: '#1890ff' }}
                >变量</Button>
                <Popconfirm title="确认删除该部件？" onConfirm={() => deleteComponent(cat.key, child.key)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                </Popconfirm>
              </Space>
            )}
          </div>
        ),
        children: (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0' }}>
            {compVars.map((v, vi) => (
              <Tag
                key={`${child.key}-${v}-${vi}`}
                closable={editing}
                onClose={() => editing && deleteVariable(cat.key, child.key, vi)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  background: '#fafafa',
                  border: '1px solid #e8e8e8',
                }}
              >
                {v}
              </Tag>
            ))}
          </div>
        ),
      };
    });

    return {
      key: cat.key,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <AppstoreOutlined style={{ fontSize: 18, color }} />
          <div style={{ flex: 1 }}>
            <Text strong style={{ fontSize: 15 }}>{cat.title}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {childCount} 个部件 · {varCount} 个响应变量
            </Text>
          </div>
          {editing && (
            <Space size={4}>
              <Button
                type="text" size="small" icon={<PlusOutlined />}
                onClick={(e) => { e.stopPropagation(); setAddComponentModal({ visible: true, catKey: cat.key }); setInputValue(''); }}
                style={{ fontSize: 11, color: '#1890ff' }}
              >部件</Button>
              <Popconfirm title="确认删除该类别及所有部件？" onConfirm={() => deleteCategory(cat.key)}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
              </Popconfirm>
            </Space>
          )}
        </div>
      ),
      children: (
        <Collapse
          ghost
          defaultActiveKey={[]}
          items={componentItems}
          style={{ marginLeft: 8 }}
        />
      ),
    };
  });

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>
            <ApartmentOutlined style={{ marginRight: 8 }} />
            装备管理
          </Title>
          <Text type="secondary">
            按层级展示装备结构与响应变量，共 {displayTree.length} 个部件类别，
            {displayTree.reduce((s, c) => s + (c.children?.length || 0), 0)} 个部件，
            {editing
              ? displayTree.reduce((s, c) => s + (c.children?.reduce((s2, ch) => s2 + ch.variables.length, 0) || 0), 0)
              : variables.length} 个响应变量
          </Text>
        </div>
        <Space>
          {!editing ? (
            <>
              <Upload accept=".csv" showUploadList={false} beforeUpload={handleUpload}>
                <Button icon={<UploadOutlined />}>导入CSV</Button>
              </Upload>
              <Button icon={<EditOutlined />} type="primary" onClick={enterEdit}>编辑</Button>
            </>
          ) : (
            <>
              <Button icon={<PlusOutlined />} onClick={() => { setAddCategoryModal(true); setInputValue(''); }}>添加类别</Button>
              <Button icon={<SaveOutlined />} type="primary" onClick={saveEdit}>保存</Button>
              <Button icon={<CloseOutlined />} onClick={cancelEdit}>取消</Button>
            </>
          )}
        </Space>
      </div>

      <Collapse
        defaultActiveKey={[]}
        items={buildItems(displayTree)}
        style={{ background: '#fff' }}
      />

      {/* 添加部件类别弹窗 */}
      <Modal
        title="添加部件类别"
        open={addCategoryModal}
        onOk={() => addCategory(inputValue)}
        onCancel={() => setAddCategoryModal(false)}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="请输入类别名称，如：液压系统部件"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={() => addCategory(inputValue)}
        />
      </Modal>

      {/* 添加部件弹窗 */}
      <Modal
        title="添加部件"
        open={addComponentModal.visible}
        onOk={() => addComponent(addComponentModal.catKey, inputValue)}
        onCancel={() => setAddComponentModal({ visible: false, catKey: '' })}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="请输入部件名称，如：液压泵"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={() => addComponent(addComponentModal.catKey, inputValue)}
        />
      </Modal>

      {/* 添加响应变量弹窗 */}
      <Modal
        title="添加响应变量"
        open={addVarModal.visible}
        onOk={() => addVariable(addVarModal.catKey, addVarModal.compKey, inputValue)}
        onCancel={() => setAddVarModal({ visible: false, catKey: '', compKey: '' })}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="请输入变量名称，如：工作压力"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={() => addVariable(addVarModal.catKey, addVarModal.compKey, inputValue)}
        />
      </Modal>
    </div>
  );
};

export default BOMManagement;
