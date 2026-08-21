import { ProjectData } from './types';

export const INITIAL_PROJECT_DATA: ProjectData = {
  version: '1.0.0',
  projectName: '新需求文档项目',
  root: {
    id: 'root-node',
    title: '电商系统总体架构',
    docPath: 'index.md',
    status: 'in_progress',
    priority: 'P0',
    tags: ['核心', '架构'],
    children: [
      {
        id: 'node-auth',
        title: '用户认证模块',
        docPath: 'modules/auth/index.md',
        status: 'completed',
        priority: 'P0',
        tags: ['安全', '用户'],
        children: [
          {
            id: 'node-auth-sso',
            title: 'SSO 单点登录',
            docPath: 'modules/auth/sso.md',
            status: 'todo',
            priority: 'P1',
            tags: ['OAuth2', 'SSO']
          },
          {
            id: 'node-auth-mfa',
            title: 'MFA 双因子认证',
            docPath: 'modules/auth/mfa.md',
            status: 'draft',
            priority: 'P2',
            tags: ['安全']
          }
        ]
      },
      {
        id: 'node-order',
        title: '订单管理模块',
        docPath: 'modules/order/index.md',
        status: 'in_progress',
        priority: 'P0',
        tags: ['交易'],
        children: [
          {
            id: 'node-order-pay',
            title: '微信/支付宝聚合支付',
            docPath: 'modules/order/payment.md',
            status: 'in_progress',
            priority: 'P0',
            tags: ['支付']
          },
          {
            id: 'node-order-refund',
            title: '退款逻辑与流水明细',
            docPath: 'modules/order/refund.md',
            status: 'todo',
            priority: 'P1',
            tags: ['退款']
          }
        ]
      }
    ]
  }
};

export const INITIAL_DOC_CONTENTS: Record<string, string> = {
  'index.md': `---
id: root-node
title: 电商系统总体架构
status: in_progress
priority: P0
tags: [核心, 架构]
---

# 电商系统总体架构 PRD

## 1. 项目概述
本项目旨在构建一套高扩展、高性能的微服务架构电商平台。

## 2. 核心目标
- 支持十万级 QPS 并发
- 模块化解耦，需求可独立拆分与部署
`,
  'modules/auth/index.md': `---
id: node-auth
title: 用户认证模块
status: completed
priority: P0
tags: [安全, 用户]
---

# 用户认证模块

提供统一的基础认证服务，包含账号密码登录、社交账号绑定及权限控制。
`,
  'modules/auth/sso.md': `---
id: node-auth-sso
title: SSO 单点登录
status: todo
priority: P1
tags: [OAuth2, SSO]
---

# SSO 单点登录需求细节

## 1. 业务流程
- 用户访问子系统
- 重定向至认证中心
- 检查 Session 并发放 Token
`,
  'modules/order/payment.md': `---
id: node-order-pay
title: 微信/支付宝聚合支付
status: in_progress
priority: P0
tags: [支付]
---

# 聚合支付需求规格

## 1. 接入渠道
- 微信 JSAPI / APP 支付
- 支付宝 ReadyPay
- 统一回调与验签接口
`
};
