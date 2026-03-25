name: Build Resume

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]
  workflow_dispatch:

jobs:
  build_latex:
    runs-on: ubuntu-latest
    steps:
      - name: Set up Git repository
        uses: actions/checkout@v4

      - name: Compile LaTeX document
        uses: xu-cheng/latex-action@v3
        with:
          root_file: CV.tex
          latexmk_use_xelatex: true
          # 由于你的字体在本地 fonts 文件夹中，且使用了 Path 参数，通常不需要额外安装字体
          # 如果遇到字体问题，可以在这里配置

      - name: Upload PDF as artifact
        uses: actions/upload-artifact@v4
        with:
          name: CV-PDF
          path: CV.pdf
          if-no-files-found: error
