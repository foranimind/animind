# Welcome Landing Page Design

**Date:** 2026-03-30

## Goal

为 `apps/web` 新增一个真正独立的欢迎/介绍页，作为网站默认入口，并通过明确的 CTA 跳转到现有工作台。该页面需要参考 `https://antigravity.google/?app=antigravity` 的首屏体验，尤其是项目名称逐字出现和带有局部显隐、拖尾感、静止微漂移的粒子场交互，但整体视觉语气必须回到当前项目既有的深色创作工作室风格，而不是直接复制 Google Antigravity 的白底品牌语言。

## Context

当前前端路由结构中，根路径 `/` 实际承担了工作台入口职责：

- [`apps/web/src/App.tsx`](E:/OneDrive%20-%20Coventry%20University/大创/代码/apps/web/src/App.tsx) 将 `/` 指向 `HomeRoute`
- [`apps/web/src/pages/HomeRoute.tsx`](E:/OneDrive%20-%20Coventry%20University/大创/代码/apps/web/src/pages/HomeRoute.tsx) 会在有运行中的 session 时跳转到 `/jobs/:id`，否则直接渲染 `CreatePage`
- [`apps/web/src/lib/sessionRouting.ts`](E:/OneDrive%20-%20Coventry%20University/大创/代码/apps/web/src/lib/sessionRouting.ts) 也把 `/` 视为 draft workspace 的默认入口

与此同时，当前视觉系统已经建立了明确基线：

- 深色背景与径向渐变空间层次
- 冷蓝与暖金作为主要强调色
- `IBM Plex Sans` / `IBM Plex Mono` / `Newsreader` 的组合
- 相对克制、非炫技化的交互动效

欢迎页必须建立在这套视觉基线之上，并与现有工作台布局彻底解耦，以便未来独立扩展成展示站。

## Constraints

- 欢迎页必须是独立页面和独立文件，不得将 landing 逻辑塞进 `CreatePage`、`HomeRoute` 或 `AppLayout`
- 默认入口改为欢迎页，但不能破坏现有工作台、运行页、交付页和作品库的数据流
- 首屏粒子场只服务于 Hero 区域，不延续到后续滚动介绍章节
- 标题、副标题和简短介绍需要逐字 reveal，但不应变成高频闪烁式打字机特效
- 动效必须支持 `prefers-reduced-motion`
- 粒子效果要尽量贴近参考页“局部激活的粒子场”观感，而不是简单地让一团粒子整体跟随鼠标移动
- 后续实现优先采用可维护的 `Canvas 2D` 方案，不引入 `three.js` 作为欢迎页的基础依赖

## Reference Analysis

对参考站和用户本地复现进行分析后，核心结论如下：

### Official Reference

`https://antigravity.google/?app=antigravity` 的首屏体验可以拆成两部分：

- 文本层：项目名与说明文字做逐字 reveal，运行时代码中可见 `SplitText` 等逐字拆分能力
- 图形层：页面内存在多个 `canvas`，并且 bundle 中包含图形运行时代码，因此首屏粒子不是单纯 CSS 背景

从视觉表现看，官方页的首屏粒子不是“整团跟着鼠标移动”，而是：

- 整屏先铺一层极稀疏、低对比度的底层粒子
- 鼠标经过时，在鼠标附近出现一个局部活跃区
- 活跃区里粒子更密、更亮，并带有方向性短线段，因此呈现“拖尾”错觉
- 鼠标中心本身存在一定空洞感，最亮区域围绕中心分布
- 鼠标静止后，活跃区不会僵住，而会继续做缓慢漂移和重排

### Local Recreation

用户本地复现位于：

- [`E:\OneDrive - Coventry University\个人工作\Antigravitywebsite\index.html`](E:/OneDrive%20-%20Coventry%20University/个人工作/Antigravitywebsite/index.html)
- [`E:\OneDrive - Coventry University\个人工作\Antigravitywebsite\script.js`](E:/OneDrive%20-%20Coventry%20University/个人工作/Antigravitywebsite/script.js)
- [`E:\OneDrive - Coventry University\个人工作\Antigravitywebsite\style.css`](E:/OneDrive%20-%20Coventry%20University/个人工作/Antigravitywebsite/style.css)

该版本核心实现是 `paintWorklet` + `ringparticles`，用 `--ring-x` / `--ring-y` 让一个粒子环跟随鼠标中心变化。这种方案天然更像“移动一个环”，而不是“激活一片场”，因此不适合作为本项目最终欢迎页的实现路径。

## Approved Direction

### Route Model

路由职责重新拆分如下：

- `/`：独立欢迎页入口
- `/studio`：创作台入口，承担当前 `HomeRoute` 的 workspace 恢复职责
- `/jobs/:id`：运行页
- `/works`：作品库
- `/works/:id`：作品详情 / 交付页

