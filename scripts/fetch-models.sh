#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-all}"

download_model() {
  local slug="$1"
  local remote_model_file="$2"
  local model_dir="public/models/$slug"
  local model_url="https://huggingface.co/KittenML/$slug/resolve/main/$remote_model_file"
  local voices_url="https://huggingface.co/KittenML/$slug/resolve/main/voices.npz"

  mkdir -p "$model_dir"

  echo "Downloading $slug model.onnx..."
  curl -fL --retry 3 "$model_url" -o "$model_dir/model.onnx"

  echo "Downloading $slug voices.npz..."
  curl -fL --retry 3 "$voices_url" -o "$model_dir/voices.npz"

  echo "Model assets ready for $slug:"
  ls -lah "$model_dir/model.onnx" "$model_dir/voices.npz"
}

case "$TARGET" in
  nano-int8)
    download_model "kitten-tts-nano-0.8-int8" "kitten_tts_nano_v0_8.onnx"
    ;;
  nano)
    download_model "kitten-tts-nano-0.8" "kitten_tts_nano_v0_8.onnx"
    ;;
  micro)
    download_model "kitten-tts-micro-0.8" "kitten_tts_micro_v0_8.onnx"
    ;;
  all)
    download_model "kitten-tts-nano-0.8-int8" "kitten_tts_nano_v0_8.onnx"
    download_model "kitten-tts-nano-0.8" "kitten_tts_nano_v0_8.onnx"
    download_model "kitten-tts-micro-0.8" "kitten_tts_micro_v0_8.onnx"
    ;;
  *)
    echo "Usage: $0 [nano-int8|nano|micro|all]" >&2
    exit 1
    ;;
esac
