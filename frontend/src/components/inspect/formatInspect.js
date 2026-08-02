function pickState(attrs) {
  return attrs?.State || {}
}

function pickConfig(attrs) {
  return attrs?.Config || {}
}

function pickHostConfig(attrs) {
  return attrs?.HostConfig || {}
}

function pickNetworkSettings(attrs) {
  return attrs?.NetworkSettings || {}
}

function pickLabels(attrs) {
  return (attrs && attrs.Config && attrs.Config.Labels) || (attrs && attrs.Labels) || {}
}

export function formatHealth(attrs) {
  const state = pickState(attrs)
  const health = state.Health && state.Health.Status

  if (state.OOMKilled) {
    return { label: 'OOM Killed', tone: 'critical' }
  }
  if (state.Restarting) {
    return { label: 'Restarting', tone: 'warn' }
  }
  if (state.Status === 'exited') {
    const code = state.ExitCode
    const tone = code === 0 ? 'neutral' : 'critical'
    return { label: `Exited (${code})`, tone }
  }
  if (state.Status === 'dead') {
    return { label: 'Dead', tone: 'critical' }
  }
  if (state.Status === 'created') {
    return { label: 'Created', tone: 'neutral' }
  }
  if (state.Status === 'paused') {
    return { label: 'Paused', tone: 'warn' }
  }
  if (state.Status === 'running' && health === 'unhealthy') {
    return { label: 'Unhealthy', tone: 'warn' }
  }
  if (state.Status === 'running') {
    return { label: health === 'healthy' ? 'Healthy' : 'Running', tone: 'ok' }
  }
  return { label: state.Status || 'Unknown', tone: 'neutral' }
}

export function formatUptime(attrs) {
  const state = pickState(attrs)
  if (!state.StartedAt) return null
  const started = new Date(state.StartedAt)
  if (isNaN(started.getTime())) return null
  const now = Date.now()
  let diff = Math.max(0, Math.floor((now - started.getTime()) / 1000))
  const days = Math.floor(diff / 86400); diff -= days * 86400
  const hours = Math.floor(diff / 3600); diff -= hours * 3600
  const mins = Math.floor(diff / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function extractCompose(attrs) {
  const labels = pickLabels(attrs)
  const project = labels['com.docker.compose.project']
  const service = labels['com.docker.compose.service']
  const number = labels['com.docker.compose.container-number']
  if (!project && !service && !number) return null
  return {
    project: project || null,
    service: service || null,
    containerNumber: number !== undefined ? number : null,
  }
}

export function extractNetworks(attrs) {
  const ns = pickNetworkSettings(attrs)
  const networks = ns.Networks || {}
  return Object.entries(networks).map(([name, info]) => ({
    name,
    ip: info && info.IPAddress ? info.IPAddress : '',
    gateway: info && info.Gateway ? info.Gateway : '',
    mac: info && info.MacAddress ? info.MacAddress : '',
  }))
}

export function extractPorts(attrs) {
  const ns = pickNetworkSettings(attrs)
  const ports = ns.Ports || {}
  const out = []
  Object.entries(ports).forEach(([containerPort, bindings]) => {
    const [port, proto = 'tcp'] = containerPort.split('/')
    if (!bindings || bindings.length === 0) {
      out.push({ host: '', container: port, protocol: proto, ip: '' })
      return
    }
    bindings.forEach((b) => {
      out.push({ host: b.HostPort || '', container: port, protocol: proto, ip: b.HostIp || '' })
    })
  })
  return out
}

export function extractCommand(attrs) {
  const cfg = pickConfig(attrs)
  const parts = []
  if (cfg.Entrypoint && cfg.Entrypoint.length) parts.push(cfg.Entrypoint.join(' '))
  if (cfg.Cmd && cfg.Cmd.length) parts.push(cfg.Cmd.join(' '))
  const full = parts.join(' ').trim()
  if (!full) return ''
  return full.length > 80 ? full.slice(0, 77) + '…' : full
}

export function extractRiskFlags(attrs) {
  const host = pickHostConfig(attrs)
  const cfg = pickConfig(attrs)
  return {
    privileged: !!host.Privileged,
    init: !!host.Init,
    readonlyRootfs: !!host.ReadonlyRootfs,
    user: cfg.User || '',
  }
}
