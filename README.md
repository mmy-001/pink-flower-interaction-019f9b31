# 粉晶花手机交互

项目 ID：`019f9b31-feaa-7803-a3ae-8f1b741ad9e9`

点击、触摸或使用 Enter/空格，让粉色水晶花从初始状态旋转并盛开。页面使用透明 WebP 序列帧、梦境手机背景和 Canvas 2D，不调用摄像头，也没有鼠标跟随。

## 本地运行

需要 Node.js 18 或更高版本。

```bash
npm start
```

打开：

```text
http://127.0.0.1:4173/
```

如果端口被占用：

```bash
node serve.mjs --port 4180
```

## 验证

```bash
npm test
```

## 重新抽帧

仓库保留了原始视频 `source/pink-flower-source.mp4` 和抽帧脚本：

```bash
npm run extract
```

抽帧脚本使用 Codex 工作区内置的 Playwright 与 Sharp 运行时。网页运行本身不需要这些依赖。
