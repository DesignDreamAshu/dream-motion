import type { DocumentModel } from '@dream-motion/shared';

export type MigrationResult = {
  from: number;
  to: number;
  document: DocumentModel;
};

export const migrate = (doc: DocumentModel): MigrationResult => {
  return { from: doc.version, to: doc.version, document: doc };
};
