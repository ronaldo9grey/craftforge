#!/bin/bash
# =============================================================
# CraftForge SQLite 数据库备份脚本
# - 使用 sqlite3 .backup 命令做热备份（不会锁住正在运行的服务）
# - 备份到 BACKUP_DIR，按日期命名
# - 自动清理超过 RETAIN_DAYS 的旧备份
# - 可被 cron 调用：每天凌晨 3 点跑一次
# =============================================================
set -e

# 配置（可被环境变量覆盖）
DB_PATH="${DB_PATH:-/opt/craftforge/craftforge-server/data/craftforge.db}"
BACKUP_DIR="${BACKUP_DIR:-/opt/craftforge/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"
LOG_FILE="${LOG_FILE:-/opt/craftforge/backups/backup.log}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/craftforge-$TIMESTAMP.db"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "开始备份: $DB_PATH"

if [ ! -f "$DB_PATH" ]; then
  log "❌ 数据库文件不存在: $DB_PATH"
  exit 1
fi

# 优先用 sqlite3 .backup 做热备份；如果 sqlite3 命令不存在，退化为 cp（SQLite WAL 模式下 cp 也是安全的，但 .backup 更稳）
if command -v sqlite3 &> /dev/null; then
  sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
  log "✅ 使用 sqlite3 .backup 完成: $BACKUP_FILE"
else
  cp "$DB_PATH" "$BACKUP_FILE"
  # 同时拷贝 WAL（如果存在），保证一致性
  [ -f "${DB_PATH}-wal" ] && cp "${DB_PATH}-wal" "${BACKUP_FILE}-wal"
  [ -f "${DB_PATH}-shm" ] && cp "${DB_PATH}-shm" "${BACKUP_FILE}-shm"
  log "✅ 使用 cp 完成: $BACKUP_FILE"
fi

# 文件权限收紧
chmod 600 "$BACKUP_FILE"

# 计算文件大小
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "备份大小: $SIZE"

# 压缩（节省空间，可选）
gzip -f "$BACKUP_FILE"
log "已 gzip 压缩: ${BACKUP_FILE}.gz"

# 清理过期备份
log "清理 $RETAIN_DAYS 天前的旧备份..."
DELETED=$(find "$BACKUP_DIR" -name "craftforge-*.db.gz" -type f -mtime +$RETAIN_DAYS -print -delete | wc -l)
log "已清理 $DELETED 个过期备份"

# 当前剩余备份数
REMAIN=$(find "$BACKUP_DIR" -name "craftforge-*.db.gz" -type f | wc -l)
log "当前保留备份: $REMAIN 个"

log "备份完成 ✅"
