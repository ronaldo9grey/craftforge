#!/bin/bash
# =============================================================
# CraftForge 数据库恢复脚本
# 使用方式：./restore.sh /opt/craftforge/backups/craftforge-20260629_030001.db.gz
# - 自动停止后端 PM2 进程，避免写入冲突
# - 解压备份文件到临时位置 → 替换数据库 → 重启 PM2
# - 旧数据库会自动重命名为 craftforge.db.before-restore-YYYYMMDD_HHMMSS
# =============================================================
set -e

DB_PATH="${DB_PATH:-/opt/craftforge/craftforge-server/data/craftforge.db}"
PM2_APP="${PM2_APP:-craftforge-server}"

if [ $# -eq 0 ]; then
  echo "用法: $0 <backup-file.db.gz>"
  echo ""
  echo "可用备份："
  ls -lh "${BACKUP_DIR:-/opt/craftforge/backups}/"craftforge-*.db.gz 2>/dev/null || echo "  (未找到任何备份)"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ 备份文件不存在: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  即将用备份恢复数据库："
echo "   备份文件: $BACKUP_FILE"
echo "   目标位置: $DB_PATH"
read -p "确认继续？这将覆盖现有数据 [y/N]: " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "已取消"
  exit 0
fi

# 停止后端
if command -v pm2 &> /dev/null; then
  echo "停止 PM2 进程: $PM2_APP"
  pm2 stop "$PM2_APP" || true
fi

# 备份当前数据库
if [ -f "$DB_PATH" ]; then
  BACKUP_OLD="${DB_PATH}.before-restore-$(date +%Y%m%d_%H%M%S)"
  mv "$DB_PATH" "$BACKUP_OLD"
  # WAL/SHM 一起处理
  [ -f "${DB_PATH}-wal" ] && mv "${DB_PATH}-wal" "${BACKUP_OLD}-wal"
  [ -f "${DB_PATH}-shm" ] && mv "${DB_PATH}-shm" "${BACKUP_OLD}-shm"
  echo "✅ 当前数据库已备份到: $BACKUP_OLD"
fi

# 解压恢复
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" > "$DB_PATH"
else
  cp "$BACKUP_FILE" "$DB_PATH"
fi
chmod 600 "$DB_PATH"
echo "✅ 数据库已恢复"

# 重启后端
if command -v pm2 &> /dev/null; then
  pm2 start "$PM2_APP" || true
  echo "✅ PM2 进程已重启"
fi

echo "🎉 恢复完成"
