#!/bin/bash

# 02engine_deb_to_pkginfo.sh - 专门用于02Engine deb包的信息提取

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示用法
usage() {
    echo "用法: $0 <02Engine-deb文件> [输出目录]"
    echo "示例: $0 02engine_1.1.8-1_aarch64.deb"
    echo "       $0 02engine_1.1.8-1_aarch64.deb /tmp/pkginfo"
    exit 1
}

# 检查依赖
check_dependencies() {
    local deps=("dpkg-deb" "stat")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            echo -e "${RED}错误: 未找到 $dep 命令${NC}"
            echo "请安装必要的工具:"
            echo "Ubuntu/Debian: sudo apt-get install dpkg coreutils"
            exit 1
        fi
    done
}

# 提取deb包信息
extract_deb_info() {
    local deb_file="$1"
    local temp_dir="$2"
    
    echo -e "${YELLOW}正在分析 02Engine 包: $deb_file...${NC}"
    
    # 检查文件是否存在
    if [[ ! -f "$deb_file" ]]; then
        echo -e "${RED}错误: 文件 $deb_file 不存在${NC}"
        exit 1
    fi
    
    # 检查文件格式
    if ! file "$deb_file" | grep -q "Debian binary package"; then
        echo -e "${RED}错误: $deb_file 不是有效的deb包${NC}"
        exit 1
    fi
    
    # 提取control信息
    if ! dpkg-deb -I "$deb_file" control > "$temp_dir/control" 2>/dev/null; then
        echo -e "${RED}错误: 无法提取deb包控制信息${NC}"
        exit 1
    fi
}

# 解析control文件
parse_control_file() {
    local control_file="$1"
    
    declare -gA pkg_info
    
    while IFS=':' read -r key value; do
        # 移除前导空白字符
        key=$(echo "$key" | sed 's/^[ \t]*//;s/[ \t]*$//')
        value=$(echo "$value" | sed 's/^[ \t]*//;s/[ \t]*$//')
        
        if [[ -n "$key" && -n "$value" ]]; then
            pkg_info["$key"]="$value"
        fi
    done < "$control_file"
}

# 严格获取架构信息
get_strict_architecture() {
    local arch="${pkg_info[Architecture]}"
    
    # 严格映射架构名称
    case "$arch" in
        "arm64")
            echo "aarch64"
            ;;
        "armhf"|"armv7l"|"armv7hl")
            echo "armv7l"
            ;;
        "amd64")
            echo "x86_64"
            ;;
        "i386")
            echo "i686"
            ;;
        "aarch64"|"x86_64"|"i686"|"armv7l")
            echo "$arch"
            ;;
        *)
            echo -e "${RED}错误: 不支持的架构 '$arch'${NC}"
            echo -e "${YELLOW}支持的架构: aarch64, x86_64, i686, armv7l${NC}"
            exit 1
            ;;
    esac
}

