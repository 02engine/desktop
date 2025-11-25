#!/bin/bash

set +e
set -uo pipefail
IFS=$'\n\t'

DIST_DIR="dist"
OUTPUT_DIR="arch-packages"

MAIN_COLOR='\033[0;36m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${MAIN_COLOR}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${MAIN_COLOR}[STEP]${NC}  $1"; }
log_sep()   { echo -e "${MAIN_COLOR}----------------------------------------${NC}"; }
safe_run()  { "$@" 2>/dev/null || true; }

check_prerequisites() {
    log_step "环境检查"
    [[ -d "$DIST_DIR" ]] || { log_error "dist 目录不存在"; exit 1; }
    command -v debtap &>/dev/null || { log_error "debtap 未安装"; exit 1; }
    [[ -d "$OUTPUT_DIR" ]] || mkdir -p "$OUTPUT_DIR"
    safe_run rm -f .PKGINFO .INSTALL .MTREE *.deb *.pkg.tar.* *.tar.*
    safe_run rm -rf pkg/ src/
    log_sep
}

get_deb_packages() { find "$DIST_DIR" -type f -name "*.deb" -print0; }

convert_single_package() {
    local deb_file="$1"
    local idx="$2"
    local total="$3"

    local deb_name="${deb_file##*/}"
    local base_name="${deb_name%.deb}"

    log_step "转换中 [$idx/$total]: $base_name"

    cp -f "$deb_file" "./$deb_name" || { log_error "文件复制失败"; return 1; }

    local input=$(mktemp)
    printf "y\ny\nn\nn\n\n\n" > "$input"
    debtap -q "$deb_name" < "$input" || true
    rm -f "$input"

    local arch_pkg=$(find . -maxdepth 1 \( -name "*.pkg.tar.*" -o -name "*.tar.xz" -o -name "*.tar.zst" \) -type f -print -quit)
    [[ -z "$arch_pkg" ]] && { log_error "转换未生成包文件"; safe_run rm -f "$deb_name"; return 1; }

    local temp_dir=$(mktemp -d)
    if ! bsdtar -xf "$arch_pkg" -C "$temp_dir" 2>/dev/null; then
        log_warn "解包失败，保留原包"
        mv "$arch_pkg" "$OUTPUT_DIR/${base_name}-arch-$(date +%Y%m%d-%H%M).pkg.tar.zst"
        rm -rf "$temp_dir"
        return 0
    fi

    local pkginfo="$temp_dir/.PKGINFO"
    if [[ -f "$pkginfo" ]]; then
        log_info "优化包信息"
        sed -i '/depend[[:space:]]*=[[:space:]]*\(gtk\|gir1.2-gtk\)/d' "$pkginfo"
        sed -i 's/^\(pkgver[[:space:]]*=[[:space:]]*\([0-9].*\)\)-[0-9][0-9]*$/\1/' "$pkginfo"
        sed -i 's/^license[[:space:]]*=.*$/license = GPL-3.0/' "$pkginfo"
        sed -i 's/^packager[[:space:]]*=.*$/packager = Webpack/' "$pkginfo"
        grep -q '^packager' "$pkginfo" || echo "packager = Webpack" >> "$pkginfo"
    fi

    local final_name="$OUTPUT_DIR/${base_name}-arch-$(date +%Y%m%d-%H%M).pkg.tar.zst"

    if [[ "$arch_pkg" == *.zst ]] || [[ "$arch_pkg" == *.pkg.tar ]]; then
        (cd "$temp_dir" && bsdtar -cf - * .PKGINFO .BUILDINFO .MTREE .INSTALL 2>/dev/null) | zstd -q -19 > "$final_name"
    elif [[ "$arch_pkg" == *.xz ]]; then
        (cd "$temp_dir" && bsdtar -cJf "$final_name" * .PKGINFO .BUILDINFO .MTREE .INSTALL 2>/dev/null)
    else
        (cd "$temp_dir" && bsdtar -czf "$final_name" * .PKGINFO .BUILDINFO .MTREE .INSTALL 2>/dev/null)
    fi

    rm -rf "$temp_dir" "$arch_pkg"
    local size=$(du -h "$final_name" 2>/dev/null | cut -f1)
    log_info "输出: $(basename "$final_name")  ($size)"
    log_sep

    return 0
}

cleanup_cache() {
    local deb_name="$1"
    safe_run rm -f "$deb_name" .PKGINFO .INSTALL .MTREE
    safe_run rm -rf pkg/ src/
    safe_run rm -f *.pkg.tar.* *.tar.* 2>/dev/null || true
}

main() {
    clear
    echo -e "${MAIN_COLOR}=================================================${NC}"
    echo -e "${MAIN_COLOR}        02Engine DEB → Arch 包转换器${NC}"
    echo -e "${MAIN_COLOR}=================================================${NC}"
    echo -e "${YELLOW}输出目录: $(pwd)/$OUTPUT_DIR${NC}\n"

    check_prerequisites

    local files=()
    while IFS= read -r -d '' f; do files+=("$f"); done < <(get_deb_packages)
    (( ${#files[@]} == 0 )) && { log_warn "未找到 deb 包"; exit 0; }

    local total=${#files[@]} success=0 fail=0
    log_info "发现 $total 个包，开始转换\n"

    for ((i=0; i<total; i++)); do
        if convert_single_package "${files[$i]}" $((i+1)) "$total"; then
            ((success++))
        else
            ((fail++))
            log_error "转换失败: $((i+1))"
        fi
        cleanup_cache "$(basename "${files[$i]}")"
        echo
    done

    echo -e "${MAIN_COLOR}=================================================${NC}"
    log_step "转换完成"
    log_info "总计: $total  成功: $success  失败: $fail"
    log_info "输出: $(pwd)/$OUTPUT_DIR"
    echo -e "${MAIN_COLOR}=================================================${NC}"
    (( fail > 0 )) && exit 1 || exit 0
}

trap 'echo -e "\n${RED}中断，清理中...${NC}";
      safe_run rm -f *.deb .PKGINFO .INSTALL .MTREE;
      safe_run rm -rf pkg/ src/;
      safe_run rm -f *.pkg.tar.* *.tar.* 2>/dev/null;
      echo -e "${RED}已退出${NC}"; exit 130' INT

main "$@"
