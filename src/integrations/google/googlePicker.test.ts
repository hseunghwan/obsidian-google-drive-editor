import { describe, expect, it } from 'vitest';

import { parseDriveFolderId } from './googlePicker';

describe('parseDriveFolderId', () => {
  it('extracts folder ids from Drive folder URLs', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/folders/folder_123-ABC?usp=sharing')).toBe(
      'folder_123-ABC'
    );
  });

  it('accepts raw folder ids', () => {
    expect(parseDriveFolderId('folder_123-ABC')).toBe('folder_123-ABC');
  });

  it('rejects empty or unsupported values', () => {
    expect(parseDriveFolderId('')).toBeNull();
    expect(parseDriveFolderId('not a folder id')).toBeNull();
  });
});
