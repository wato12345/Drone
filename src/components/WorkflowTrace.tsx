import type { WorkflowNodeState } from '../api/agent'

interface WorkflowTraceProps {
  nodes: WorkflowNodeState[]
  status: 'running' | 'succeeded' | 'failed'
  elapsedMs?: number
}

function formatElapsed(ms?: number) {
  if (!Number.isFinite(ms)) return ''
  if ((ms ?? 0) < 1000) return `${Math.max(1, Math.round(ms ?? 0))} ms`
  return `${((ms ?? 0) / 1000).toFixed(1)} s`
}

export function WorkflowTrace({ nodes, status, elapsedMs }: WorkflowTraceProps) {
  const statusLabel = status === 'running' ? '运行中' : status === 'failed' ? '失败' : '已完成'

  return (
    <div className={`workflow-trace ${status}`}>
      <div className="workflow-trace-header">
        <strong>工作流</strong>
        <span>
          {statusLabel}
          {elapsedMs ? ` · ${formatElapsed(elapsedMs)}` : ''}
        </span>
      </div>
      <ol className="workflow-nodes">
        {nodes.map((node, index) => (
          <li key={node.id} className={`workflow-node ${node.status} type-${node.nodeType}`}>
            {index < nodes.length - 1 && <span className="workflow-node-line" />}
            <span className="workflow-node-mark" aria-hidden="true" />
            <div className="workflow-node-body">
              <div className="workflow-node-title">
                <b>{node.title}</b>
                <em>{node.status === 'running' ? '运行中' : formatElapsed(node.nodeElapsedMs)}</em>
              </div>
              {node.detail && <p>{node.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
