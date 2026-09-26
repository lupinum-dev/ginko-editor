import type { ConversionIssue, ConversionPhase, ConversionTraceEvent } from './conversionTypes'

interface ConversionTraceHandle {
  traceId: string
  timeline: ConversionTraceEvent[]
}

let traceCounter = 0

function nowIso() {
  return new Date().toISOString()
}

function nextTraceId() {
  traceCounter += 1
  return `conv_${Date.now().toString(36)}_${traceCounter.toString(36)}`
}

export function startTrace(data?: Record<string, unknown>): ConversionTraceHandle {
  const trace: ConversionTraceHandle = {
    traceId: nextTraceId(),
    timeline: [
      {
        at: nowIso(),
        kind: 'start',
        data,
      },
    ],
  }


  return trace
}

export function logPhase(
  trace: ConversionTraceHandle,
  phase: ConversionPhase,
  data?: Record<string, unknown>,
) {
  trace.timeline.push({
    at: nowIso(),
    kind: 'phase',
    phase,
    data,
  })
}

export function logIssue(trace: ConversionTraceHandle, issue: ConversionIssue) {
  trace.timeline.push({
    at: nowIso(),
    kind: 'issue',
    phase: issue.phase,
    issueCode: issue.code,
    message: issue.message,
    severity: issue.severity,
    data: issue.context,
  })

  if (issue.severity === 'error') {
    return
  }

}

export function finishTrace(
  trace: ConversionTraceHandle,
  data?: Record<string, unknown>,
): ConversionTraceEvent[] {
  trace.timeline.push({
    at: nowIso(),
    kind: 'finish',
    data,
  })
  return trace.timeline
}
