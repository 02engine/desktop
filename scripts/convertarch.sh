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

log_info()  { echo -e "${MAIN_COLOR}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${MAIN_COLOR}[STEP]${NC} $1"; }
log_sep()   { echo -e "${MAIN_COLOR}----------------------------------------${NC}"; }

safe_run() { "$@" 2>/dev/null || true; }

check_prerequisites() {
    log_step "Checking environment"
    [[ -d "$DIST_DIR" ]] || { log_error "dist directory does not exist"; exit 1; }
    command -v debtap &>/dev/null || { log_error "debtap is not installed. Please install debtap first."; exit 1; }
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

    log_step "Converting [$idx/$total]: $base_name"

    cp -f "$deb_file" "./$deb_name" || { log_error "Failed to copy file"; return 1; }

    # debtap interactive input: y y n n Enter Enter
    local input=$(mktemp)
    printf "y\ny\nn\nn\n\n\n" > "$input"
    debtap -q "$deb_name" < "$input" || true
    rm -f "$input"

    local arch_pkg=$(find . -maxdepth 1 \( -name "*.pkg.tar.*" -o -name "*.tar.xz" -o -name "*.tar.zst" \) -type f -print -quit)
    [[ -z "$arch_pkg" ]] && { log_error "No Arch package was generated"; safe_run rm -f "$deb_name"; return 1; }

    local temp_dir=$(mktemp -d)
    if ! bsdtar -xf "$arch_pkg" -C "$temp_dir" 2>/dev/null; then
        log_warn "Failed to extract package, keeping original output"
        mv "$arch_pkg" "$OUTPUT_DIR/${base_name}.pkg.tar.zst"
        rm -rf "$temp_dir"
        safe_run rm -f "$deb_name"
        return 0
    fi

    local pkginfo="$temp_dir/.PKGINFO"
    if [[ -f "$pkginfo" ]]; then
        log_info "Optimizing .PKGINFO"
        # Remove exact "gtk" dependency (won't match gtk3/gtk4/libgtk-3-0 etc.)
        sed -i '/^depend[[:space:]]*=[[:space:]]*gtk$/d' "$pkginfo"
        # Remove GObject Introspection junk (common in deb→arch conversion)
        sed -i '/depend[[:space:]]*=[[:space:]]*gir1.2-/d' "$pkginfo"
        # Standardize license & packager
        sed -i 's/^license[[:space:]]*=.*$/license = GPL-3.0/' "$pkginfo"
        sed -i 's/^packager[[:space:]]*=.*$/packager = Webpack/' "$pkginfo"
        grep -q '^packager' "$pkginfo" || echo "packager = Webpack" >> "$pkginfo"
    fi

    # Changed: simpler filename without -arch- and without timestamp
    local final_name="$OUTPUT_DIR/${base_name}.pkg.tar.zst"

    # Re-pack with zstd -19 (best compression, good compatibility)
    (cd "$temp_dir" && bsdtar -cf - .PKGINFO .BUILDINFO .MTREE .INSTALL * 2>/dev/null) \
        | zstd -q -19 > "$final_name"

    rm -rf "$temp_dir" "$arch_pkg" "$deb_name"

    local size=$(du -h "$final_name" 2>/dev/null | cut -f1)
    log_info "Done → $(basename "$final_name") ($size)"
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
    echo -e "${MAIN_COLOR} 02Engine DEB → Arch Package Converter${NC}"
    echo -e "${MAIN_COLOR}=================================================${NC}"
    echo -e "${YELLOW}Output directory: $(pwd)/$OUTPUT_DIR${NC}\n"

    check_prerequisites

    local files=()
    while IFS= read -r -d '' f; do files+=("$f"); done < <(get_deb_packages)

    (( ${#files[@]} == 0 )) && { log_warn "No .deb packages found in dist directory"; exit 0; }

    local total=${#files[@]} success=0 fail=0
    log_info "Found $total deb packages. Starting conversion.\n"

    for ((i=0; i<total; i++)); do
        if convert_single_package "${files[$i]}" $((i+1)) "$total"; then
            ((success++))
        else
            ((fail++))
            log_error "Package #$((i+1)) conversion failed"
        fi
        cleanup_cache "$(basename "${files[$i]}")"
        echo
    done

    echo -e "${MAIN_COLOR}=================================================${NC}"
    (( fail == 0 )) && log_step "All conversions completed successfully!" || log_warn "Conversion finished (with failures)"
    log_info "Total: $total   Success: $success   Failed: $fail"
    log_info "Output directory → $(pwd)/$OUTPUT_DIR"
    echo -e "${MAIN_COLOR}=================================================${NC}"

    (( fail > 0 )) && exit 1 || exit 0
}

trap 'echo -e "\n${RED}Interrupted by user. Cleaning up temporary files...${NC}";
      safe_run rm -f *.deb .PKGINFO .INSTALL .MTREE;
      safe_run rm -rf pkg/ src/;
      safe_run rm -f *.pkg.tar.* *.tar.* 2>/dev/null;
      echo -e "${RED}Exited${NC}"; exit 130' INT TERM

main "$@"
