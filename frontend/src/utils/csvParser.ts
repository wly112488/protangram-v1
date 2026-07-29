import Papa from 'papaparse';
import type { BOMNode, TestSubject, TestMethod, ResponseVariable } from '@/types';

/**
 * 解析BOM.csv，生成装备结构树和响应变量表
 * @param csvText - CSV原始文本
 * @returns { tree: BOMNode[], variables: ResponseVariable[] }
 */
export function parseBOMCsv(csvText: string): {
  tree: BOMNode[];
  variables: ResponseVariable[];
} {
  const result = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = result.data.slice(1); // 跳过标题行

  const categoryMap = new Map<string, BOMNode>();
  const variables: ResponseVariable[] = [];

  rows.forEach((row, idx) => {
    const [category, name, ...vars] = row.map((s) => s.trim());
    if (!category || !name) return;

    const validVars = vars.filter((v) => v.length > 0);

    // 构建树节点
    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        key: `cat-${idx}`,
        category,
        title: category,
        variables: [],
        children: [],
      });
    }

    const parent = categoryMap.get(category)!;
    const childKey = `bom-${idx}`;
    parent.children!.push({
      key: childKey,
      category,
      title: name,
      variables: validVars,
    });

    // 构建响应变量表
    validVars.forEach((v) => {
      variables.push({
        category,
        component: name,
        variableName: v,
      });
    });
  });

  const tree = Array.from(categoryMap.values()).map((node, i) => ({
    ...node,
    key: `cat-${i}`,
  }));

  return { tree, variables };
}

/**
 * 解析test.csv，生成试验科目树
 * @param csvText - CSV原始文本
 * @returns TestSubject[]
 */
export function parseTestCsv(csvText: string): TestSubject[] {
  const result = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = result.data.slice(1);

  const categoryMap = new Map<string, TestSubject>();

  rows.forEach((row, idx) => {
    const [category, item] = row.map((s) => s.trim());
    if (!category || !item) return;

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        key: `tcat-${idx}`,
        category,
        title: category,
        children: [],
      });
    }

    const parent = categoryMap.get(category)!;
    parent.children!.push({
      key: `tsub-${idx}`,
      category,
      title: item,
    });
  });

  return Array.from(categoryMap.values()).map((node, i) => ({
    ...node,
    key: `tcat-${i}`,
  }));
}

/**
 * 解析testmethod.csv，生成试验设计方法列表
 * @param csvText - CSV原始文本
 * @returns TestMethod[]
 */
export function parseTestMethodCsv(csvText: string): TestMethod[] {
  const result = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = result.data.slice(1);

  const methodMap = new Map<string, string[]>();

  rows.forEach((row) => {
    const [method, factor] = row.map((s) => s.trim());
    if (!method || !factor) return;

    if (!methodMap.has(method)) {
      methodMap.set(method, []);
    }
    methodMap.get(method)!.push(factor);
  });

  const methods: TestMethod[] = [];
  methodMap.forEach((factors, name) => {
    methods.push({
      name,
      factors,
      description: generateMethodDescription(name),
    });
  });

  return methods;
}

/**
 * 根据方法名生成方法说明
 * @param name - 试验设计方法名称
 * @returns 方法说明文本
 */
function generateMethodDescription(name: string): string {
  const descriptions: Record<string, string> = {
    '单因子轮换法（OFAT）':
      '单因子轮换法（One Factor At a Time）是一种经典的试验设计方法。每次仅改变一个因子的水平，其余因子保持不变，逐一考察各因子对响应变量的影响。优点是操作简便、结果直观；缺点是无法考察因子间的交互作用，试验效率较低。',
    '全因子试验设计':
      '全因子试验设计是对所有因子的所有水平组合进行完全试验的方法。能够全面评估所有主效应和交互效应，提供最完整的信息。适用于因子数较少（通常2-4个）的场景，因子数增多时试验次数呈指数增长。',
    '部分因子试验设计':
      '部分因子试验设计是全因子设计的分数重复，通过有计划地混杂高阶交互效应来减少试验次数。适用于因子数较多（5个以上）的初步筛选阶段，以较少的试验次数识别显著因子。',
    '正交试验设计':
      '正交试验设计基于正交表安排试验，在试验次数相同的条件下具有"均匀分散、齐整可比"的特点。能够以最少的试验次数获取足够的信息，广泛应用于多因子多水平的试验优化中。',
    '响应曲面法（RSM）':
      '响应曲面法（Response Surface Methodology）通过建立因子与响应之间的数学模型来寻找最优操作条件。通常包括筛选阶段（用2^k设计）和优化阶段（用CCD或BBD设计），适用于过程优化和参数调优。',
    '均匀设计':
      '均匀设计追求试验点在试验范围内的"均匀散布"，仅考虑试验点的均匀性而不要求正交性。特别适用于水平数较多的情况，能够以极少的试验次数覆盖较大的试验空间。',
    '拉丁超立方设计（LHD）':
      '拉丁超立方设计（Latin Hypercube Design）是一种分层抽样方法，确保每个因子的边际分布均匀。适用于计算机仿真试验和不确定性分析，能够在高维空间中提供良好的空间填充效果。',
    '序贯试验设计':
      '序贯试验设计是一种边试验边分析的动态设计方法，根据前期试验结果决定后续试验方案。具有灵活性强、效率高的特点，特别适用于资源有限或试验成本较高的场景。',
  };
  return descriptions[name] || `${name}的详细说明。`;
}
