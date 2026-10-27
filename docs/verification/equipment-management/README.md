# 物理对象管理与 CFG 关联验收

## 修改文件与实际行为

文件均相对 `frontend/src/workspace/`，另有说明的除外。

| 文件 | 职责与变化 |
| --- | --- |
| `EquipmentDirectory.tsx`（新增） | 管理模式、关联选择模式共用对象目录、参数详情、下级对象表格；使用实际对象 ID/父子关系，支持完整面包屑、同级切换、搜索和展开。 |
| `EquipmentParameterTable.tsx`（新增） | 表格内新增、编辑、保存、取消参数；复用名称、内容、单位、描述、已有 form/source 等字段，名称/内容必填，保留描述提示。 |
| `equipmentManagementModel.ts`（新增） | 参数排序、递归关联范围、选择根节点、角色保留、装备参数快照等纯逻辑。排序使用英语字母顺序、不区分大小写、数字自然序，同名以原名和 ID 稳定决胜；不改写持久化数组的顺序。 |
| `equipmentManagement.css`（新增） | 圆形勾选、选择范围高亮、表格布局；保留现有配色和 Ant Design 风格。 |
| `EquipmentAssociationPicker.tsx`（新增） | 局部选择状态、已选完整范围和参数数量、确认/取消；复用目录组件，不另建对象树或 Store。 |
| `PhysicalObjectsPage.tsx` | 对象和类别页面接入公共目录；保留原有创建组成对象、历史试验布置、试验及记录功能；参数操作改为表格内完成。 |
| `equipmentTreeProjection.ts` | 将类别真实直属 children 也纳入目录投影，保留原 ID 和归属，不推断新的组成关系。 |
| `TrialConfigurationEditor.tsx` | 新建和编辑 CFG 使用公共目录选择；确认后回填成员，逐个角色可设置；保存才写入 CFG；随父对象纳入的下级不能单独排除。 |
| `TrialConfigurationLibrary.tsx` | 提供已有 CFG 的“编辑关联”，沿用相同编辑器。 |
| `trialConfigurationStore.ts` | 新增按原 ID 更新 CFG；创建/更新时校验并补全当前全部下级引用；保持既有成员顺序和角色，独立复制输入引用数据，公共对象不被复制进 CFG。 |
| `CfgPredictionForm.tsx`、`modelPlanModel.ts` | 数字孪生/虚拟工况新运行按实际 CFG 成员记录装备、父子关系、角色及参数快照；使用现有 modelPlan 成果持久化链路。 |
| `frontend/tests/equipmentManagement.test.mjs`（新增） | 排序、子对象参数隔离、级联持久化、旧成员顺序/角色、CFG 更新、失效引用拒绝、快照和历史记录保护。 |
| `frontend/scripts/verify-equipment-management.mjs`（新增） | 浏览器实际操作和断言，截图与日志输出到本目录。 |

关联物理对象弹窗的“确认关联”先回填当前 CFG 表单，“保存 CFG”提交持久化。取消弹窗或取消整个编辑表单都不会提交尚未保存的选择。选择模式中参数只读、新增/编辑入口隐藏；退出后恢复正常管理操作。

## 验证结果

最终检查：

- `node --test tests/*.test.mjs tests/*.test.ts src/pages/report/reportModel.test.mjs`：**241 项通过，0 失败**，见 `tests.log`。
- `npm run test:sessions`：31 项通过，见相邻项目导航验收目录的 `session-tests.log`。
- `npm run build`：TypeScript 检查和 Vite 构建通过，见 `build.log`；仍有原有大体积 bundle 提示。
- `npm run lint -- --format json`：未通过，仍为工作区原有 **27 个错误、7 个警告**；与整改开始前诊断对比，无新增诊断，见 `lint.json`。未在本次整改中扩大范围修复旧问题。
- `git diff --check`：通过。
- 未发现变异测试工具或执行配置。

`browser.log` 中记录实际交互，使用已安装的 Playwright/Chromium：

1. 打开对象查看独立参数表格和下级对象表格；左侧仅有对象导航，没有参数节点。
2. 表格新增 delta、将 Alpha 修改为 Aardvark，确认保存和 A–Z 顺序。
3. 进入转子后直接切换静子再返回；新建下级对象、添加 ChildOnly 参数，父对象没有该参数。
4. CFG 选择父对象，圆形勾选及选择范围包含其全部五个对象、七项参数；展开/折叠及同级切换后状态不变。
5. 取消不写成员；确认并保存后浏览器存储包含所有对象 ID 和角色，刷新后不丢失；再次编辑并取消不改变 CFG。
6. 实际运行并保存数字孪生，保存的 modelPlan 包含完整装备快照；将叶片公共参数从 12 改为 999 后刷新，保存成果仍为 12，既有试验记录实际条件仍为 10，CFG 的引用不改变。
7. 首页直接点击顶部功能后创建新命名会话，进入所选数据分析功能，没有改动原有对象。
8. 无浏览器运行时错误。

前一项项目导航、五功能路由、跨功能成果汇总及任务隔离的完整浏览器结果见 [项目导航验收](../project-navigation/README.md)。

## 能力边界

本次实现的是已有前端 Store/localStorage 的真实持久化与引用关系，没有新增后端接口，也未验证服务端同步。测试 API 为空列表桩，数字孪生、虚拟工况仍是既有演示计算，不能据此宣称真实计算后端验收通过。

级联选择在确认/保存时展开当前对象目录，保存的是已有对象 ID；公共参数继续通过这些 ID 读取。后续新增下级对象需要重新进入 CFG 关联选择并保存，既有 CFG 和历史运行不会被悄悄改写。已有 CFG 不在加载时自动重写。历史记录原来未保存的装备参数快照无法补造；完整快照仅适用于本次修改后的数字孪生/虚拟工况新运行，其他功能继续保留其已有输入/结果记录能力。
