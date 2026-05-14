import { WorkOS } from '@workos-inc/node'
import { getSignInUrl, getSignUpUrl, signOut } from '@workos-inc/authkit-nextjs'

let _workos: WorkOS | null = null

export function getWorkOSClient(): WorkOS {
  if (!_workos) {
    const apiKey = process.env.WORKOS_API_KEY
    if (!apiKey) throw new Error('WORKOS_API_KEY is not set')
    _workos = new WorkOS(apiKey)
  }
  return _workos
}

export { getSignInUrl, getSignUpUrl, signOut }
