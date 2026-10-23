# 背背 · Windows

## 使用

- `release/Beibei-Setup-1.0.0-x64.exe`：Windows x64 安装版，支持选择安装位置、桌面快捷方式。
- `release/Beibei-Portable-1.0.0-x64.exe`：免安装启动程序。学习数据仍保存在当前 Windows 用户的数据目录，不随 EXE 文件移动。
- 无需登录，可离线学习。顶部菜单“文件 → 打开数据文件夹”可找到本机数据；备份时先退出背背，再复制整个数据文件夹。
- 桌面版与网页版数据独立。支持通过 Excel、TXT、CSV、TSV、JSON 导入卡片。
- 统计与专注：默认 25 分钟，可设置 1–180 分钟，暂停/继续/结束。切换页面或关闭窗口不会暂停计时，重新打开时恢复并按目标时长结算。提前结束保留实际专注时间。
- 历史复习统计从已有卡片仍保留的记录迁移；以前没有记录的专注时长不会补造。清理应用数据会清除卡片与统计。

## 开发

Node.js 22+；依赖版本固定于 `pnpm-lock.yaml`。

```powershell
pnpm install
pnpm test
pnpm start
pnpm dist
```

网页来源：`../../sites/beishu-lab/dist/`。发布前将该目录内容同步到 `web/`；桌面资源测试验证二者一致。
运行时隔离：renderer sandbox / contextIsolation，关闭 Node 集成，仅允许内置 beibei://app 页面。安装包未使用商业代码签名证书。
