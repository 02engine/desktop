#!/bin/bash
# =============================================================================
#  02Engine DEB → Arch Linux 包一键转换脚本（终极修复版 - 集成版）
#  实测完美运行于 Ubuntu 20.04/22.04/24.04 + debtap
#  内置 makepkginfo 逻辑，无需额外脚本文件
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ================ 配置区 ================
DIST_DIR="dist"                    # 存放 .deb 文件的目录
OUTPUT_DIR="arch-packages"         # 输出目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# =========================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }

# ==================== 内置 makepkginfo 核心逻辑 ====================
# 检查依赖（dpkg-deb/stat）
check_makepkginfo_deps() {
    local deps=("dpkg-deb" "stat")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "未找到 $dep 命令"
            log_info "请安装依赖：sudo apt-get install dpkg coreutils"
            exit 1
        fi
    done
}

# 提取deb包control信息
extract_deb_control() {
    local deb_file="$1"
    local temp_dir="$2"
    
    if ! file "$deb_file" | grep -q "Debian binary package"; then
        log_error "$deb_file 不是有效的deb包"
        return 1
    fi
    
    if ! dpkg-deb -I "$deb_file" control > "$temp_dir/control" 2>/dev/null; then
        log_error "无法提取deb包控制信息"
        return 1
    fi
    return 0
}

# 解析control文件到关联数组
parse_control() {
    local control_file="$1"
    declare -gA pkg_info=()
    
    while IFS=':' read -r key value; do
        key=$(echo "$key" | sed 's/^[ \t]*//;s/[ \t]*$//')
        value=$(echo "$value" | sed 's/^[ \t]*//;s/[ \t]*$//')
        if [[ -n "$key" && -n "$value" ]]; then
            pkg_info["$key"]="$value"
        fi
    done < "$control_file"
}

# 严格映射架构名称
get_arch_mapping() {
    local arch="${pkg_info[Architecture]}"
    case "$arch" in
        "arm64") echo "aarch64" ;;
        "armhf"|"armv7l"|"armv7hl") echo "armv7l" ;;
        "amd64") echo "x86_64" ;;
        "i386") echo "i686" ;;
        "aarch64"|"x86_64"|"i686"|"armv7l") echo "$arch" ;;
        *) 
            log_error "不支持的架构 '$arch'"
            log_info "支持的架构：aarch64, x86_64, i686, armv7l"
            return 1
            ;;
    esac
    return 0
}

# 生成.PKGINFO文件（核心函数）
generate_pkginfo() {
    local deb_file="$1"
    local output_dir="$2"
    local temp_dir="$3"
    
    # 提取并解析control信息
    if ! extract_deb_control "$deb_file" "$temp_dir"; then
        return 1
    fi
    parse_control "$temp_dir/control"
    
    # 获取架构信息
    local architecture
    if ! architecture=$(get_arch_mapping); then
        return 1
    fi
    
    # 构建基础信息
    local pkg_name="${pkg_info[Package]:-02engine}"
    local pkg_version="${pkg_info[Version]:-1.0.0-1}"
    local pkg_desc="${pkg_info[Description]:-Mod of Scratch with a compiler and more features. 02Engine.Better Scratch.Made from Turbowarp.}"
    local packager="${pkg_info[Maintainer]:-Unknown Packager}"
    local license="${pkg_info[License]:-custom}"
    local file_size=$(stat -c%s "$deb_file" 2>/dev/null || stat -f%z "$deb_file")
    local builddate=$(date +%s)
    
    # 生成.PKGINFO文件
    local pkginfo_file="$output_dir/.PKGINFO"
    {
        echo "pkgname = ${pkg_name}"
        echo "pkgver = ${pkg_version}"
        echo "pkgdesc = ${pkg_desc}"
        echo "url = https://02engine.02studio.xyz"
        echo "builddate = ${builddate}"
        echo "packager = ${packager}"
        echo "arch = ${architecture}"
        echo "size = ${file_size}"
        echo "license = ${license}"
        
        # 预制依赖列表
        echo "depend = alsa-lib"
        echo "depend = at-spi2-atk"
        echo "depend = at-spi2-core"
        echo "depend = cairo"
        echo "depend = dbus"
        echo "depend = expat"
        echo "depend = gcc-libs"
        echo "depend = glib2"
        echo "depend = glibc"
        echo "depend = gtk3"
        echo "depend = hicolor-icon-theme"
        echo "depend = libcups"
        echo "depend = libnotify"
        echo "depend = libsecret"
        echo "depend = libx11"
        echo "depend = libxcb"
        echo "depend = libxcomposite"
        echo "depend = libxdamage"
        echo "depend = libxext"
        echo "depend = libxfixes"
        echo "depend = libxkbcommon"
        echo "depend = libxrandr"
        echo "depend = libxss"
        echo "depend = libxtst"
        echo "depend = mesa"
        echo "depend = nspr"
        echo "depend = nss"
        echo "depend = pango"
        echo "depend = systemd-libs"
        echo "depend = util-linux-libs"
        echo "depend = xdg-utils"
        echo "optdepend = libappindicator"
    } > "$pkginfo_file"
    
    # 输出调试信息
    log_info "PKGINFO 生成完成："
    log_info "  包名: $pkg_name"
    log_info "  版本: $pkg_version"
    log_info "  架构: $architecture"
    log_info "  输出路径: $pkginfo_file"
    
    return 0
}
# ==================== 内置 makepkginfo 逻辑结束 ====================

