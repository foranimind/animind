# Frontend UI Redesign Design

**Date:** 2026-03-30

## Goal

在不改变 `apps/web` 当前功能、路由、任务状态流、本地存储行为和 API 调用语义的前提下，完成前端界面的全面视觉重设计，并建立一套可复用的设计 token、共享 UI primitives 和更清晰的页面样式边界，解决当前重复造轮子和样式膨胀问题。

## Context

当前前端已经具备完整的主要流程：

- `CreatePage` 负责创作输入和参数设置
- `JobRunPage` 负责运行过程展示
- `DeliveryPage` 负责成果预览与导出
- `LibraryPage` 负责作品浏览与筛选
- `AppSidebar` 负责全局导航和会话管理

当前视觉层存在几个核心问题：

- 页面间视觉语言不统一，但又没有形成清晰的“功能人格差异”
- [`pages.css`](E:/OneDrive%20-%20Coventry%20University/大创/代码/apps/web/src/pages/pages.css) 体量过大，承担了太多页面级和组件级职责
- 面板、按钮、状态块、菜单、抽屉、选择器等重复实现较多
- 主题变量在多个层级重复定义，维护成本高
- 不同页面虽然有自己的结构，但视觉表达没有充分围绕各自功能设计

## Constraints

本次重设计必须遵守以下边界：

- 不改变现有功能行为
- 不改变现有路由含义
- 不改变现有 hooks、API 调用、storage 和状态语义
- 不破坏现有测试所覆盖的交互边界
- 保留左侧栏，并保留其现有功能；如需重新设计，只重做表现层和布局表达，不删功能

## Approved Direction

### Visual Direction

整体视觉方向采用：

- **Primary direction:** `A1. Noir Editorial Atelier`
- **Color tuning:** `Smoked Indigo`

这意味着最终界面应满足以下气质：

- 沉稳、克制、偏高级创作工作室
- 保留科技感，但科技感来自材质、边界、秩序和反馈，而不是赛博化装饰
- 深色基底不使用纯黑和死灰，而使用更有层次的烟熏靛蓝、深靛紫、深石墨蓝体系

### What The UI Should Feel Like

- `Create` 像一张数字创作桌，而不是后台表单页
- `Run` 像执行过程舞台，而不是多个等权重卡片堆叠
- `Delivery` 像结果揭幕与交付台，而不是下载面板集合
- `Library` 像可检索的作品档案库，而不是普通后台列表

## Visual System

### Color System

主色系统采用带暖度的深色体系：

- Base background: 烟熏靛蓝与深墨蓝
- Elevated surfaces: 带少量紫调的深色面板
- Accent: 低饱和暖金/琥珀信号色
- Text: 柔和浅灰白，不使用过亮纯白作为默认正文色

颜色目标不是“冷科技蓝”，而是“温润的深色创作平台”。暖金强调色只出现在焦点、关键 CTA、当前态和少量高价值信息上，不做大面积铺色。

### Typography

采用三层字体体系：

- **Display / Heading:** 编辑感标题字体，用于页面主标题和重要展示文案
- **Body:** 高可读性现代 sans-serif，用于正文、字段、按钮、说明
- **Meta / Technical labels:** 稳定的 mono 字体，用于状态、标签、辅助元信息

目标是同时满足：

- 页面拥有编辑感和品牌气质
- 交互文本和表单仍然足够清晰
- 运行信息、状态与时间等技术元信息有稳定秩序

### Material Language

科技感主要通过材质层表达：

- 低透明度深色玻璃面板
- 细且克制的冷金属边界
- 轻微顶部反光和内层明暗变化
- 局部焦点高光，而非到处发光

不采用：

- 大面积霓虹边框
- 高频持续动画
- 过强的 gradient 炫光
- 装饰性强于功能性的视觉特效

### Motion Rules

动效规则如下：

- 常规反馈控制在 160-220ms
- 主要使用 `transform`、`opacity`、边界亮度变化
- hover 只做轻微浮起和层次增强
- 菜单、抽屉、选择器和状态切换强调连续性而非表演性
- 必须支持 `prefers-reduced-motion`

## Page Archetypes

页面层不共享同一个母版模板。共享的是设计语言、材质规则和 primitives，不是页面骨架。

### Sidebar: Persistent Studio Rail

左侧栏必须保留，并保留以下现有能力：

- 全局导航：`创作`、`我的作品`
- 新建项目
- 最近项目列表
- 会话状态表达
- 会话激活与跳转
- 会话重命名
- 置顶/取消置顶
- 删除
- 折叠/展开
- 已完成项目的详情打开入口

设计要求：

- 桌面端仍保持左侧固定 rail
- 保留当前“左侧导航 + 最近项目”信息结构
- 允许重做宽度、层级、视觉分区、头像区、底部折叠按钮的表现方式
- 会话列表的交互逻辑不变
- 折叠态必须仍可用，且图标、tooltip、焦点状态清晰

Sidebar 是整个产品的持续存在物，应该像“工作室轨道”而不是普通后台侧栏。

### Create Page: Composer Desk

`CreatePage` 是创作入口，不应再被视觉上拆成多个同级功能盒子。

设计要求：

