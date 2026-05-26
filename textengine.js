export function renderText(ctx, it) {
  const p = it.params;

  const text = p.text ?? "";
  const fontSize = Number(p.fontSize ?? 24);
  const lineHeight = Number(p.lineHeight ?? fontSize * 1.2);
  const letterSpacing = Number(p.letterSpacing ?? 0);

  const fontFamily = p.fontFamily ?? "sans-serif";
  const fontWeight = p.fontWeight ?? 400;
  const color = p.color ?? "#000";
  const opacity = p.opacity ?? 1;
  const align = p.align ?? "left";
  const rotation = (p.rotation ?? 0) * Math.PI / 180;

  ctx.save();

  // position
  ctx.translate(it.x, it.y);
  ctx.rotate(rotation);

  ctx.globalAlpha = opacity;

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";

  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // line width calc
    let lineWidth = 0;
    for (let j = 0; j < line.length; j++) {
      lineWidth += ctx.measureText(line[j]).width;
      if (j < line.length - 1) lineWidth += letterSpacing;
    }

    // align
    let offsetX = 0;
    if (align === "center") offsetX = -lineWidth / 2;
    if (align === "right") offsetX = -lineWidth;

    let x = offsetX;
    const y = i * lineHeight;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + letterSpacing;
    }
  }

  ctx.restore();
}