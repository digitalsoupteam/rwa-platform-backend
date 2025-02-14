import Bull from "bull";

export interface TaskConfig {
  name: string;
  queue: string;
  responseQueue: string;
  handler: (job: Bull.Job) => Promise<any>;
}