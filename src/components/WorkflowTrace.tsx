import type { WorkflowBranch, WorkflowNodeState } from '../api/agent'

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

function takenBranchIds(branch?: string | string[]) {
  if (!branch) return []
  return Array.isArray(branch) ? branch : [branch]
}

function NodeBranches({ node }: { node: WorkflowNodeState }) {
  const catalog = node.branches ?? []
  const taken = takenBranchIds(node.branch)
  const extras: WorkflowBranch[] = taken
    .filter((id) => !catalog.some((item) => item.id === id))
    .map((id) => ({ id, label: id }))
  const branches: WorkflowBranch[] = [...catalog, ...extras]
  if (!branches.length) return null

  return (
    <ul className="workflow-branches" aria-label={`${node.title}的分支`}>
      {branches.map((item) => {
        const state =
          node.status === 'running' || !taken.length
            ? 'pending'
            : taken.includes(item.id)
              ? 'taken'
              : 'idle'
        return (
          <li key={item.id} className={`workflow-branch ${state}${item.terminal ? ' terminal' : ''}`}>
            <span className="workflow-branch-arm" aria-hidden="true" />
            <span className="workflow-branch-label">{item.label}</span>
            {state === 'idle' && <em>未走</em>}
            {state === 'taken' && item.terminal && <em>停止</em>}
          </li>
        )
      })}
    </ul>
  )
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
              {!!node.branches?.length && (
                <NodeBranches node={node} />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