根路径不再自动把用户从欢迎页劫持到运行中 session。欢迎页本身只负责展示、引导和跳转。

如果存在运行中或可恢复的任务，欢迎页上的 CTA 文案和辅助入口应体现这种状态，例如：

- 无活跃任务：`进入创作台`
- 有活跃任务：`继续创作`
- 可选次级入口：`查看进行中的任务`

### Information Architecture

欢迎页采用“1 个首屏 Hero + 3 个滚动章节”的结构：

1. Hero：项目名、副标题、简短介绍、主 CTA、粒子场
2. Chapter 1：从想法到任务
3. Chapter 2：从任务到生成过程
4. Chapter 3：从结果到交付
5. End Cap：收束型 CTA，不做冗长 footer 宣传

这 3 个章节直接映射现有产品能力：

- `CreatePage`
- `JobRunPage`
- `DeliveryPage` / `LibraryPage`

因此欢迎页叙事与实际产品结构一致，不需要为了 landing page 强行编造额外故事。

## Hero Design

### Content Hierarchy

Hero 只保留最核心的四层信息：

1. 项目名称
2. 一句副标题
3. 两到三行以内的简短介绍
4. 主 CTA

信息密度要低，避免在首屏堆积太多解释性文本。

### Typographic Behavior

逐字动画适用于：

- 项目名
- 副标题
- 简短介绍

Reveal 节奏应呈现层级差异：

- 项目名最快，但仍有明确启动感
- 副标题略慢于项目名
- 简短介绍最克制，避免喧宾夺主

文本 reveal 不采用夸张光标闪烁，而是使用逐字淡入、上移和透明度变化的组合，保留参考页那种“文本被一点点点亮”的感觉，同时兼容当前项目更沉稳的视觉气质。

### Visual Styling

Hero 仍保持当前项目深色创作工作室语气：

- 深色底画布
- 局部径向渐变塑造空间
- 暖金与冷蓝作为粒子和 CTA 的强调色
- 展示性标题可借用现有 `Newsreader` 体系承担仪式感
- 正文、按钮和说明文字继续落在现有 sans-serif 体系中

## Hero Particle Field

### Why Canvas 2D

首屏粒子场采用 `Canvas 2D`，原因如下：

- 足够实现“整片粒子场 + 局部激活窗口 + 拖尾短线 + idle 漂移”
- 维护复杂度显著低于 `three.js`
- 不需要把整个欢迎页拖入更重的图形栈
- 更容易控制降级和 `prefers-reduced-motion`

### Behavioral Model

粒子系统拆成四层逻辑：

1. **Base Field**
   - 在 Hero 内预生成整片稀疏粒子
   - 默认状态低密度、低亮度、低对比

2. **Interactive Activation**
   - 维护一个随鼠标位置更新的局部激活区
   - 激活区不是硬边圆形，而是柔和衰减窗口
   - 鼠标中心附近额外叠加一个更小的反向衰减区，形成空洞感

3. **Velocity Stretch**
   - 根据最近一段鼠标速度，让部分粒子从圆点过渡为短线段
   - 线段方向由局部速度方向决定
   - 停止移动后线段长度逐步收敛回点状

4. **Idle Drift**
   - 鼠标不移动时，粒子仍继续做低频漂移与微扰动
   - 漂移不是大范围乱动，而是围绕原位置轻微游移

### Color Logic

粒子颜色不应像一团统一色块，而应基于局部位置和状态微调：

- 默认层：低对比蓝灰 / 冷灰粒子
- 激活层：冷蓝为主，局部混入暖金与少量偏紫蓝
- 颜色变化由粒子相对激活区的位置决定，而不是整层统一换色

### Performance Rules

- 粒子数量应与 Hero 尺寸和设备能力挂钩，不固定写死
- `requestAnimationFrame` 驱动，避免布局抖动
- `devicePixelRatio` 需控制上限，避免高分屏成本过高
- 离开首屏可暂停或降频重绘

## CTA Behavior

### Initial State

主 CTA 从首屏开始就存在，不等待滚动后出现。

默认职责：

- 进入 `/studio`

文案可根据会话状态调整，但行为边界保持明确。

### Sticky Transition

当用户开始向下滚动时：

- CTA 从 Hero 内部位置逐步上移
- 到 Hero 临界点后收拢为顶部固定胶囊按钮
- 固定状态的视觉权重低于首屏状态

固定态不应像普通悬浮按钮那样生硬。推荐样式：

- 半透明深色背景
- 轻微模糊或磨砂感
- 保持圆角胶囊形态
- 适度缩小尺寸

回滚到顶部时，CTA 重新展开为首屏版本。

## Scroll Story

### Chapter 1: 从想法到任务

这部分介绍创作入口本身：

- 如何把想法组织为任务
- 提示词、风格、时长和参数如何协同
- 工作台为何更接近“创作起点”，而不是普通表单页

视觉上更偏“创作台预览 + 解释性标题”。

