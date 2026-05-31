# 标准化业务报关单数据分析看板

## 项目概述
React + TypeScript + Vite + Ant Design + ECharts 构建的业务数据看板。
分析维度：标准化业务报关单的下单时间分布、接单耗时、制单时长、高并发检测、进出口拆分。

## 技术栈
- React 19 / TypeScript / Vite
- Ant Design 6.x (UI)
- ECharts 5.x (图表)
- Zustand (状态管理)
- ali-oss (阿里云 OSS SDK)

## 数据来源
五个月的标准化业务报关单数据（1-5月），从桌面 `关务分析数据` 文件夹的 XLS 转换而来。
格式：`数据2026-0X.csv`，存放在 `public/` 目录。

## 关键文件
- `src/pages/DashboardPage.tsx` - 当月看板（四个维度 + 排行榜 + 饼图）
- `src/pages/OverviewPage.tsx` - 总分析（1-12月横向对比）
- `src/utils/orderAnalyzer.ts` - 数据分析引擎（预处理、进出口拆分）
- `src/store/preprocessStore.ts` - 预处理数据共享 Store
- `deploy-oss.cjs` - OSS 部署脚本（含 AccessKey，已 gitignore）

## 部署
- **GitHub Pages**: `https://cleverguo1979.github.io/business-dashboard/`（仓库公开）
- **局域网**: `http://192.168.0.9:8080/`
- **OSS**: `https://business-dashboard-site.oss-cn-hangzhou.aliyuncs.com/`（有强制下载问题）

## 常见问题
1. **数据切换不响应**：DashboardPage 的 useEffect 需 reset preprocessStore
2. **白屏**：所有 hooks 必须在 return 之前，否则 hooks 数量变化导致崩溃
3. **OSS 强制下载**：bucket 级别 Content-Disposition: attachment，需在控制台关闭
4. **GitHub Pages 子路径**：BrowserRouter basename="/business-dashboard"，Vite base 相同

## 阿里云
- 账号: cleverguo1979 (RAM用户: dashboard)
- OSS bucket: business-dashboard-site (杭州节点)
- 域名: cleverguo.cn (注册中，待ICP备案)
- 文件: deploy-oss.cjs (含AK/SK，勿提交Git)
