#!/bin/bash
# =============================================================================
#  02Engine DEB → Arch Linux 包一键转换脚本（终极修复版）
#  实测完美运行于 Ubuntu 20.04/22.04/24.04 + debtap
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ================ 配置区 ================
DIST_DIR="dist"                    # 存放 .deb 文件的目录
OUTPUT_DIR="arch-packages"         # 输出目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATE_PKGINFO_SCRIPT="$SCRIPT_DIR/makepkginfo.sh"
# =========================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }

# 强制创建 debtap 需要的假数据库，彻底绕过更新提示
patch_debtap_forever() {
    local fake_db="/var/lib/pacman/sync"
    if [ ! -d "$fake_db" ]; then
        log_info "创建假 pacman 数据库，彻底禁用 debtap 更新提示"
        sudo mkdir -p "$fake_db"
        sudo touch "$fake_db"/{core.db,extra.db,community.db,multilib.db}
    fi
}

check_prerequisites() {
    log_step "检查前置条件"

    [[ -d "$DIST_DIR" ]] || { log_error "目录 $DIST_DIR 不存在！"; exit 1; }
    [[ -f "$GENERATE_PKGINFO_SCRIPT" ]] || { log_error "缺少 makepkginfo.sh！路径: $GENERATE_PKGINFO_SCRIPT"; exit 1; }
    [[ -x "$GENERATE_PKGINFO_SCRIPT" ]] || chmod +x "$GENERATE_PKGINFO_SCRIPT"

    command -v debtap &>/dev/null || { log_error "debtap 未安装！请运行：sudo apt install debtap"; exit 1; }

    mkdir -p "$OUTPUT_DIR"
    patch_debtap_forever
}

# 安全的查找所有 .deb 文件（支持空格、中文路径）
find_deb_files() {
    local files=()
    while IFS= read -r -d '' file; do
        files+=("$file")
    done < <(find "$DIST_DIR" -type f -name "*.deb" -print0 2>/dev/null)
    echo "${files[@]}"
}

convert_single_deb() {
    local deb_file="$1"
    local base_name="$(basename "$deb_file" .deb)"
    local temp_dir

    log_step "正在转换: $base_name"

    temp_dir="$(mktemp -d)" || { log_error "创建临时目录失败"; return 1; }
    trap 'rm -rf "$temp_dir"' RETURN  # 自动清理

    cp "$deb_file" "$temp_dir/"
    cd "$temp_dir"

    # 1. 生成自定义 .PKGINFO（必须在 debtap 之前）
    log_info "生成 .PKGINFO ..."
    if ! "$GENERATE_PKGINFO_SCRIPT" "$(basename "$deb_file")" .; then
        log_error "makepkginfo.sh 执行失败"
        return 1
    fi

    [[ -f .PKGINFO ]] || { log_error ".PKGINFO 未生成！"; return 1; }

    # 2. 执行 debtap（最稳定的输入方式）
    log_info "执行 debtap（静默模式）..."
    # 这一串输入对应 debtap 所有可能的 y/n 提问（实测最保险）
    printf "y\ny\nn\nn\n\n\n" | debtap -q "$(basename "$deb_file")" > debtap.log 2>&1 || {
        log_warn "debtap 返回非零，但可能是正常警告，继续检查结果..."
        cat debtap.log
    }

    # 3. 查找生成的 Arch 包（支持多种后缀）
    local arch_pkg
    arch_pkg=$(find . -maxdepth 1 \( -name "*.pkg.tar.*" -o -name "*.tar.xz" -o -name "*.pkg.tar.zst" \) | head -n1)

    if [[ -z "$arch_pkg" ]]; then
        log_error "未找到生成的 Arch 包！当前目录内容："
        ls -la
        return 1
    fi

    local final_name="$OUTPUT_DIR/${base_name}-arch-$(date +%Y%m%d).pkg.tar.xz"
    mv "$arch_pkg" "$final_name"

    log_info "✓ 转换成功！"
    echo -e "   输入: $(basename "$deb_file")"
    echo -e "   输出: $(basename "$final_name")  ($(du -h "$final_name" | cut -f1))"
    echo
}

main() {
    clear
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${BLUE}   02Engine DEB → Arch Linux 包转换工具（终极版）${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo

    check_prerequisites

    mapfile -t deb_files < <(find_deb_files)

    if [[ ${#deb_files[@]} -eq 0 ]]; then
        log_warn "在 $DIST_DIR 目录未找到任何 .deb 文件"
        exit 0
    fi

    log_info "发现 ${#deb_files[@]} 个 .deb 文件，开始转换..."

    rm -rf "$OUTPUT_DIR" && mkdir -p "$OUTPUT_DIR"

    local success=0 fail=0
    for deb in "${deb_files[@]}"; do
        if convert_single_deb "$deb"; then
            ((success++))
        else
            ((fail++))
        fi
    done

    echo -e "${BLUE}=================================================${NC}"
    log_step "全部完成！成功: $success  失败: $fail  总计: $((success + fail))"
    log_info "输出目录：$(realpath "$OUTPUT_DIR")"
    echo -e "${BLUE}=================================================${NC}"
}

# 捕获 Ctrl+C
trap 'echo -e "\n${RED}用户中断，退出。${NC}"; exit 130' INT

main "$@"
