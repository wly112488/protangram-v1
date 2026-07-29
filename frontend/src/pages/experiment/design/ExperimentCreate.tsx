import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography, Form, Input, Button, Tree, Upload, message, Space,
} from 'antd';
import {
  SaveOutlined, ArrowLeftOutlined, UploadOutlined, RobotOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import useAppStore from '@/stores/useAppStore';
import { saveExperiments, loadExperiments } from '@/utils/storage';
import { parseBOMCsv, parseTestCsv } from '@/utils/csvParser';
import type { ExperimentCard, AttachmentInfo, BOMNode, TestSubject } from '@/types';

const { Title, Text } = Typography;
const { TextArea } = Input;

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
 * 试验卡片新建/编辑页面
 * @description 支持填写基本信息、选择装备/科目、附件上传（需求1.2.2, 1.2.3）
 */
const ExperimentCreate: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const { experiments, addExperiment, updateExperiment, setExperiments } = useAppStore();

  const [selectedBomKeys, setSelectedBomKeys] = useState<string[]>([]);
  const [selectedBomNames, setSelectedBomNames] = useState<string[]>([]);
  const [selectedSubjectKeys, setSelectedSubjectKeys] = useState<string[]>([]);
  const [selectedSubjectNames, setSelectedSubjectNames] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [bomTree, setBomTree] = useState<BOMNode[]>([]);
  const [subjectTree, setSubjectTree] = useState<TestSubject[]>([]);

  // 展开/折叠状态持久化 key（按试验卡片 ID 隔离，新建页用独立 key）
  const storageKeyBom = id ? `tangram_bom_expanded_${id}` : 'tangram_bom_expanded_new';
  const storageKeySubject = id ? `tangram_subject_expanded_${id}` : 'tangram_subject_expanded_new';
  /** 从 sessionStorage 读取初始展开 keys，无缓存则默认全折叠 */
  const readExpandedKeys = (key: string): string[] => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  };
  const bomDefaultExpanded = useMemo(() => readExpandedKeys(storageKeyBom), [storageKeyBom]);
  const subjectDefaultExpanded = useMemo(() => readExpandedKeys(storageKeySubject), [storageKeySubject]);

  const isEdit = !!id;

  useEffect(() => {
    const { tree } = parseBOMCsv(BOM_CSV);
    setBomTree(tree);
    const subjects = parseTestCsv(TEST_CSV);
    setSubjectTree(subjects);
  }, []);

  useEffect(() => {
    if (isEdit) {
      let allExps = experiments;
      if (allExps.length === 0) {
        allExps = loadExperiments();
        if (allExps.length > 0) setExperiments(allExps);
      }
      const exp = allExps.find((e) => e.id === id);
      if (exp) {
        form.setFieldsValue({
          name: exp.name,
          testGoal: exp.testGoal,
          objectDescription: exp.objectDescription,
        });
        setSelectedBomKeys(exp.testObjects);
        setSelectedBomNames(exp.testObjectNames);
        setSelectedSubjectKeys(exp.testSubjects);
        setSelectedSubjectNames(exp.testSubjectNames);
        setAttachments(exp.attachments || []);
      }
    }
  }, [id, experiments, form, isEdit, setExperiments]);

  /**
   * 获取BOM节点名称
   */
  const getBomNodeName = (key: string): string => {
    for (const cat of bomTree) {
      if (cat.key === key) return cat.title;
      const child = cat.children?.find((c) => c.key === key);
      if (child) return child.title;
    }
    return key;
  };

  /**
   * 获取试验科目名称
   */
  const getSubjectName = (key: string): string => {
    for (const cat of subjectTree) {
      if (cat.key === key) return cat.title;
      const child = cat.children?.find((c) => c.key === key);
      if (child) return child.title;
    }
    return key;
  };

  /**
   * 保存试验卡片
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const card: ExperimentCard = {
        id: isEdit ? id! : uuidv4(),
        name: values.name,
        createTime: isEdit
          ? experiments.find((e) => e.id === id)?.createTime || dayjs().format('YYYY-MM-DD HH:mm:ss')
          : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        testObjects: selectedBomKeys,
        testObjectNames: selectedBomNames,
        testSubjects: selectedSubjectKeys,
        testSubjectNames: selectedSubjectNames,
        testGoal: values.testGoal || '',
        testMethod: '',
        objectDescription: values.objectDescription || '',
        attachments,
        hasOutline: isEdit ? experiments.find((e) => e.id === id)?.hasOutline || false : false,
        outline: isEdit ? experiments.find((e) => e.id === id)?.outline : undefined,
      };

      if (isEdit) {
        updateExperiment(id!, card);
        const allExps = loadExperiments().map((e) => (e.id === id ? card : e));
        saveExperiments(allExps);
      } else {
        addExperiment(card);
        const allExps = loadExperiments();
        allExps.push(card);
        saveExperiments(allExps);
      }

      message.success(isEdit ? '试验卡片已更新' : '试验卡片已创建');
      navigate('/experiment/design');
    } catch {
      message.error('请填写必要信息');
    }
  };

  /**
   * 处理附件上传
   */
  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const att: AttachmentInfo = {
        fileName: file.name,
        fileSize: file.size,
        uploadTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        content: e.target?.result as string,
      };
      setAttachments((prev) => [...prev, att]);
      message.success(`${file.name} 上传成功`);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const bomTreeData = bomTree.map((cat) => ({
    key: cat.key,
    title: cat.title,
    children: cat.children?.map((child) => ({
      key: child.key,
      title: child.title,
    })),
  }));

  const subjectTreeData = subjectTree.map((cat) => ({
    key: cat.key,
    title: cat.title,
    children: cat.children?.map((child) => ({
      key: child.key,
      title: child.title,
    })),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8, flexShrink: 0 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/experiment/design')}>
          返回
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {isEdit ? '编辑试验卡片' : '新建试验卡片'}
        </Title>
        <div style={{ flex: 1 }} />
        <Space>
          <Button onClick={() => navigate('/experiment/design')}>取消</Button>
          <Button icon={<RobotOutlined />}>AI 辅助填写</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical" style={{ marginBottom: 0, flex: 1, minHeight: 0 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gridTemplateRows: 'auto 1fr 2fr 1fr',
          gap: '10px 14px',
          height: '100%',
        }}>
          {/* 试验名称 */}
          <div style={{ background: '#fafafa', borderRadius: 8, padding: '10px 14px', border: '1px solid #f0f0f0' }}>
            <Form.Item label="试验名称" name="name" rules={[{ required: true, message: '请输入试验名称' }]} style={{ marginBottom: 0 }}>
              <Input placeholder="请输入试验名称" />
            </Form.Item>
          </div>

          {/* 试验目的 - 占右侧两列 */}
          <div style={{ background: '#fafafa', borderRadius: 8, padding: '10px 14px', border: '1px solid #f0f0f0', gridColumn: '2 / 4' }}>
            <Form.Item label="试验目的" name="testGoal" style={{ marginBottom: 0 }}>
              <Input placeholder="请输入试验目的" />
            </Form.Item>
          </div>

          {/* 试验对象 - 左列占2~4行 */}
          <div style={{ background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', gridRow: '2 / 5' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
              <Text strong style={{ fontSize: 13 }}>试验对象（装备结构）</Text>
              {selectedBomKeys.length > 0 && (
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>已选 {selectedBomKeys.length} 项</Text>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 10px' }}>
              {bomTree.length > 0 && (
              <Tree
                key={storageKeyBom}
                checkable
                treeData={bomTreeData}
                defaultExpandedKeys={bomDefaultExpanded}
                onExpand={(keys) => {
                  sessionStorage.setItem(storageKeyBom, JSON.stringify(keys));
                }}
                checkedKeys={selectedBomKeys}
                onCheck={(keys) => {
                  const checkedKeys = keys as string[];
                  setSelectedBomKeys(checkedKeys);
                  setSelectedBomNames(checkedKeys.map(getBomNodeName));
                }}
                style={{ background: 'transparent', fontSize: 12 }}
              />
              )}
            </div>
          </div>

          {/* 试验科目 - 中列占2~4行 */}
          <div style={{ background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', overflow: 'hidden', gridRow: '2 / 5' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
              <Text strong style={{ fontSize: 13 }}>试验科目</Text>
              {selectedSubjectKeys.length > 0 && (
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>已选 {selectedSubjectKeys.length} 项</Text>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 10px' }}>
              {subjectTree.length > 0 && (
              <Tree
                key={storageKeySubject}
                checkable
                treeData={subjectTreeData}
                defaultExpandedKeys={subjectDefaultExpanded}
                onExpand={(keys) => {
                  sessionStorage.setItem(storageKeySubject, JSON.stringify(keys));
                }}
                checkedKeys={selectedSubjectKeys}
                onCheck={(keys) => {
                  const checkedKeys = keys as string[];
                  setSelectedSubjectKeys(checkedKeys);
                  setSelectedSubjectNames(checkedKeys.map(getSubjectName));
                }}
                style={{ background: 'transparent', fontSize: 12 }}
              />
              )}
            </div>
          </div>

          {/* 试验对象描述 - 右列第2~3行 */}
          <div className="desc-panel" style={{ background: '#fafafa', borderRadius: 8, padding: '10px 14px', border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gridRow: '2 / 4' }}>
            <Text strong style={{ fontSize: 13, marginBottom: 6, flexShrink: 0 }}>试验对象描述</Text>
            <Form.Item name="objectDescription" style={{ marginBottom: 0, flex: 1 }}>
              <TextArea style={{ resize: 'none' }} placeholder="请详细描述试验对象..." />
            </Form.Item>
          </div>

          {/* 相关附件 - 右列第4行 */}
          <div style={{ background: '#fafafa', borderRadius: 8, padding: '10px 14px', border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, flexShrink: 0 }}>
              <Text strong style={{ fontSize: 13 }}>相关附件</Text>
              <Upload beforeUpload={handleUpload} showUploadList={false} multiple>
                <Button type="link" size="small" icon={<UploadOutlined />} style={{ marginLeft: 8, padding: 0 }}>
                  上传
                </Button>
              </Upload>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {attachments.length > 0 ? (
                attachments.map((att, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <a
                      style={{ fontSize: 12 }}
                      onClick={() => {
                        if (att.content) {
                          const link = document.createElement('a');
                          link.href = att.content;
                          link.download = att.fileName;
                          link.click();
                        }
                      }}
                    >
                      {att.fileName}
                    </a>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      ({(att.fileSize / 1024).toFixed(1)}KB)
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ padding: 0, height: 'auto' }}
                    />
                  </div>
                ))
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>无附件</Text>
              )}
            </div>
          </div>
        </div>
      </Form>

    </div>
  );
};

export default ExperimentCreate;
