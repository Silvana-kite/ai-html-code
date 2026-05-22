# 水中倒影代码动画

这是一个原生 `HTML + CSS + JavaScript` 实现的“代码视频”项目。当前版本把 `assets/1.png` 到 `assets/5.png` 当作连续循环图片队列：图片横向首尾相接滚动，水线固定，不做上下漂浮。

## 动画分析

- 视觉风格：暗场电影感、动漫图像长廊、水面反射、轻微弧面空间感。
- 动画组成：图片按横向顺序稳定绘制，尺寸保持一致，间距等于单张图片宽度；中间只是自然经过，不做放大、提亮、倾斜或选中态；两侧仅保留极轻微位置和透明度变化，倒影与对应图片同步。
- 时间轴：0-2 秒进入水面空间；2-8 秒图片长廊从右向左掠过；8-10.5 秒继续无缝接回开头。
- 缓动方式：水平滚动匀速，水波使用多组正弦波叠加。

## 技术方案

- `Canvas`：绘制弧面图片长廊、逐张同步倒影、水面波纹、光粒和暗角。
- `requestAnimationFrame`：驱动 10.5 秒循环时间轴。
- `CSS`：负责舞台布局、文字层、按钮和响应式适配。
- 未引入第三方库：该效果用原生 Canvas 足够完成，避免额外依赖。

## 运行方式

直接打开：

```bash
water-reflection-effect/index.html
```

或在项目目录启动静态服务器：

```bash
python -m http.server 5173
```

然后访问：

```text
http://localhost:5173/water-reflection-effect/
```

## 可调参数

- `script.js` 中的 `duration` 控制循环时长。
- `getStageMetrics()` 控制固定水线、图片尺寸和横向间距。
- `getPanelTransform()` 控制轻微弧面感：不改变图片尺寸和宽度投影，只处理少量垂直位置与透明度变化。
- `drawPanelReflection()` 中的 `wave` 控制倒影撕裂幅度。
- `drawWaterSurface()` 中的波纹数量控制水面细节。
