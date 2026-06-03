# yuchaolove

> 让心动被看见，让回复有温度

一个 AI 驱动的追求回复助手。上传聊天截图，分析对方态度，生成自然不油腻的回复。

## 文件结构

```
yuchaolove/
├── index.html    # 主页面
├── style.css     # 样式
├── app.js        # 前端逻辑
├── api/analyze.js # Vercel API，调用 OpenAI 并记录使用日志
├── supabase/schema.sql # Supabase 表和 Storage bucket 初始化脚本
├── vercel.json   # Vercel 部署配置
└── README.md
```

## Supabase 使用记录

项目会在每次分析完成后，把以下信息写入 Supabase：

- 使用时间：`usage_logs.created_at`
- 访客标识：浏览器本地生成的 `visitor_id`
- 地址信息：IP、国家、地区、城市、时区、经纬度（由 Vercel 请求头提供，通常是大概位置）
- 浏览器信息：user agent、语言、页面路径
- 使用结果：完整 `analysis_result`、推荐回复、聊天阶段、好感判断等字段
- 上传照片：保存到私有 Storage bucket `screenshots`，路径记录在 `storage_paths`

在 Supabase SQL Editor 里运行 [supabase/schema.sql](supabase/schema.sql)，然后在 Vercel 环境变量里配置：

```text
OPENAI_API_KEY=你的 OpenAI API key
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
```

`SUPABASE_SERVICE_ROLE_KEY` 只能放在 Vercel 后端环境变量里，不要写进前端代码或 GitHub。页面上保留了保存截图和分析结果的提示，因为聊天截图属于敏感内容。

## 部署到 Vercel（免费）

1. 把这个文件夹上传到 GitHub（新建一个仓库）
2. 去 [vercel.com](https://vercel.com) 登录，点击 **New Project**
3. 导入你的 GitHub 仓库
4. Framework Preset 选 **Other**，其他默认
5. 点击 **Deploy**，等待 1 分钟即可上线

部署后访问 `your-project.vercel.app` 即可使用。

## 本地运行

直接用浏览器打开 `index.html` 即可，无需任何构建步骤。

---

Made with ♥ by yuchaolove
