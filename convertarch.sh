#!/bin/bash
set -e

# 配置变量
DIST_DIR="dist"
OUTPUT_DIR="arch-packages"
SCRIPT_DIR="$(dirname "$0")"
GENERATE_PKGINFO_SCRIPT="$SCRIPT_DIR/makepkginfo.sh"

# 颜色输出函数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# 检查必要文件
check_prerequisites() {
    log_info "检查前置条件..."
    
    if [ ! -d "$DIST_DIR" ]; then
        log_error "目录 $DIST_DIR 不存在"
        exit 1
    fi
    
    if [ ! -f "$GENERATE_PKGINFO_SCRIPT" ]; then
        log_error "PKGINFO 生成脚本不存在: $GENERATE_PKGINFO_SCRIPT"
        exit 1
    fi
    
    if ! command -v debtap &> /dev/null; then
        log_error "debtap 未安装"
        exit 1
    fi
    
    mkdir -p "$OUTPUT_DIR"
}

# 更新 debtap 数据库
update_debtap() {
    log_info "更新 debtap 数据库..."
    if sudo debtap -u <<< "y"; then
        log_info "debtap 数据库更新成功"
    else
        log_warn "debtap 数据库更新失败，尝试继续执行..."
    fi
}

# 查找生成的 Arch 包文件（修复版本）
find_arch_package() {
    local dir="$1"
    
    # 优先查找 pkg.tar.zst 格式
    local found_file=$(find "$dir" -maxdepth 1 -name "*.pkg.tar.zst" | head -1)
    
    if [ -n "$found_file" ]; then
        echo "$found_file"
        return 0
    fi
    
    # 如果找不到 zst，查找其他可能格式
    found_file=$(find "$dir" -maxdepth 1 \( -name "*.pkg.tar.*" -o -name "*.tar.xz" \) | head -1)
    
    if [ -n "$found_file" ]; then
        echo "$found_file"
        return 0
    fi
    
    # 最后尝试查找任何可能的包文件
    found_file=$(find "$dir" -maxdepth 1 -type f \( -name "*.pkg.*" -o -name "*.tar.*" \) | head -1)
    
    if [ -n "$found_file" ]; then
        echo "$found_file"
        return 0
    fi
    
    return 1
}

# 转换单个 .deb 文件
convert_single_deb() {
    local deb_file="$1"
    local base_name=$(basename "$deb_file" .deb)
    
    log_step "开始处理: $(basename "$deb_file")"
    
    # 为每个文件创建独立的工作目录
    local temp_dir=$(mktemp -d)
    cd "$temp_dir"
    cp "$deb_file" .
    local current_deb=$(basename "$deb_file")
    
    log_info "工作目录: $temp_dir"
    log_info "当前文件: $current_deb"
    
    # 步骤1: 生成自定义 PKGINFO
    log_step "步骤 1/3: 生成自定义 PKGINFO"
    if ! "$GENERATE_PKGINFO_SCRIPT" "$current_deb" "."; then
        log_error "PKGINFO 生成失败"
        cd - > /dev/null
        rm -rf "$temp_dir"
        return 1
    fi
    
    if [ ! -f ".PKGINFO" ]; then
        log_error ".PKGINFO 文件未生成"
        cd - > /dev/null
        rm -rf "$temp_dir"
        return 1
    fi
    
    log_info "PKGINFO 生成成功"
    echo "=== PKGINFO 内容预览 ==="
    cat .PKGINFO
    echo "========================"
    
    # 步骤2: 使用 debtap 转换
    log_step "步骤 2/3: 执行 debtap 转换"
    log_info "执行: debtap -q '$current_deb'"
    
    # 执行转换并捕获输出
    if debtap -q "$current_def" 2>&1; then
        log_info "debtap 转换命令执行成功"
    else
        debtap_exit_code=$?
        log_warn "debtap 退出代码: $debtap_exit_code，继续检查结果..."
    fi
    
    # 步骤3: 检查生成结果（修复查找逻辑）
    log_step "步骤 3/3: 检查生成结果"
    
    log_info "当前目录文件列表:"
    ls -la
    
    local arch_pkg=$(find_arch_package ".")
    
    if [ -z "$arch_pkg" ]; then
        log_error "未找到生成的 Arch 包文件"
        log_info "尝试查找所有相关文件:"
        find . -maxdepth 1 -type f | while read file; do
            echo "文件: $(basename "$file") - 类型: $(file -b "$file")"
        done
        cd - > /dev/null
        rm -rf "$temp_dir"
        return 1
    fi
    
    local pkg_filename=$(basename "$arch_pkg")
    log_info "找到生成的包: $pkg_filename"
    log_info "文件类型: $(file -b "$arch_pkg")"
    log_info "文件大小: $(du -h "$arch_pkg" | cut -f1)"
    
    # 移动生成的包到输出目录
    mv "$arch_pkg" "../$OUTPUT_DIR/"
    
    # 返回原目录并清理
    cd - > /dev/null
    rm -rf "$temp_dir"
    
    log_info "✓ 转换成功: $(basename "$deb_file") → $pkg_filename"
    return 0
}

# 批量处理所有 .deb 文件
process_all_debs_sequentially() {
    local deb_files=($(find "$DIST_DIR" -name "*.deb"))
    local total=${#deb_files[@]}
    
    if [ $total -eq 0 ]; then
        log_warn "在 $DIST_DIR 目录中未找到 .deb 文件"
        return 0
    fi
    
    log_info "找到 $total 个 .deb 文件，开始逐个处理..."
    echo "========================================"
    
    local success_count=0
    local fail_count=0
    local current=0
    
    for deb_file in "${deb_files[@]}"; do
        ((current++))
        log_step "处理文件 [$current/$total]: $(basename "$deb_file")"
        
        if convert_single_deb "$deb_file"; then
            ((success_count++))
            echo -e "${GREEN}✓ 第 $current 个文件处理成功${NC}"
        else
            ((fail_count++))
            echo -e "${RED}✗ 第 $current 个文件处理失败${NC}"
        fi
        
        if [ $current -lt $total ]; then
            echo "========================================"
            echo "准备处理下一个文件..."
            echo "========================================"
        fi
    done
    
    echo "========================================"
    log_info "批量处理完成"
    log_info "成功: $success_count, 失败: $fail_count, 总计: $total"
}

# 显示处理摘要
show_summary() {
    local generated_packages=($(find "$OUTPUT_DIR" -name "*.pkg.tar.zst" 2>/dev/null))
    local count=${#generated_packages[@]}
    
    log_step "处理摘要"
    log_info "输出目录: $OUTPUT_DIR/"
    log_info "生成的 .pkg.tar.zst 包数量: $count"
    
    if [ $count -gt 0 ]; then
        log_info "生成的包文件:"
        for pkg in "${generated_packages[@]}"; do
            echo "  📦 $(basename "$pkg") ($(du -h "$pkg" | cut -f1))"
        done
    else
        log_warn "没有生成 .pkg.tar.zst 格式的包"
        log_info "当前输出目录内容:"
        ls -la "$OUTPUT_DIR" 2>/dev/null || echo "输出目录为空"
    fi
}

# 主函数
main() {
    log_step "启动 02Engine DEB 到 Arch 包转换流程"
    
    check_prerequisites
    update_debtap
    
    # 清空输出目录
    if [ -d "$OUTPUT_DIR" ]; then
        rm -f "$OUTPUT_DIR"/* 2>/dev/null || true
    fi
    
    process_all_debs_sequentially
    show_summary
    
    log_step "转换流程结束"
}

trap 'log_error "脚本被中断"; exit 1' INT TERM
main "$@"
