# @orca/docs

此包包含产品文档和打算随 Orca 源代码一起发布的公共媒体。

为 [Orca](https://orca.dev) 开源的产品文档，在 `/docs` 提供（与 `https://orca.dev/docs` 相同的 URL 形式）。

此包是一个 **自包含的 Next.js 应用**。它有意 **不是** 根 monorepo 工作空间成员，因此安装 Electron 应用依赖不会拉取 Next/fumadocs。

## 本地开发

使用 Node.js 24 和 `package.json` 中锁定的 pnpm 版本。CI 从此包的 `engines.node` 字段读取 Node.js 版本。

```bash
cd docs/site
pnpm install
pnpm dev
```

打开 [http://localhost:3004/docs](http://localhost:3004/docs)。

## Linting

在此目录内运行 `pnpm lint`。隔离的 Oxlint 配置保持之前 Next.js、React、React hooks 和可访问性检查的原生等效项在其现有严重级别，包括 Next.js `Image` 组件上的 alt 文本。生成的 Next.js 和 MDX 输出被排除。Oxlint 还报告其默认的正确性警告。

迁移没有为 React 的 deprecated-API 检查、React 编译器配置/门控诊断或 Next.js 的相对 `location.assign` 建议提供等效项。JSX 变量使用簿记由 Oxlint 的解析器处理。在验证工作流中保持 TypeScript 和生产 Next.js 构建；这不是完整 ESLint 规则对等的声明。

## 生产构建

```bash
cd docs/site
pnpm install
pnpm build
pnpm start
```

`pnpm start` 在端口 3004 上提供生产构建。路径：

| 路径               | 用途                              |
| ------------------ | ------------------------------------ |
| `/`                | 重定向到 `/docs`                 |
| `/docs`            | 文档索引                           |
| `/docs/...`        | `content/docs` 中的嵌套文档页面 |
| `/docs/api/search` | Fumadocs 搜索索引                |
| `/docs/og/...`     | 每个页面的 Open Graph 图像路由      |

## 布局

- `content/docs/` —— MDX 页面 + `meta.json` 导航
- `public/docs/` —— 仅文档媒体、logo 和 favicon（GIF、海报、截图）
- `src/app/docs/` —— fumadocs 路由、OG 图像
- `src/components/` —— 文档范围的 chrome（头部/底部/搜索），不是营销网站

## 更新内容

将文档树视为有意的发布边界。在导入源材料之前，审查内部引用、凭据、第三方媒体权利和功能/版本声明，然后仅复制批准的页面和资产。在仓库中保持应用外壳和部署配置，以便仅文档的 pull request 可以独立评审和构建。

## 同域路由

文档应用是单独的 Vercel 项目（**docs 区域**）并保持公共 `/docs` URL 命名空间。营销站点仍然是 `orca.dev` 的默认区域；用这些 `beforeFiles` 重写配置其 Next/Vercel 代理，将 `DOCS_ORIGIN` 替换为文档项目的生产 URL：

```js
return {
  beforeFiles: [
    {
      source: '/docs',
      destination: `${DOCS_ORIGIN}/docs`
    },
    {
      source: '/docs/:path*',
      destination: `${DOCS_ORIGIN}/docs/:path*`
    },
    {
      source: '/docs-static/:path*',
      destination: `${DOCS_ORIGIN}/docs-static/:path*`
    }
  ]
}
```

`/docs-static` 是 docs 区域的 `assetPrefix`；它防止 `_next` 资产与营销区域冲突。在默认区域保持重写，在区域之间导航时使用普通 `<a>` 链接。不要将 `basePath: '/docs'` 添加到此应用：其路由树和 Fumadocs `baseUrl` 已经包含 `/docs`，这样做会发布 `/docs/docs/...` URL。如果未来部署需要 `basePath`，先将路由树移动到无前缀的 `src/app/[[...slug]]` 形状，并一起更新每个生成/链接 URL。

## 部署 (Vercel)

1. 创建 Vercel 项目，**根目录** 不设置（`.`）。工作流从 `docs/site` 调用 Vercel，因此该目录已是部署根；再次设置会解析为 `docs/site/docs/site`。禁用自动 Git 部署，使此工作流保持为唯一部署路径。
2. Framework preset: Next.js。此包的 `engines.node` 为 Vercel 构建和函数选择 Node.js 24。`vercel.json` 固定安装（`pnpm install --frozen-lockfile`）和构建（`pnpm build`），覆盖仪表板设置；此包在根工作空间旁边有自己的锁文件。
3. 设置 GitHub Actions 密钥（生产部署作业必需）：
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`（文档项目，不是营销站点）
4. 用必需的评审者和 `main` 及 `v*` 标签的自定义部署分支策略保护 `docs-production` GitHub 环境。发布裁剪分发从 `main` 运行；直接发布的发布回退从稳定标签运行，而工作流仍仅授权确切稳定标签。
5. 在 `orca.dev` 营销项目中准备上述三个重写，但在文档部署验证完成前保持禁用。Vercel 自定义域名不能单独代理 `/docs`；默认区域必须代理页面/API/媒体请求和 `/docs-static` 资产。在过渡期间保持营销项目的旧文档路由可用于回滚；将代理规则放在 `beforeFiles` 中确保它们启用后生效。
6. 部署包含 `docs/site` 的稳定桌面标签，验证文档来源，然后启用营销重写。在此包添加之前裁剪的标签无法引导文档项目，因为生产有意检出标签的确切提交。代理稳定后，在后续步骤中删除旧的营销文档路由。

`.github/workflows/docs.yml` 为每个 pull request 运行无需凭据的检查。它有意不部署 PR 预览：PR 控制的构建不得接收 Vercel 凭据。维护者稍后可以添加单独的可信预览工作流。生产仅从授权的稳定桌面发布部署：确切的 `vX.Y.Z` 标签、发布的非预发布发布，以及 `github-actions[bot]` 发布作者。手动分发必须从默认分支运行并指定满足相同检查的现有发布。跳过移动、预发布、草稿和人工发布。fork pull request 保持仅构建，因为 GitHub 不向 fork 作业暴露部署密钥。

## 版本控制

`versioning.config.ts` 保持当前未版本化的 `/docs` URL 稳定，同时为未来快照预留 `content/versions/<id>`。版本化路由尚未上线；需要时，添加相应的加载器/路由和版本条目。发布工作流随后可以部署它们而无需触发器更改。

## 与桌面应用隔离

- `docs/site/` 下有自己的 `package.json` + `pnpm-lock.yaml`
- 未在根 `pnpm-workspace.yaml` 中列出；自己的 `pnpm-workspace.yaml` 使其成为单独的工作空间根并持有其 pnpm 设置，pnpm 12 在 `--ignore-workspace` 下忽略

工程笔记仍在仓库根的 `docs/` 中 —— 不要与此包混淆
