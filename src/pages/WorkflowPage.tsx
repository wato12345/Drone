import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchWorkflow,
  readStoredWorkflow,
  saveWorkflow,
  writeStoredWorkflow,
  type WorkflowBranchDef,
  type WorkflowDefinition,
  type WorkflowNodeDef,
} from '../api/workflow'
import { useAuth } from '../context/AuthContext'

const LANE_IDS = ['resolve_place', 'get_weather', 'check_airspace', 'plan_route', 'answer'] as const

const NODE_KIND: Record<string, string> = {
  start: '开始',
  llm: '编排',
  resolve_place: '工具',
  get_weather: '工具',
  check_airspace: '工具',
  plan_route: '工具',
  answer: '回复',
}

function edgeLabel(workflow: WorkflowDefinition, id: string) {
  return workflow.nodes.llm.branches?.find((branch) => branch.id === id)?.label ?? workflow.nodes[id]?.title ?? id
}

export default function WorkflowPage() {
  const { user } = useAuth()
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null)
  const [selectedId, setSelectedId] = useState('llm')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoadError('')
    fetchWorkflow()
      .then((remote) => {
        if (cancelled) return
        if (user && remote.saved) writeStoredWorkflow(remote.workflow)
        const stored = user && remote.saved ? null : readStoredWorkflow()
        setWorkflow(stored ?? remote.workflow)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const stored = readStoredWorkflow()
        if (stored) setWorkflow(stored)
        else setLoadError(err instanceof Error ? err.message : '无法加载工作流')
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const selected = workflow?.nodes[selectedId]

  const updateNode = (id: string, patch: Partial<WorkflowNodeDef>) => {
    setWorkflow((current) => {
      if (!current) return current
      const nodes = {
        ...current.nodes,
        [id]: { ...current.nodes[id], ...patch },
      }
      if (typeof patch.title === 'string' && nodes.llm.branches) {
        nodes.llm = {
          ...nodes.llm,
          branches: nodes.llm.branches.map((branch) =>
            branch.id === id ? { ...branch, label: patch.title ?? branch.label } : branch,
          ),
        }
      }
      return { ...current, nodes }
    })
    setStatus('')
  }

  const updateBranch = (nodeId: string, branchId: string, patch: Partial<WorkflowBranchDef>) => {
    setWorkflow((current) => {
      if (!current) return current
      const node = current.nodes[nodeId]
      return {
        ...current,
        nodes: {
          ...current.nodes,
          [nodeId]: {
            ...node,
            branches: node.branches?.map((branch) =>
              branch.id === branchId ? { ...branch, ...patch } : branch,
            ),
          },
        },
      }
    })
    setStatus('')
  }

  const save = async () => {
    if (!workflow) return
    setSaving(true)
    setStatus('')
    try {
      if (user) {
        const saved = await saveWorkflow(workflow)
        writeStoredWorkflow(saved.workflow)
        setWorkflow(saved.workflow)
        setStatus('已保存到账号，规划页助手会按这份配置运行。')
      } else {
        writeStoredWorkflow(workflow)
        setStatus('已保存在这台浏览器。登录后可以同步到账号。')
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    setSaving(true)
    setStatus('')
    try {
      const fresh = await fetchWorkflow({ fresh: true })
      setWorkflow(fresh.workflow)
      setSelectedId('llm')
      setStatus('已恢复默认，尚未保存。')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '恢复失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-main workflow-page">
      <section className="page-hero page-hero-compact">
        <p className="page-eyebrow">Workflow Console</p>
        <h1>飞行助手工作流</h1>
        <p className="page-lead">
          点选节点修改名称、开关工具，以及每条分支是停止回复还是回到编排。保存后，规划页里的助手按这份图运行。
        </p>
      </section>

      {loadError && !workflow ? <p className="wf-status">{loadError}</p> : null}

      {workflow && (
        <>
          <div className="wf-toolbar">
            <label>
              工作流名称
              <input
                value={workflow.name}
                maxLength={40}
                onChange={(event) => {
                  setWorkflow({ ...workflow, name: event.target.value })
                  setStatus('')
                }}
              />
            </label>
            <button type="button" className="btn btn-primary wf-save" onClick={save} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
            <button type="button" className="btn" onClick={reset} disabled={saving}>
              恢复默认
            </button>
            <Link to="/planner" className="btn">
              去规划页试用
            </Link>
          </div>
          {status ? <p className="wf-status">{status}</p> : null}

          <div className="wf-studio">
            <section className="page-card wf-canvas" aria-label="工作流流程图">
              <FlowNode
                id="start"
                workflow={workflow}
                selected={selectedId === 'start'}
                onSelect={setSelectedId}
              />
              <span className="wf-stem" aria-hidden="true" />
              <FlowNode
                id="llm"
                workflow={workflow}
                selected={selectedId === 'llm'}
                onSelect={setSelectedId}
              />
              <span className="wf-stem" aria-hidden="true" />
              <div className="wf-lanes">
                {LANE_IDS.map((id) => {
                  const node = workflow.nodes[id]
                  if (!node) return null
                  return (
                    <div key={id} className="wf-lane">
                      <span className="wf-edge">{edgeLabel(workflow, id)}</span>
                      <FlowNode
                        id={id}
                        workflow={workflow}
                        selected={selectedId === id}
                        onSelect={setSelectedId}
                      />
                      {node.branches && node.branches.length > 0 && (
                        <ul className="wf-outcomes">
                          {node.branches.map((branch) => (
                            <li key={branch.id}>
                              <button
                                type="button"
                                className={`wf-outcome ${branch.terminal ? 'stop' : 'loop'}`}
                                onClick={() => setSelectedId(id)}
                              >
                                <span>{branch.label}</span>
                                <em>{branch.terminal ? '停止' : '回编排'}</em>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            <aside className="page-card wf-inspector">
              <h2>节点设置</h2>
              {selected ? (
                <NodeInspector
                  id={selectedId}
                  node={selected}
                  onNode={updateNode}
                  onBranch={updateBranch}
                />
              ) : (
                <p>选择流程图中的节点。</p>
              )}
            </aside>
          </div>
        </>
      )}
    </main>
  )
}

function FlowNode({
  id,
  workflow,
  selected,
  onSelect,
}: {
  id: string
  workflow: WorkflowDefinition
  selected: boolean
  onSelect: (id: string) => void
}) {
  const node = workflow.nodes[id]
  const disabled = node.enabled === false
  return (
    <button
      type="button"
      className={`wf-node${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
      onClick={() => onSelect(id)}
    >
      <small>{NODE_KIND[id] ?? node.type}</small>
      <strong>{node.title}</strong>
      {disabled ? <em>已关闭</em> : null}
    </button>
  )
}

function NodeInspector({
  id,
  node,
  onNode,
  onBranch,
}: {
  id: string
  node: WorkflowNodeDef
  onNode: (id: string, patch: Partial<WorkflowNodeDef>) => void
  onBranch: (nodeId: string, branchId: string, patch: Partial<WorkflowBranchDef>) => void
}) {
  const isTool = node.type === 'tool'
  return (
    <div className="wf-form">
      <label>
        标题
        <input value={node.title} maxLength={24} onChange={(event) => onNode(id, { title: event.target.value })} />
      </label>
      {isTool && (
        <label className="wf-check">
          <input
            type="checkbox"
            checked={node.enabled !== false}
            onChange={(event) => onNode(id, { enabled: event.target.checked })}
          />
          启用这个工具
        </label>
      )}
      {node.branches && node.branches.length > 0 && id !== 'llm' && (
        <fieldset>
          <legend>分支</legend>
          {node.branches.map((branch) => (
            <div key={branch.id} className="wf-branch-edit">
              <label>
                名称
                <input
                  value={branch.label}
                  maxLength={16}
                  onChange={(event) => onBranch(id, branch.id, { label: event.target.value })}
                />
              </label>
              <label>
                走向
                <select
                  value={branch.terminal ? 'stop' : 'loop'}
                  onChange={(event) => onBranch(id, branch.id, { terminal: event.target.value === 'stop' })}
                >
                  <option value="loop">回到编排</option>
                  <option value="stop">停止并回复</option>
                </select>
              </label>
            </div>
          ))}
        </fieldset>
      )}
      {id === 'llm' && (
        <p className="page-muted">编排的出口对应当前启用的工具。关闭某个工具后，这条出口不会再被调用。</p>
      )}
    </div>
  )
}
