.PHONY := all clean
SRC_DIR := flathub mac windows
PNG_FILES := $(foreach dir,$(SRC_DIR),$(wildcard $(dir)/*.png))
WEBP_FILES := $(PNG_FILES:.png=.webp)

all: $(WEBP_FILES)

clean:
	rm -f $(WEBP_FILES)

%.webp: %.png
	optipng -o7 "$<"
	cwebp -lossless -z 9 -mt "$<" -o "$@"
