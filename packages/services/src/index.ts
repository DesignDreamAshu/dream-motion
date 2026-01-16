import type { DocumentModel } from '@dream-motion/shared';

export type RenderJob = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  document: DocumentModel;
  output: string | null;
};

export type HostingProject = {
  id: string;
  name: string;
  document: DocumentModel;
  url: string;
};

export const createLocalQueue = () => {
  const jobs: RenderJob[] = [];
  return {
    enqueue: (document: DocumentModel) => {
      const job: RenderJob = {
        id: `job-${Date.now()}`,
        status: 'queued',
        document,
        output: null
      };
      jobs.push(job);
      return job;
    },
    runNext: () => {
      const job = jobs.find((item) => item.status === 'queued');
      if (!job) return null;
      job.status = 'running';
      job.output = 'local-output.mp4';
      job.status = 'completed';
      return job;
    },
    list: () => jobs
  };
};

export const createLocalHosting = () => {
  const projects: HostingProject[] = [];
  return {
    publish: (document: DocumentModel) => {
      const project: HostingProject = {
        id: `proj-${Date.now()}`,
        name: document.name,
        document,
        url: `http://localhost:3000/preview/${document.name}`
      };
      projects.push(project);
      return project;
    },
    list: () => projects
  };
};
