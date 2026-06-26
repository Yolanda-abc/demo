# 金币商城 Demo

纯前端版本的金币商城演示，所有商品、订单、余额、背包、流水数据都存放在浏览器 `localStorage`，无需自建后端。

可直接通过 GitHub Pages 托管访问。

## 在线预览

启用 GitHub Pages 后，访问：

```
https://<你的用户名>.github.io/<仓库名>/
```

## 本地预览

任意静态服务器都可以：

```bash
# 方式一：python
python3 -m http.server 8000

# 方式二：npx
npx serve .
```

打开 `http://localhost:8000/`。

## 主要特性

- 商品浏览、购买、库存扣减
- 金币 / 星星双币种，余额变动写入流水
- 背包系统（保存、装备、过期管理）
- 角色试装预览（Spine 资源走腾讯云 COS 公开桶）

## 数据存储

| 用途       | localStorage key            |
| ---------- | --------------------------- |
| 余额       | `demo_user_balance`         |
| 商品       | `demo_shop_products`        |
| 订单       | `demo_shop_orders`          |
| 背包       | `demo_user_bag`             |
| 余额流水   | `demo_user_transactions`    |

首次进入时，商品数据会从 `data/products.example.json` 初始化。如需重置，在浏览器控制台执行：

```js
localStorage.clear(); location.reload();
```

## 目录结构

```
.
├── index.html                  入口页面
├── data/
│   └── products.example.json   示例商品数据
└── src/
    ├── demo-api-shim.js        fetch 拦截器，将 /api/* 调用接到 localStorage
    └── *.svg                   分类图标
```

## 与原项目的差异

原项目 [shop_v3_preview.html](https://github.com/) 依赖：

- Node/Express 后端 `shop-api`（端口 3002）
- 服务器本地 JSON 数据文件
- 自建服务器域名 

本 demo 版本：

- 移除后端依赖，`fetch('/api/*')` 由 `src/demo-api-shim.js` 拦截
- `API_BASE = ''`，资源域仍走 COS 公开读，未持有任何凭据
- 业务数据快照已替换为示例数据，未包含真实订单/余额

## License

MIT
