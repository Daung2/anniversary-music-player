import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallResult = 'prompted' | 'unavailable' | 'dismissed'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent)
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setStandalone(true)
      setDeferred(null)
    }
    const media = window.matchMedia('(display-mode: standalone)')
    const onChange = () => setStandalone(isStandalone())

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    media.addEventListener('change', onChange)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      media.removeEventListener('change', onChange)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<InstallResult> => {
    if (standalone) return 'unavailable'
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const choice = await deferred.userChoice
    setDeferred(null)
    return choice.outcome === 'accepted' ? 'prompted' : 'dismissed'
  }, [deferred, standalone])

  return {
    canInstall: Boolean(deferred) && !standalone,
    standalone,
    isIos: isIos(),
    promptInstall,
  }
}