### Chapter 2: 从任务到生成过程

这部分介绍系统如何承载运行态：

- 任务排队
- 运行中状态
- 可恢复与可追踪的过程
- 用户如何理解当前任务发生了什么

视觉上更适合状态流 / 时间线 / 过程段落，而不是单纯大图。

### Chapter 3: 从结果到交付

这部分介绍闭环：

- 查看结果
- 浏览作品
- 导出与交付
- 为什么这个系统不仅是生成入口，也是结果沉淀空间

视觉上要比前两章更收束、更稳定，形成“结果已经落地”的结束感。

## Motion Rules

- Hero 文本 reveal：逐字淡入 + 轻微上移
- 粒子层：连续低频动效，不做夸张爆发式转场
- 章节进入：以淡入、上移、遮罩展开为主
- CTA 收拢：强调连续性，不做剧烈弹跳
- 所有常规过渡保持在当前项目可接受范围内，避免整体 landing page 比工作台夸张过多

## Accessibility and Reduced Motion

当 `prefers-reduced-motion: reduce` 时：

- Hero 粒子场停止高频扰动，只保留静态或极低频背景
- 文本 reveal 由逐字符切换为整段或整词分组淡入
- CTA 从普通态切换为固定态时，弱化位移动画
- 滚动章节只保留最基本的显隐，不依赖强时间轴

如果 `canvas` 初始化失败：

- Hero 退化为静态渐变背景
- 文案、CTA 和滚动章节仍可完整使用

## File Architecture

建议新增以下独立结构：

- `apps/web/src/pages/WelcomePage.tsx`
- `apps/web/src/pages/welcome.css`
- `apps/web/src/components/welcome/HeroParticleField.tsx`
- `apps/web/src/components/welcome/HeroIntro.tsx`
- `apps/web/src/components/welcome/WelcomeStickyCta.tsx`
- `apps/web/src/components/welcome/WelcomeStorySection.tsx`

职责边界如下：

- `WelcomePage.tsx`
  - 仅负责页面装配、章节排序、路由跳转和状态拼装
- `HeroParticleField.tsx`
  - 独立维护首屏粒子 canvas，不泄漏到其他页面
- `HeroIntro.tsx`
  - 负责标题、副标题、说明和 CTA 的 Hero 信息结构
- `WelcomeStickyCta.tsx`
  - 负责首屏 CTA 与固定 CTA 的切换
- `WelcomeStorySection.tsx`
  - 负责三个滚动章节的通用结构

路由层改造建议：

- `App.tsx`
  - `/` -> `WelcomePage`
  - `/studio` -> 原 `HomeRoute` 逻辑或其重命名版本
- `HomeRoute` 或其替代模块
  - 改为只服务 studio 入口，不再承载 public landing

## Session and Recovery Behavior

欢迎页不负责自动恢复到运行页，但可以读当前 session 状态以优化 CTA 文案与辅助入口。

建议规则：

- 运行中 / 排队中：
  - 主 CTA：`继续创作`
  - 可选次级入口：`查看进行中的任务`
- 已完成 / draft / error / canceled：
  - 主 CTA：`进入创作台`

恢复逻辑本身仍放在 `/studio` 体系中，保持现有 session store 与 route restore 语义不变。

## Testing Strategy

### Route Tests

需要调整和新增测试，确保：

- `/` 渲染欢迎页而不是创作台
- `/studio` 承担原根路径的工作台恢复职责
- 运行中的 session 在访问 `/studio` 时仍能恢复到 `/jobs/:id`

### Welcome Page Tests

欢迎页测试关注结构与行为，不做像素级动画测试：

- 首屏项目名和 CTA 是否渲染
- CTA 是否跳转到 `/studio`
- 章节标题是否存在
- 根据 session 状态是否显示不同 CTA 文案
- `prefers-reduced-motion` 分支是否走降级行为

### Particle Field Tests

粒子组件只测试：

- canvas 是否挂载
- 组件卸载时动画帧是否清理
- reduced-motion 下是否走降级配置
- 初始化失败时是否不阻塞页面内容

不做粒子视觉细节的单元测试。

## Implementation Notes

本设计只定义边界，不要求欢迎页在视觉上 1:1 复制 Google Antigravity。真正需要保留的是以下体验原则：

- 标题逐字被点亮
- 首屏粒子是一片场，而不是一团物体
- 鼠标激活的是局部可见性和局部形变
- 鼠标停止后仍保有生命感
- 滚动后信息结构清晰展开
- 整体气质回到当前项目自己的深色创作工作室风格

## Non-Goals

本次欢迎页设计不包括：

- 重构已有 `CreatePage` / `JobRunPage` / `DeliveryPage` 的功能逻辑
- 引入新的后端接口
- 把欢迎页直接扩成完整营销站
- 在欢迎页中复制作品库、任务页的全部复杂交互
