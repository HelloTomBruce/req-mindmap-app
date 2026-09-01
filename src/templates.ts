import { Priority, Status } from './types';

export interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  iconName: 'FileText' | 'Code2' | 'Database' | 'Layout' | 'Wrench' | 'Sparkles';
  category: 'feature' | 'technical' | 'design' | 'general';
  defaultTitle: string;
  defaultPriority: Priority;
  defaultStatus: Status;
  defaultTags: string[];
  markdownSkeleton: string; // 静态 Markdown 骨架内容
  generateContent?: (title: string) => string;
}

// 辅助函数：根据模板骨架生成带标题的 Markdown 内容
export const renderTemplateMarkdown = (tmpl: NodeTemplate, title?: string): string => {
  const t = title || tmpl.defaultTitle || '新需求';
  const skeleton = tmpl.markdownSkeleton || '';
  if (skeleton.startsWith('# ')) {
    const lines = skeleton.split('\n');
    lines[0] = `# ${t}`;
    return lines.join('\n');
  }
  return `# ${t}\n\n` + skeleton;
};

export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    id: 'feature',
    name: '业务功能需求',
    description: '适用于标准业务功能、用户故事与完整产品逻辑拆解',
    iconName: 'Sparkles',
    category: 'feature',
    defaultTitle: '新功能需求',
    defaultPriority: 'P1',
    defaultStatus: 'todo',
    defaultTags: ['功能', '业务'],
    markdownSkeleton: `# 新功能需求

## 1. 需求背景与目标
- **业务价值**：描述该功能解决的核心痛点或业务诉求
- **目标用户**：面向的使用角色/群体

## 2. 用户故事 (User Story)
> 作为【某类用户】，我希望能够【执行某项操作】，以便于【达成某种业务收益】。

## 3. 详细业务规则与流程
1. 前置条件与权限校验
2. 核心操作路径与状态流转
3. 关键交互约束

## 4. 边界情况与异常处理
- 网络异常/超时重试机制
- 数据为空/极值/特殊字符处理
- 并发冲突策略

## 5. 验收标准 (Acceptance Criteria)
- [ ] 场景1：正常主流程走通
- [ ] 场景2：异常拦截与明确提示
`
  },
  {
    id: 'api',
    name: 'API 接口规范',
    description: '适用于后端接口设计、参数输入输出与鉴权协议定义',
    iconName: 'Code2',
    category: 'technical',
    defaultTitle: 'API 接口设计',
    defaultPriority: 'P1',
    defaultStatus: 'todo',
    defaultTags: ['后端', 'API'],
    markdownSkeleton: `# API 接口设计

## 1. 接口基本信息
- **接口地址**：\`/api/v1/resource/action\`
- **请求方法**：\`POST\`
- **接口说明**：简要说明该接口的作用与触发时机
- **认证方式**：\`Bearer Token\`

## 2. 请求参数 (Request)
### Header 参数
| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| \`Authorization\` | string | 是 | 用户鉴权 Token |

### Body (JSON)
\`\`\`json
{
  "exampleId": "1001",
  "actionType": "SUBMIT",
  "payload": {
    "remark": "备注信息"
  }
}
\`\`\`

## 3. 响应结构 (Response)
### 成功响应 (HTTP 200)
\`\`\`json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "1001",
    "status": "SUCCESS"
  }
}
\`\`\`

## 4. 错误码定义
| 错误码 | 对应 HTTP 状态 | 说明 |
| :--- | :--- | :--- |
| \`40001\` | 400 | 参数校验不通过 |
| \`40100\` | 401 | 登录失效或无权限 |
`
  },
  {
    id: 'database',
    name: '数据表/实体设计',
    description: '适用于数据表建模、实体字段字典及索引约束规划',
    iconName: 'Database',
    category: 'technical',
    defaultTitle: '数据表设计',
    defaultPriority: 'P1',
    defaultStatus: 'todo',
    defaultTags: ['数据库', '存储'],
    markdownSkeleton: `# 数据表设计

## 1. 数据表概述
- **表名**：\`t_business_entity\`
- **中文名称**：业务实体表
- **存储引擎/说明**：InnoDB / UTF8MB4

## 2. 字段字典设计
| 字段名 | 类型 | 允许为空 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| \`id\` | BIGINT UNSIGNED | 否 | AUTO_INCREMENT | 主键 ID |
| \`created_at\` | DATETIME | 否 | CURRENT_TIMESTAMP | 创建时间 |
| \`updated_at\` | DATETIME | 否 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间 |
| \`status\` | VARCHAR(32) | 否 | 'DRAFT' | 状态枚举值 |

## 3. 索引设计
- **主键索引**：\`PRIMARY KEY (id)\`
- **普通索引**：\`idx_status (status)\`
`
  },
  {
    id: 'ui_spec',
    name: 'UI/UX 页面交互',
    description: '适用于前端页面布局、组件视觉状态与交互反馈规范',
    iconName: 'Layout',
    category: 'design',
    defaultTitle: '页面交互规范',
    defaultPriority: 'P2',
    defaultStatus: 'todo',
    defaultTags: ['前端', '交互'],
    markdownSkeleton: `# 页面交互规范

## 1. 页面概述
- **原型/设计稿链接**：[查看 Figma/蓝湖设计稿](https://figma.com)
- **适配要求**：响应式支持 / 桌面端 (最小宽度 1280px)

## 2. 页面布局与模块分区
1. **顶部操作栏**：标题展示、主副操作按钮
2. **内容主体区**：数据列表 / 图表展示
3. **底部状态栏**：统计信息与分页控件

## 3. 交互状态规范
- **默认态 (Default)**：正常展示
- **悬停态 (Hover)**：背景色轻微变化，出现提示浮层
- **加载态 (Loading)**：骨架屏加载或局部 Spin
- **空状态 (Empty)**：显示插画提示与引导创建按钮
`
  },
  {
    id: 'task',
    name: '技术改造/任务',
    description: '适用于代码重构、技术改造、性能优化或缺陷排查',
    iconName: 'Wrench',
    category: 'technical',
    defaultTitle: '技术改造任务',
    defaultPriority: 'P2',
    defaultStatus: 'todo',
    defaultTags: ['重构', '技术任务'],
    markdownSkeleton: `# 技术改造任务

## 1. 当前现状与痛点
- 描述当前存在的技术债务、性能瓶颈或缺陷根因

## 2. 改造目标
- **定性目标**：架构解耦、提升可维护性
- **定量指标**：响应耗时降低 30%、错误率降为 0

## 3. 技术实施方案
1. 步骤一：接口适配与兼容层设计
2. 步骤二：核心逻辑重构
3. 步骤三：数据平滑迁移方案

## 4. 风险与回滚预案
- **潜在风险**：旧版本兼容性
- **回滚方案**：配置开关秒级降级
`
  },
  {
    id: 'blank',
    name: '通用空白节点',
    description: '最简节点，适合自定义编写需求内容',
    iconName: 'FileText',
    category: 'general',
    defaultTitle: '新建需求节点',
    defaultPriority: 'P2',
    defaultStatus: 'todo',
    defaultTags: ['新需求'],
    markdownSkeleton: `# 新建需求节点

请在此处编写需求详细描述...
`
  }
];