# 生成02Engine专用的PKGINFO文件
generate_02engine_pkginfo() {
    local deb_file="$1"
    local output_dir="$2"
    
    # 获取包基本信息
    local pkg_name="${pkg_info[Package]:-02engine}"
    local pkg_version="${pkg_info[Version]}"
    local architecture=$(get_strict_architecture)
    
    # 如果无法获取版本，使用默认值
    if [[ -z "$pkg_version" ]]; then
        pkg_version="1.0.0-1"
        echo -e "${YELLOW}警告: 无法从包中提取版本号，使用默认值: $pkg_version${NC}"
    fi
    
    # 直接生成 .PKGINFO 文件
    local pkginfo_file="$output_dir/.PKGINFO"
    
    # 获取文件信息
    local file_size=$(stat -c%s "$deb_file" 2>/dev/null || stat -f%z "$deb_file")
    
    # 构建日期（使用当前时间戳）
    local builddate=$(date +%s)
    
    # 生成符合02Engine格式的PKGINFO
    {
        echo "pkgname = ${pkg_name}"
        echo "pkgver = ${pkg_version}"
        echo "pkgdesc = ${pkg_info[Description]:-Mod of Scratch with a compiler and more features. 02Engine.Better Scratch.Made from Turbowarp.}"
        echo "url = https://02engine.02studio.xyz"
        echo "builddate = ${builddate}"
        echo "packager = ${pkg_info[Maintainer]:-Unknown Packager}"
        echo "arch = ${architecture}"
        echo "size = ${file_size}"
        echo "license = ${pkg_info[License]:-custom}"
        
        # 预制的依赖列表
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

    echo "$pkginfo_file"
}

# 显示详细信息
show_detailed_info() {
    local deb_file="$1"
    local architecture="$2"
    
    echo -e "\n${BLUE}=== 02Engine 包详细信息 ===${NC}"
    echo -e "${GREEN}文件名:${NC} $(basename "$deb_file")"
    echo -e "${GREEN}包名:${NC} ${pkg_info[Package]:-02engine}"
    echo -e "${GREEN}版本:${NC} ${pkg_info[Version]:-未知}"
    echo -e "${GREEN}架构:${NC} $architecture"
    echo -e "${GREEN}描述:${NC} ${pkg_info[Description]:-Mod of Scratch with a compiler and more features}"
    echo -e "${GREEN}维护者:${NC} ${pkg_info[Maintainer]:-未知}"
    echo -e "${GREEN}大小:${NC} $(stat -c%s "$deb_file" 2>/dev/null || stat -f%z "$deb_file") 字节"
    echo -e "${GREEN}许可证:${NC} ${pkg_info[License]:-custom}"
}

# 验证架构支持
validate_architecture() {
    local arch="$1"
    local supported_archs=("aarch64" "x86_64" "i686" "armv7l")
    
    for supported in "${supported_archs[@]}"; do
        if [[ "$arch" == "$supported" ]]; then
            return 0
        fi
    done
    
    echo -e "${RED}错误: 不支持的架构 '$arch'${NC}"
    echo -e "${YELLOW}支持的架构: ${supported_archs[*]}${NC}"
    return 1
}

main() {
    # 检查参数
    if [[ $# -lt 1 ]]; then
        usage
    fi
    
    local deb_file="$1"
    local output_dir="${2:-.}"
    
    # 检查文件是否存在
    if [[ ! -f "$deb_file" ]]; then
        echo -e "${RED}错误: 文件 $deb_file 不存在${NC}"
        exit 1
    fi
    
    # 创建输出目录
    mkdir -p "$output_dir"
    
    # 检查依赖
    check_dependencies
    
    # 创建临时目录
    local temp_dir
    temp_dir=$(mktemp -d)
    trap 'rm -rf "$temp_dir"' EXIT
    
    echo -e "${YELLOW}正在提取 02Engine 包信息...${NC}"
    
    # 提取信息
    extract_deb_info "$deb_file" "$temp_dir"
    parse_control_file "$temp_dir/control"
    
    # 严格获取架构
    local architecture=$(get_strict_architecture)
    
    # 验证架构是否支持
    if ! validate_architecture "$architecture"; then
        exit 1
    fi
    
    echo -e "${GREEN}检测到架构:${NC} $architecture"
    
    # 生成PKGINFO文件
    local pkginfo_file
    pkginfo_file=$(generate_02engine_pkginfo "$deb_file" "$output_dir")
    
    # 显示信息
    show_detailed_info "$deb_file" "$architecture"
    echo -e "\n${GREEN}✓ PKGINFO文件已生成:${NC} $pkginfo_file"
    
    # 显示生成的PKGINFO内容预览
    echo -e "\n${BLUE}=== 生成的内容预览 ===${NC}"
    cat "$pkginfo_file"
    
    # 清理临时文件
    rm -rf "$temp_dir"
}

# 如果脚本直接运行，则执行main函数
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
