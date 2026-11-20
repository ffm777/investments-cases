// The previous worksheet placed the terminal value in B40. D40 was protected and empty.
const cellOrRange = /(?<![A-Z0-9_$.])(\$?[A-D]\$?[1-9]\d*)(?:\s*:\s*(\$?[A-D]\$?[1-9]\d*))?(?![A-Z0-9_])/gi;

function swapTerminalAddress(address) {
  return address.replace(/^([\$]?)([BD])(\$?40)$/i, (_, columnLock, column, row) =>
    columnLock + (column.toUpperCase() === 'B' ? 'D' : 'B') + row);
}

function bounds(address) {
  const [, lockCol, column, lockRow, row] = /^(\$?)([A-D])(\$?)(\d+)$/i.exec(address);
  return { col:column.toUpperCase().charCodeAt(0), row:Number(row), lockCol, lockRow };
}

function migrateRange(original, first, last) {
  const a = bounds(first), b = bounds(last);
  const top = Math.min(a.row,b.row), bottom = Math.max(a.row,b.row);
  if (top > 40 || bottom < 40) return original;
  const left = Math.min(a.col,b.col), right = Math.max(a.col,b.col);
  const oldCol = 'B'.charCodeAt(0), newCol = 'D'.charCodeAt(0);
  const includesOld = left <= oldCol && oldCol <= right;
  const includesNew = left <= newCol && newCol <= right;
  if (includesOld === includesNew) return original;
  if (top === bottom && left === right) {
    return swapTerminalAddress(first) + ':' + swapTerminalAddress(last);
  }
  // Supported range functions aggregate numeric cells. Partition a partially affected
  // rectangle into disjoint arguments so a range keeps exactly the values it covered.
  const moved = includesOld ? oldCol : newCol;
  const pieces = [];
  function address(col,row) {
    const lockCol = col===a.col ? a.lockCol : col===b.col ? b.lockCol : a.lockCol && b.lockCol;
    const lockRow = row===a.row ? a.lockRow : row===b.row ? b.lockRow : a.lockRow && b.lockRow;
    return lockCol + String.fromCharCode(col) + lockRow + row;
  }
  function rectangle(x1,y1,x2,y2) {
    if(x1>x2 || y1>y2)return;
    const start=address(x1,y1), end=address(x2,y2);
    pieces.push(start===end ? start : start+':'+end);
  }
  rectangle(left,top,right,39);
  rectangle(left,40,moved-1,40);
  pieces.push(swapTerminalAddress(address(moved,40)));
  rectangle(moved+1,40,right,40);
  rectangle(left,41,right,bottom);
  return pieces.join(';');
}

export function migrateWorksheet(raw) {
  const migrated = {};
  for (const [address,value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;
    const target = swapTerminalAddress(address);
    migrated[target] = value.trimStart().startsWith('=') ? value.replace(cellOrRange,
      (original,first,last) => last ? migrateRange(original,first,last) : swapTerminalAddress(first)
    ) : value;
  }
  return migrated;
}
