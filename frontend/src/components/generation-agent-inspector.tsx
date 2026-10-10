'use client';
import { useEffect } from 'react';
import {
  BrainCircuit,
  LayoutList,
  Shapes,
  ListChecks,
  ShieldCheck,
  LoaderCircle,
  Check,
  CircleX,
  Clock,
} from 'lucide-react';
import type { GenerationJob, GenerationAgentTask } from '@wonderlab/shared';
import { Loading, ErrorState, ProgressBar, useApi } from './ui';

const roles = {
  ANALYST: { name: 'Content analysis', Icon: BrainCircuit },
  PLANNER: { name: 'Lesson planning', Icon: LayoutList },
  SCENE_SPECIALIST: { name: 'Interactive content', Icon: Shapes },
  QUIZ_SPECIALIST: { name: 'Quiz creation', Icon: ListChecks },
  VALIDATOR: { name: 'Validation & assembly', Icon: ShieldCheck },
};
const statuses: Record<GenerationAgentTask['status'], string> = {
  PENDING: 'Waiting',
  PROCESSING: 'Working',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};
export function GenerationAgentInspector({ jobId }: { jobId: string }) {
  const { data, error, loading, reload } = useApi<GenerationJob>(
    '/generation-jobs/' + encodeURIComponent(jobId),
  );
  useEffect(() => {
    if (data?.status !== 'PENDING' && data?.status !== 'PROCESSING') return;
    const timer = window.setInterval(() => void reload(), 2000);
    return () => window.clearInterval(timer);
  }, [data?.status, reload]);
  if (loading && !data) return <Loading label="Loading agent tasks…" />;
  if (!data) return <ErrorState message={error} retry={() => void reload()} />;
  return (
    <section className="generation-agent-inspector" aria-label="Generation agent tasks">
      <div className="agent-inspector-heading">
        <h3>Generation team</h3>
        <span>{data.attempt ? `Attempt ${data.attempt}` : 'Waiting for worker'}</span>
      </div>
      <div className="agent-job-progress">
        <span role="status">{data.step}</span>
        <strong>{data.progress}%</strong>
      </div>
      <ProgressBar value={data.progress} />
      <p className="agent-inspector-note">
        Content and quiz specialists can work in parallel. The lesson is published after validation.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {data.agents.length === 0 ? (
        <p className="agent-empty">
          {data.status === 'PENDING'
            ? 'Agent tasks appear when a worker starts this job.'
            : 'No agent task records are available for this job. Older jobs used the previous generation pipeline.'}
        </p>
      ) : (
        <ol className="agent-task-list">
          {data.agents.map((task) => {
            const { Icon, name } = roles[task.role];
            return (
              <li key={task.id} className={'agent-task ' + task.status.toLowerCase()}>
                <div className="agent-task-heading">
                  <span className="agent-role-icon">
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong>{name}</strong>
                    <small>{task.name}</small>
                  </div>
                  <span className={'agent-task-status ' + task.status.toLowerCase()}>
                    {task.status === 'PROCESSING' ? (
                      <LoaderCircle className="spin" size={13} />
                    ) : task.status === 'COMPLETED' ? (
                      <Check size={13} />
                    ) : task.status === 'FAILED' ? (
                      <CircleX size={13} />
                    ) : (
                      <Clock size={13} />
                    )}
                    {statuses[task.status]}
                  </span>
                </div>
                <p>{task.step}</p>
                <ProgressBar value={task.progress} />
                <div className="agent-task-usage">
                  <span>
                    {task.provider}
                    {task.model ? ' · ' + task.model : ''}
                  </span>
                  {task.provider === 'codex' ? (
                    <span>Session token and cost usage not reported</span>
                  ) : (
                    <>
                      <span>
                        {task.tokensInput.toLocaleString()} in /{' '}
                        {task.tokensOutput.toLocaleString()} out
                      </span>
                      <span>${Number(task.estimatedCost).toFixed(5)}</span>
                    </>
                  )}
                </div>
                {task.errorMessage && <p className="inline-error">{task.errorMessage}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
