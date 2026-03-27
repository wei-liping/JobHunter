# Resume Template

这个目录提供 JobHunter 的 LaTeX 简历导出模板。

## 用途

- 应用在导出 PDF 时，会读取这里的模板和字体
- 真正导出的正文来自用户简历 Markdown，不使用模板内的示例内容
- 如果机器没有 `xelatex`，系统会自动回退到 jsPDF 导出

## 公开仓库说明

- 这里保留的是通用模板，不包含个人头像、联系方式或现成简历 PDF
- 如需定制样式，可修改 `CV.tex`
- 如需单独测试模板，可直接在本目录运行 `xelatex CV.tex`

## 必要文件

- `CV.tex`：模板入口
- `fonts/`：模板使用的字体
- `fontawesomesymbols-*.tex`：图标定义
