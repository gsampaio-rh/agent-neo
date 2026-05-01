import { describe, it, expect } from 'vitest';
import { truncatePath, OP_ICON, OP_CLASS } from '../constants';

describe('truncatePath', () => {
  it('returns short paths unchanged', () => {
    expect(truncatePath('/tmp/test.py')).toBe('/tmp/test.py');
  });

  it('returns path at exact boundary unchanged', () => {
    const path = 'a'.repeat(28);
    expect(truncatePath(path)).toBe(path);
  });

  it('truncates long paths with ellipsis prefix', () => {
    const path = '/very/long/directory/structure/with/many/segments/file.py';
    const result = truncatePath(path);
    expect(result.length).toBe(28);
    expect(result.startsWith('…')).toBe(true);
    expect(result.endsWith('file.py')).toBe(true);
  });

  it('respects custom maxLen', () => {
    const path = '/tmp/something/file.py';
    const result = truncatePath(path, 10);
    expect(result.length).toBe(10);
    expect(result.startsWith('…')).toBe(true);
  });
});

describe('OP_ICON', () => {
  it('maps all operations', () => {
    expect(OP_ICON.read).toBe('R');
    expect(OP_ICON.write).toBe('W');
    expect(OP_ICON.exec).toBe('X');
  });
});

describe('OP_CLASS', () => {
  it('maps all operations to CSS classes', () => {
    expect(OP_CLASS.read).toContain('read');
    expect(OP_CLASS.write).toContain('write');
    expect(OP_CLASS.exec).toContain('exec');
  });
});
