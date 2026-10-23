# 背背

**背书 = 理解 + 重复。** 用彩色划线拆出意群，把概念搭成积木关系图，再通过翻卡与间隔复习主动回忆。

- [在线使用](https://chouzing77.github.io/beibei/)
- [Android 试用包与发布记录](https://github.com/chouzing77/beibei/releases)

## 功能

- 文件夹管理：新建、重命名、颜色、备注与删除确认。
- 卡片：问题与答案，支持图片答案、原文修改、删除确认；可跳过理解直接复习。
- 导入：XLSX / XLS、TXT、CSV、TSV、JSON；提供模板、预览和字段映射。
- 理解：15 色划线生成同色积木，支持命名；画布可移动、缩放积木，改变形状，绘制带文字的连线。
- 一阶、二阶：按画布布局翻开或遮盖内容；复习使用问题/答案正反卡和三档自评。
- 统计与专注：学习热力图、每日活跃与专注时长图表；默认 25 分钟的自定义番茄钟。
- 完整备份：JSON 包含图片、积木、复习进度与统计，支持合并、冲突副本、重复导入去重、整库恢复和导入前回退副本。

网页、Windows 和 Android 使用同一套前端。数据在当前浏览器或设备本机保存，无需 AI API。通过 JSON 手动迁移设备；当前没有账号云同步。普通题库导入和完整备份导入是两个入口。

## 快速运行网页

```sh
cd sites/beishu-lab
python -m http.server 8000
```

打开 http://localhost:8000 。无需前端构建。部署任意静态托管时使用 `sites/beishu-lab/dist`；修改源码后需同步 dist。

线上使用 GitHub Pages，从 `codex/pages` 分支的根目录发布。更新网站时，将最新 dist 同步到该分支并推送。旧 Sites 地址暂留用于用户导出资料；换域名后需在旧站导出 JSON 备份，再到新站导入，浏览器本机数据不会自动迁移。

## 项目结构

| 目录 | 内容 |
| --- | --- |
| `sites/beishu-lab` | 网页源码、导入模板和自动测试 |
| `sites/beishu-lab/dist` | 可部署静态文件 |
| `android/beibei` | 离线 Android WebView 应用、系统文件导入导出与构建脚本 |
| `desktop/beibei` | Windows Electron 应用与构建配置 |

## Android

从 Releases 下载 APK，传到手机打开安装。支持 Android 8.0 及以上，请保持 Android System WebView 为较新版本。无需互联网权限，可离线使用。

手机长按原文选择文字后，点击“划出所选意群”；画布支持缩放和全图。备份及模板下载使用系统文件保存界面。

构建需要 PowerShell 7、JDK 21、Android SDK platform 35 / build-tools 35.0.0。可设置 JAVA_HOME 和 ANDROID_HOME（或 ANDROID_SDK_ROOT），也支持 README 中的本地 toolchain 目录。进入 `android/beibei` 运行 `./build.ps1`。首次构建会生成开发者自己的发布签名；本仓库不包含官方安装包的私钥，因此自行构建的包不能直接覆盖官方包。

## Windows

进入 `desktop/beibei` 执行 `pnpm install`、`pnpm start`。执行 `pnpm dist` 可构建安装版和便携版。当前 Release 提供 Android 试用包，Windows 可从源码构建。

## 测试与当前限制

Node.js 22+，在 `sites/beishu-lab` 执行 `pnpm install`、`pnpm test`。在 `desktop/beibei` 执行 `node --test tests/*.test.cjs`。

2026-10-23：网页 50 项自动测试通过；Android APK 编译、签名和资源一致性校验通过。尚未完成 Android 真机安装及触屏验收，当前是试用版。部分界面仍需要实际设备反馈。

复习使用简化间隔排程，不是 Anki 的 FSRS / SM-2，不能导入 `.apkg`。完整备份最多 100 MB，单张图片最多 15 MB。JSON 备份未加密，卸载或清除数据前请导出并妥善保存。

## 第三方组件

SheetJS CE：Apache-2.0，许可证随 `vendor/SHEETJS-LICENSE.txt` 提供。Electron、测试依赖等遵循各自许可证。本次公开源码未额外授予项目级开源许可证。
