#!/usr/bin/env bash
set -euo pipefail

MODEL_DIR="public/models/kitten-tts-nano-0.8-int8"
MODEL_URL="https://huggingface.co/KittenML/kitten-tts-nano-0.8-int8/resolve/main/kitten_tts_nano_v0_8.onnx"
VOICES_URL="https://huggingface.co/KittenML/kitten-tts-nano-0.8-int8/resolve/main/voices.npz"

mkdir -p "$MODEL_DIR"

echo "Downloading model.onnx..."
curl -fL --retry 3 "$MODEL_URL" -o "$MODEL_DIR/model.onnx"

echo "Downloading voices.npz..."
curl -fL --retry 3 "$VOICES_URL" -o "$MODEL_DIR/voices.npz"

echo "Model assets ready:"
ls -lah "$MODEL_DIR/model.onnx" "$MODEL_DIR/voices.npz"
