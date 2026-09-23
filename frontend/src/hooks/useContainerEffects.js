import { useEffect, useRef, useState } from 'react'

const isStoppedStatus = (s) => s === 'exited' || s === 'stopped' || s === 'dead'

export default function useContainerEffects(container) {
  const prevRef = useRef(null)
  const [state, setState] = useState({ type: 'none', token: 0 })
  const [restartBump, setRestartBump] = useState(0)

  useEffect(() => {
    const cur = {
      status: container.status,
      exitCode: container.state?.ExitCode,
      oomKilled: !!container.state?.OOMKilled
    }
    const prev = prevRef.current
    let type = 'none'

    if (container.isNew) {
      type = 'ignite'
    } else if (prev) {
      const prevStatus = prev.status
      const curStatus = cur.status

      if (prevStatus !== 'running' && curStatus === 'running') {
        type = 'ignite'
      } else if (
        (prevStatus === 'running' || prevStatus === 'restarting') &&
        isStoppedStatus(curStatus)
      ) {
        type = cur.exitCode !== 0 || cur.oomKilled ? 'explode' : 'fade'
      } else if (curStatus === 'restarting' && prevStatus !== 'restarting') {
        type = 'restart'
      }
    }

    prevRef.current = cur

    setState((s) => (type === 'none' ? s : { type, token: s.token + 1 }))
  }, [container.isNew, container.id, container.status, container.state])

  useEffect(() => {
    if (restartBump > 0) {
      setState((s) => ({ type: 'restart', token: s.token + 1 }))
    }
  }, [restartBump])

  const bumpRestart = () => setRestartBump((b) => b + 1)

  return { effect: state.type, token: state.token, bumpRestart }
}