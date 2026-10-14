import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { AuthProvider, useAuth } from '../contexts/AuthContext'

const mocks = vi.hoisted(() => ({
  functionResult: { data: null as null | { deleted: boolean; userId: string }, error: null as null | { message: string } },
  signOutCalls: 0,
  tableCalls: 0,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      getUser: async () => ({ data: { user: { id: 'account-a' } }, error: null }),
      signOut: async () => { mocks.signOutCalls++; return { error: null } },
    },
    functions: { invoke: async () => mocks.functionResult },
    from: () => { mocks.tableCalls++; return {} },
  },
}))

let tree: ReactTestRenderer | undefined
let auth: ReturnType<typeof useAuth>
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => { mocks.functionResult = { data: null, error: null }; mocks.signOutCalls = 0; mocks.tableCalls = 0 })
afterEach(async () => { if (tree) await act(async () => { tree?.unmount() }); tree = undefined })

async function mount() {
  function Probe() { auth = useAuth(); return null }
  await act(async () => { tree = create(<AuthProvider><Probe /></AuthProvider>) })
}

describe('account deletion confirmation', () => {
  it('does not report success or sign out when the server function fails', async () => {
    await mount()
    mocks.functionResult = { data: null, error: { message: 'unavailable' } }
    const result = await auth.deleteAccount()
    expect(result.error).toContain('unavailable')
    expect(mocks.signOutCalls).toBe(0)
    expect(mocks.tableCalls).toBe(0)
  })
  it('requires an explicit matching server confirmation', async () => {
    await mount()
    mocks.functionResult = { data: { deleted: true, userId: 'another-user' }, error: null }
    const result = await auth.deleteAccount()
    expect(result.error).toBeTruthy()
    expect(mocks.signOutCalls).toBe(0)
  })
  it('signs out only after a matching confirmation', async () => {
    await mount()
    mocks.functionResult = { data: { deleted: true, userId: 'account-a' }, error: null }
    const result = await auth.deleteAccount()
    expect(result).toEqual({})
    expect(mocks.signOutCalls).toBe(1)
  })
})
