import type { DocumentModel } from '@dream-motion/shared';

export type PluginContext = {
  name: string;
  version: string;
};

export type ImporterPlugin = {
  id: string;
  name: string;
  run: (input: string) => Promise<DocumentModel>;
};

export type ExporterPlugin = {
  id: string;
  name: string;
  run: (doc: DocumentModel) => Promise<Uint8Array>;
};

export type PropertyPlugin = {
  id: string;
  name: string;
  apply: (doc: DocumentModel) => DocumentModel;
};

export type DreamMotionPlugin = {
  id: string;
  name: string;
  version: string;
  importers?: ImporterPlugin[];
  exporters?: ExporterPlugin[];
  properties?: PropertyPlugin[];
};

const registry = new Map<string, DreamMotionPlugin>();

export const registerPlugin = (plugin: DreamMotionPlugin) => {
  registry.set(plugin.id, plugin);
};

export const listPlugins = () => Array.from(registry.values());

export const runImporter = async (id: string, input: string) => {
  const plugin = registry.get(id);
  const importer = plugin?.importers?.[0];
  if (!importer) throw new Error('Importer not found');
  return importer.run(input);
};

export const runExporter = async (id: string, doc: DocumentModel) => {
  const plugin = registry.get(id);
  const exporter = plugin?.exporters?.[0];
  if (!exporter) throw new Error('Exporter not found');
  return exporter.run(doc);
};