- Prompt Composer 成为主视觉核心
- 设置、恢复信息、辅助操作位于次级区
- 页面应突出“开始创作”的专注感和启动仪式感
- 不引入运行页和交付页的视觉语义

布局目标：

- 主创作区明显更大
- 次级信息区更紧凑、秩序化
- Recovery 仍然显眼，但不抢主创作区

### Run Page: Execution Theater

`JobRunPage` 的核心是“任务正在发生什么”。

设计要求：

- 实时预览是主舞台
- Timeline、Logs、Cancel Action 是辅助叙事区
- 进度、阶段、日志不应与预览争夺同等视觉权重
- 页面应让用户顺着主次关系阅读，而不是在多个同级卡片之间来回切换注意力

布局目标：

- 一侧承载执行叙事链路
- 另一侧保留完整预览舞台
- 状态变化在视觉上清晰但不过度打扰

### Delivery Page: Showcase Stage

`DeliveryPage` 应强调“结果已经完成”。

设计要求：

- 预览区成为结果展示主舞台
- 资产与导出作为围绕结果展开的操作区
- 当 preview 缺失但 manifest 存在时，仍然要让资产区保持完整可见
- 页面气质应从“执行过程”切换为“成果交付”

布局目标：

- 预览优先级最高
- 资产与导出形成有秩序的次级集群
- 缺失 preview 的 fallback 状态依然要高级、稳定，不像报错面板

### Library Page: Archive Gallery

`LibraryPage` 既要支持检索，又要保留作品陈列感。

设计要求：

- 搜索与筛选形成统一命令条
- 作品卡片保留浏览节奏与作品感
- 不做成纯后台列表页
- 空状态、筛选状态、卡片菜单状态要统一但不呆板

布局目标：

- 顶部为命令条与筛选反馈
- 下方为作品阵列
- 卡片保持浏览感，同时让状态和元信息足够清楚

## Shared Primitives

虽然页面骨架不统一，但以下内容必须收敛为共享层：

### Shared Surface Components

- `surface-panel`
- `panel-header`
- `page-header`
- `section-block`

### Shared Interaction Components

- 主按钮 / 次按钮 / 危险按钮
- 字段外壳
- 状态 pill
- meta chip
- menu
- drawer
- select trigger / select panel

### Shared Interaction Rules

- hover 强度一致
- focus visible 风格一致
- active / disabled / error / loading 的边界一致
- 菜单和抽屉的出现/消失节奏一致

目标是减少重复造轮子，而不是把页面专属结构强行抽象成不自然的通用组件。

## Style Architecture

### Target Structure

建议新增一层共享样式目录，例如：

- `src/styles/tokens.css`
- `src/styles/base.css`
- `src/styles/motion.css`
- `src/styles/primitives.css`

页面专属样式按职责分开，例如：

- `src/pages/create.css`
- `src/pages/run.css`
- `src/pages/delivery.css`
- `src/pages/library.css`

或按组件就近拆分，但必须满足以下规则：

- 共享规则不继续堆进 [`pages.css`](E:/OneDrive%20-%20Coventry%20University/大创/代码/apps/web/src/pages/pages.css)
- 页面人格相关样式回到页面或页面组件自身
- Sidebar 维持单独样式边界
- Preview 相关视觉只在 preview 层维护

### File Ownership Rule

这次重构中：

- 共享视觉语言进入 shared styles / `components/ui`
- 页面人格结构留在 `components/create`、`components/run`、`components/delivery`、`components/library`
- 如单个组件文件过大，可按职责拆分，但只拆与本次 UI 重构直接相关的内容

## Accessibility and Interaction Guarantees

本次重构必须保留并强化以下交互保证：

- 键盘可达
- 焦点可见
- icon-only 操作具备可访问名称
- `ESC` 和点击外部关闭逻辑保持
- collapsed sidebar 仍可用
- reduced motion 可用
- 空状态、错误状态、恢复状态、loading 状态语义不变

## Testing and Verification

### Logic That Must Not Change

- 路由恢复逻辑
- active session 恢复逻辑
- Create 页恢复 banner 和 draft 恢复逻辑
- Delivery 页 preview 缺失时资产仍可见
- Sidebar 导航高亮与会话跳转逻辑
- SelectMenu、drawer、menu 的 dismiss 行为

### Verification Plan

完成实现后至少执行：

- `npm test`
- `npm run typecheck`
- `npm run build`

如 lint 在当前工程中稳定可运行，也执行：

- `npm run lint`

同时执行手动验证：

- 小屏宽度与桌面宽度
- Sidebar 展开/折叠
- Create / Run / Delivery / Library 各页核心操作
- Hover / focus / disabled / error / loading / empty states
- `prefers-reduced-motion`

## Success Criteria

本次设计在实现完成后应满足：

- 界面气质显著优于当前版本
- 页面间共享同一品牌语言，但不会像同一个模板复制四次
- 左侧栏继续保留并完整保留现有能力
- 共享 primitives 明显减少重复样式和重复结构
- 页面样式边界比当前更清晰
- 不引入功能回归

## Non-Goals

以下内容不属于本次设计范围：

- 修改业务流程
- 修改 API 协议
- 修改 storage 数据结构
- 新增复杂业务能力
- 为了“通用化”而重写本来就只属于单页的人格结构
