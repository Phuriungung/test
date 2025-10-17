# Notify — Quick Ward Note

A tiny, fast web app to compose ward notes with structured V/S and I/O, optimized for keyboard input.

## Features
- Bed/Name header and disease hashtags
- Free-text Clinical (Cli) field
- V/S fields: BT, PR, RR, BP, O2sat
- I/O (เช้า, บ่าย) with dynamic rows for I and O, auto-summed
- I/O รวม auto-calculated with Pos/Neg net
- Live preview, copy-to-clipboard, autosave to localStorage
- Keyboard: Cmd/Ctrl+Enter generate, Cmd/Ctrl+C copy
  
Enhancements:
- Hashtags: multiline input; each non-empty line is auto-prefixed with `#`
- Quick Add: type comma- or newline-separated "kind amount" to rapidly insert I/O rows; press Enter. The parser picks the largest numeric token per phrase as the amount (e.g., `drain 950+ท1` -> amount 950).

## Usage
Just open `index.html` in a browser. On macOS:

- Double-click the file in Finder, or
- Serve the folder with any static server if you prefer.

## Example output
```
กว6/1 รวม3 อัครเดช
#CCA c HCV cirrhosis S/P Rt. hepatectomy
#U/D HT

Cli: ไม่ปวดแผล กินได้ กินนมแล้วคลื่นไส้นิดนึง ไม่แน่นท้อง ไม่ปวดท้อง  ถ่ายแล้วเมื่อเช้า

V/S BT 36.9 PR 74 RR 18 BP 143/75 O2sat 96%

I/O เช้า:
I: 1960 (oral 800, นม 300, ivf 800)
O: 1300+ท1 (urine 600+ท1, Drain 700)
Pos660

I/O บ่าย:
I: 1242 (oral 450, ivf 792)
O: 1180 (urine 200, drain 980)
Pos62

I/O รวม: 3202/2480 (+722)

Mx:
```

## Notes
- Amount parsing is numeric-only (e.g., `980`, `450`). Text like `+ท1` can stay in the kind field (e.g., `urine 600+ท1`). To affect totals, ensure the numeric amount is captured in the amount column (or at the end of the quick-add phrase).
- Hashtags are now multiline; each line is printed with a leading `#`.