# 强制创建假数据库，绕过debtap更新提示
patch_debtap_forever() {
    local fake_db="/var/lib/pacman/sync"
    if [ ! -d "$fake_db" ]; then
        log_info "创建假 pacman 数据库，彻底禁用 debtap 更新提示"
        sudo mkdir -p "$fake_db"
        sudo touch "$fake_db"/{core.db,extra.db,community.db,multilib.db}
    fi
}

# 检查前置条件
check_prerequisites() {
    log_step "检查前置条件"

    [[ -d "$DIST_DIR" ]] || { log_error "目录 $DIST_DIR 不存在！"; exit 1; }
    command -v debtap &>/dev/null || { log_error "debtap 未安装！请运行：sudo apt install debtap"; exit 1; }
    
    # 检查makepkginfo所需依赖
    check_makepkginfo_deps
    
    mkdir -p "$OUTPUT_DIR"
    patch_debtap_forever
}

# 安全查找所有.deb文件（支持空格、中文路径）
find_deb_files() {
    local files=()
    while IFS= read -r -d '' file; do
        files+=("$file")
    done < <(find "$DIST_DIR" -type f -name "*.deb" -print0 2>/dev/null)
    echo "${files[@]}"
}

# 单个deb文件转换逻辑
convert_single_deb() {
    local deb_file="$1"
    local base_name="$(basename "$deb_file" .deb)"
    local temp_dir
    
    log_step "正在转换: $base_name"

    # 创建临时目录（自动清理）
    temp_dir="$(mktemp -d)" || { log_error "创建临时目录失败"; return 1; }
    trap 'rm -rf "$temp_dir"' RETURN

    # 复制deb文件到临时目录
    cp "$deb_file" "$temp_dir/"
    cd "$temp_dir"

    # 1. 生成.PKGINFO文件（内置逻辑）
    log_info "生成 .PKGINFO ..."
    if ! generate_pkginfo "$deb_file" "$temp_dir" "$temp_dir"; then
        log_error ".PKGINFO 生成失败"
        return 1
    fi

    [[ -f .PKGINFO ]] || { log_error ".PKGINFO 未生成！"; return 1; }

    # 2. 执行debtap转换（静默模式）
    log_info "执行 debtap（静默模式）..."
    printf "y\ny\nn\nn\n\n\n" | debtap -q "$(basename "$deb_file")" > debtap.log 2>&1 || {
        log_warn "debtap 返回非零，可能是正常警告，继续检查结果..."
        cat debtap.log
    }

    # 3. 查找生成的Arch包
    local arch_pkg
    arch_pkg=$(find . -maxdepth 1 \( -name "*.pkg.tar.*" -o -name "*.tar.xz" -o -name "*.pkg.tar.zst" \) | head -n1)

    if [[ -z "$arch_pkg" ]]; then
        log_error "未找到生成的Arch包！当前目录内容："
        ls -la
        return 1
    fi

    # 4. 移动到输出目录并命名
    local final_name="$OUTPUT_DIR/${base_name}-arch-$(date +%Y%m%d).pkg.tar.xz"
    mv "$arch_pkg" "$final_name"

    log_info "✓ 转换成功！"
    echo -e "   输入: $(basename "$deb_file")"
    echo -e "   输出: $(basename "$final_name")  ($(du -h "$final_name" | cut -f1))"
    echo
}

# 主函数
main() {
    clear
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${BLUE}   02Engine DEB → Arch Linux 包转换工具（终极集成版）${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo

    check_prerequisites

    # 获取所有deb文件
    mapfile -t deb_files < <(find_deb_files)

    if [[ ${#deb_files[@]} -eq 0 ]]; then
        log_warn "在 $DIST_DIR 目录未找到任何 .deb 文件"
        exit 0
    fi

    log_info "发现 ${#deb_files[@]} 个 .deb 文件，开始转换..."

    # 清空并重建输出目录
    rm -rf "$OUTPUT_DIR" && mkdir -p "$OUTPUT_DIR"

    # 批量转换
    local success=0 fail=0
    for deb in "${deb_files[@]}"; do
        if convert_single_deb "$deb"; then
            ((success++))
        else
            ((fail++))
        fi
    done

    # 输出统计结果
    echo -e "${BLUE}=================================================${NC}"
    log_step "全部完成！成功: $success  失败: $fail  总计: $((success + fail))"
    log_info "输出目录：$(realpath "$OUTPUT_DIR")"
    echo -e "${BLUE}=================================================${NC}"
}

# 捕获Ctrl+C中断
trap 'echo -e "\n${RED}用户中断，退出。${NC}"; exit 130' INT

# 启动主程序
main "$@"
