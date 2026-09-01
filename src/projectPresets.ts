import { MindNode } from './types';

export interface ProjectPreset {
  id: string;
  name: string;
  description: string;
  iconName: 'Sparkles' | 'Code2' | 'Database' | 'Layout' | 'BookOpen' | 'FileText';
  defaultProjectName: string;
  generateInitialData: (projectName: string) => {
    root: MindNode;
    docsMap: Record<string, string>;
  };
}

export const PROJECT_PRESETS: ProjectPreset[] = [
  {
    id: 'prd',
    name: '产品需求规范 (PRD)',
    description: '适用于完整产品功能规划、用户故事与端到端业务拆解',
    iconName: 'Sparkles',
    defaultProjectName: '智能新零售业务 PRD',
    generateInitialData: (projectName: string) => {
      const docsMap: Record<string, string> = {};
      
      docsMap['index.md'] = `# ${projectName} - 产品需求规格说明书

## 1. 产品愿景与定位
- **核心定位**：一句话定义本产品的核心价值与受众
- **业务目标**：定性与定量业务指标 (如 GMV、留存率、转化率)

## 2. 核心用户角色
- **普通用户**：前台浏览、下单与互动
- **运营人员**：后台配置、活动发布与数据复盘
`;

      docsMap['modules/user_story.md'] = `# 用户故事与核心主路径

## 核心业务旅程 (User Journey)
1. **发现阶段**：用户通过首页推荐或精准搜索找到目标商品
2. **决策阶段**：进入详情页查看规格、评价与优惠信息
3. **转化阶段**：加入购物车并完成在线支付
4. **履约阶段**：实时查看物流进度并完成确认收货
`;

      docsMap['modules/feature_catalog.md'] = `# 核心功能模块清单

## 模块规划
- [x] 商品浏览与搜索过滤
- [ ] 购物车与跨店满减结算
- [ ] 订单状态机流转与履约跟踪
- [ ] 会员积分与优惠券系统
`;

      docsMap['modules/metrics.md'] = `# 埋点规范与成功指标

## 核心指标看板
- **转化率指标**：详情页到支付成功转化率 (目标 > 12%)
- **核心埋点事件**：
  - \`view_item_detail\` (商品曝光)
  - \`click_add_to_cart\` (加购)
  - \`submit_order_success\` (下单成功)
`;

      const root: MindNode = {
        id: 'root-node',
        title: projectName,
        docPath: 'index.md',
        status: 'in_progress',
        priority: 'P0',
        tags: ['PRD', '产品规划'],
        children: [
          {
            id: 'node-user-story',
            title: '用户故事与核心主路径',
            docPath: 'modules/user_story.md',
            status: 'todo',
            priority: 'P1',
            tags: ['用户旅程', '流程']
          },
          {
            id: 'node-feature-catalog',
            title: '核心功能模块清单',
            docPath: 'modules/feature_catalog.md',
            status: 'in_progress',
            priority: 'P0',
            tags: ['功能', '需求矩阵']
          },
          {
            id: 'node-metrics',
            title: '埋点规范与成功指标',
            docPath: 'modules/metrics.md',
            status: 'todo',
            priority: 'P2',
            tags: ['数据', '指标']
          }
        ]
      };

      return { root, docsMap };
    }
  },
  {
    id: 'architecture',
    name: '系统技术架构设计 (Tech Specs)',
    description: '适用于系统分层设计、微服务拓扑、模块职责与技术演进方案',
    iconName: 'Database',
    defaultProjectName: '分布式交易中台技术设计',
    generateInitialData: (projectName: string) => {
      const docsMap: Record<string, string> = {};

      docsMap['index.md'] = `# ${projectName} - 技术方案设计说明书

## 1. 架构设计原则
- **高可用**：核心链路无单点故障，关键依赖具备降级方案
- **水平扩展**：无状态服务设计，支持秒级容器水平扩缩容
- **领域驱动**：按业务限界上下文清晰划分模块边界
`;

      docsMap['modules/topology.md'] = `# 系统总体架构拓扑与分层

## 架构分层设计
1. **接入网关层 (API Gateway)**：统一鉴权、限流、协议转换与路由分发
2. **业务聚合层 (BFF)**：面向端场景聚合接口数据
3. **领域核心服务层 (Domain Services)**：用户中心、交易中心、履约中心
4. **数据存储层 (Storage)**：MySQL 主从分库分表 + Redis 分布式缓存 + Kafka 消息总线
`;

      docsMap['modules/dataflow.md'] = `# 核心数据流与事务一致性

## 分布式事务方案
- **主流程**：采用 SAGA / 本地消息表模式保证最终一致性
- **幂等设计**：基于唯一业务流水号 (\`biz_order_no\`) 实现 Redis + 数据库唯一键双重防重
`;

      docsMap['modules/ha_dr.md'] = `# 高可用、限流与容灾预案

## 容灾策略
- **熔断降级**：Sentinel 规则配置，下游超时 > 800ms 触发自动熔断
- **压测与容量规划**：支撑日常峰值 5,000 QPS，大促弹性支撑 30,000 QPS
`;

      const root: MindNode = {
        id: 'root-node',
        title: projectName,
        docPath: 'index.md',
        status: 'in_progress',
        priority: 'P0',
        tags: ['架构', '技术方案'],
        children: [
          {
            id: 'node-topology',
            title: '系统总体架构拓扑与分层',
            docPath: 'modules/topology.md',
            status: 'todo',
            priority: 'P0',
            tags: ['分层', '拓扑']
          },
          {
            id: 'node-dataflow',
            title: '核心数据流与事务一致性',
            docPath: 'modules/dataflow.md',
            status: 'todo',
            priority: 'P1',
            tags: ['数据流', '一致性']
          },
          {
            id: 'node-ha-dr',
            title: '高可用、限流与容灾预案',
            docPath: 'modules/ha_dr.md',
            status: 'todo',
            priority: 'P1',
            tags: ['容灾', 'SLA']
          }
        ]
      };

      return { root, docsMap };
    }
  },
  {
    id: 'api_doc',
    name: 'RESTful API 开放接口库',
    description: '适用于微服务接口定义、公共协议、参数字典与错误码规范',
    iconName: 'Code2',
    defaultProjectName: 'OpenAPI 开放接口规范',
    generateInitialData: (projectName: string) => {
      const docsMap: Record<string, string> = {};

      docsMap['index.md'] = `# ${projectName}

## 1. 基础规范说明
- **基础域名 (Base URL)**：\`https://api.example.com/v1\`
- **数据格式**：统一采用 \`application/json; charset=utf-8\`
- **鉴权认证**：\`Authorization: Bearer <access_token>\`

## 2. 通用返回结构
\`\`\`json
{
  "code": 0,
  "message": "success",
  "data": {},
  "timestamp": 1772438400000
}
\`\`\`
`;

      docsMap['modules/auth_api.md'] = `# 身份认证与 Token 刷新接口

## POST /api/v1/auth/login
- **功能说明**：通过账号密码或短信验证码获取登录凭据
- **入参**：\`{ "username": "...", "password": "..." }\`
- **出参**：\`{ "token": "...", "expiresIn": 7200 }\`
`;

      docsMap['modules/resource_api.md'] = `# 业务资源操作接口

## GET /api/v1/resources
- **查询列表**：支持 \`page\`、\`pageSize\`、\`status\`、\`keyword\` 过滤

## POST /api/v1/resources
- **创建资源**：包含名称、分类与配置对象
`;

      docsMap['modules/error_codes.md'] = `# 全局错误码字典与 HTTP 映射

| 错误码 | HTTP 状态 | 说明 |
| :--- | :--- | :--- |
| \`0\` | 200 | 成功 |
| \`40001\` | 400 | 请求参数格式错误或必填项缺失 |
| \`40100\` | 401 | 未登录或 Token 已过期 |
| \`40300\` | 403 | 角色权限不足 |
| \`50000\` | 500 | 服务器内部错误 |
`;

      const root: MindNode = {
        id: 'root-node',
        title: projectName,
        docPath: 'index.md',
        status: 'in_progress',
        priority: 'P0',
        tags: ['API', '接口文档'],
        children: [
          {
            id: 'node-auth-api',
            title: '身份认证与凭据接口',
            docPath: 'modules/auth_api.md',
            status: 'todo',
            priority: 'P0',
            tags: ['鉴权', 'Auth']
          },
          {
            id: 'node-resource-api',
            title: '核心业务资源接口',
            docPath: 'modules/resource_api.md',
            status: 'todo',
            priority: 'P1',
            tags: ['CRUD', '业务']
          },
          {
            id: 'node-error-codes',
            title: '全局错误码字典',
            docPath: 'modules/error_codes.md',
            status: 'completed',
            priority: 'P2',
            tags: ['规范', '字典']
          }
        ]
      };

      return { root, docsMap };
    }
  },
  {
    id: 'team_wiki',
    name: '团队知识库与规范 (Team Wiki)',
    description: '适用于团队研发 SOP、代码规范、新人入职指南与发布应急流程',
    iconName: 'BookOpen',
    defaultProjectName: '研发工程团队知识库',
    generateInitialData: (projectName: string) => {
      const docsMap: Record<string, string> = {};

      docsMap['index.md'] = `# ${projectName}

欢迎查阅团队工程与协同知识库。本知识库用于沉淀团队研发规范、最佳实践与工程资产。
`;

      docsMap['modules/onboarding.md'] = `# 新人入职与开发环境搭建

## 第一周检查清单
- [ ] 申请 Git 仓库权限与公共邮箱账号
- [ ] 本地开发环境初始化 (Node.js, Rust, Docker)
- [ ] 运行本地全链路测试通过
- [ ] 提交第一个体验优化 Pull Request
`;

      docsMap['modules/code_guidelines.md'] = `# 代码质量与 Git 协作规范

## Git 工作流规范
- **分支命名**：\`feature/xxx\`、\`fix/xxx\`、\`release/vX.Y.Z\`
- **Commit 规范**：遵循 Conventional Commits (如 \`feat:\`, \`fix:\`, \`refactor:\`)
- **Code Review**：核心模块必须由至少 1 位 Senior 同学 Review 后方可合并
`;

      docsMap['modules/release_sop.md'] = `# 发布上线与 Oncall 应急流程

## 生产发布 Checklist
1. 预发环境全量功能回归验收
2. 数据库 DDL/DML 脚本提前由 DBA 评审执行
3. 灰度放量 10% -> 50% -> 100%，观察错误日志与监控告警
`;

      const root: MindNode = {
        id: 'root-node',
        title: projectName,
        docPath: 'index.md',
        status: 'in_progress',
        priority: 'P0',
        tags: ['Wiki', '团队知识库'],
        children: [
          {
            id: 'node-onboarding',
            title: '新人指南与环境搭建',
            docPath: 'modules/onboarding.md',
            status: 'completed',
            priority: 'P1',
            tags: ['入职', '指南']
          },
          {
            id: 'node-code-guidelines',
            title: '代码规范与 Git 工作流',
            docPath: 'modules/code_guidelines.md',
            status: 'completed',
            priority: 'P1',
            tags: ['规范', 'CodeReview']
          },
          {
            id: 'node-release-sop',
            title: '发布上线与应急 SOP',
            docPath: 'modules/release_sop.md',
            status: 'todo',
            priority: 'P0',
            tags: ['发布', 'Oncall']
          }
        ]
      };

      return { root, docsMap };
    }
  },
  {
    id: 'blank',
    name: '空白自由项目',
    description: '最简单根节点结构，完全按需自由构建脑图与文档',
    iconName: 'FileText',
    defaultProjectName: '我的新项目',
    generateInitialData: (projectName: string) => {
      const docsMap: Record<string, string> = {
        'index.md': `# ${projectName}\n\n欢迎使用 DocMind 开启结构化文档创作。`
      };
      const root: MindNode = {
        id: 'root-node',
        title: projectName,
        docPath: 'index.md',
        status: 'in_progress',
        priority: 'P0',
        tags: ['根节点']
      };
      return { root, docsMap };
    }
  }
];
