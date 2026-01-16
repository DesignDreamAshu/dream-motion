export type ExportAdapterResult = {
  ok: boolean;
  message: string;
};

export type ExportAdapter = {
  id: string;
  name: string;
  run: (options: Record<string, unknown>) => Promise<ExportAdapterResult>;
};

export const gifAdapter: ExportAdapter = {
  id: 'gif',
  name: 'GIF (stub)',
  async run() {
    return {
      ok: false,
      message: 'GIF export is not implemented in V1.'
    };
  }
};

export const mp4Adapter: ExportAdapter = {
  id: 'mp4',
  name: 'MP4 (stub)',
  async run() {
    return {
      ok: false,
      message: 'MP4 export is not implemented in V1.'
    };
  }
};

export const webmAdapter: ExportAdapter = {
  id: 'webm',
  name: 'WebM (stub)',
  async run() {
    return {
      ok: false,
      message: 'WebM export is not implemented yet.'
    };
  }
};

export const spriteAdapter: ExportAdapter = {
  id: 'sprite',
  name: 'Sprite Sheet (stub)',
  async run() {
    return {
      ok: false,
      message: 'Sprite sheet export is not implemented yet.'
    };
  }
};

export const exportAdapters = [gifAdapter, mp4Adapter, webmAdapter, spriteAdapter];
