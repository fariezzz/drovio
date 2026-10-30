import { Job } from './types';
import { canAccessPrivateJob } from './private-history';

export { canAccessPrivateJob } from './private-history';

export function filterJobsForSession(jobs: Job[], sessionId: string): Job[] {
  return jobs.filter((job) => canAccessPrivateJob(job.ownerSessionId, sessionId));
}

export function getOwnedJob(jobs: Job[], id: string, sessionId: string): Job | undefined {
  const job = jobs.find((candidate) => candidate.id === id);
  return job && canAccessPrivateJob(job.ownerSessionId, sessionId) ? job : undefined;
}

export function toPublicJob(job: Job): Omit<Job, 'ownerSessionId'> {
  const { ownerSessionId: _ownerSessionId, ...publicJob } = job;
  return publicJob;
}

export function toPublicJobs(jobs: Job[]): Array<Omit<Job, 'ownerSessionId'>> {
  return jobs.map(toPublicJob);
}
