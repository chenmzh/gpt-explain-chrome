export function rectanglesOverlap(a, b, gap = 0) {
  return a.left < b.left + b.width + gap
    && a.left + a.width + gap > b.left
    && a.top < b.top + b.height + gap
    && a.top + a.height + gap > b.top;
}

function containsPoint(bounds, point) {
  return point.x >= bounds.left && point.x < bounds.left + bounds.width
    && point.y >= bounds.top && point.y < bounds.top + bounds.height;
}

export function choosePopupPlacement({
  displays,
  occupied,
  reference,
  width,
  height,
  gap = 14,
  margin = 14
}) {
  const referencePoint = {
    x: (reference?.left || 0) + (reference?.width || width) / 2,
    y: (reference?.top || 0) + (reference?.height || height) / 2
  };
  const orderedDisplays = [...displays].sort((a, b) => {
    const aContains = containsPoint(a.workArea, referencePoint) ? 0 : 1;
    const bContains = containsPoint(b.workArea, referencePoint) ? 0 : 1;
    return aContains - bContains;
  });

  const candidates = [];
  for (const display of orderedDisplays) {
    const area = display.workArea;
    for (let top = area.top + margin; top + height <= area.top + area.height - margin; top += height + gap) {
      for (let left = area.left + area.width - width - margin;
        left >= area.left + margin;
        left -= width + gap) {
        candidates.push({ left: Math.round(left), top: Math.round(top), width, height });
      }
    }
  }

  return candidates.find((candidate) => (
    occupied.every((windowBounds) => !rectanglesOverlap(candidate, windowBounds, gap))
  )) || candidates[0] || {
    left: Math.round(reference?.left || 80),
    top: Math.round(reference?.top || 80),
    width,
    height
  };
}
