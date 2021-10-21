import { sendMessage, onMessage } from 'webext-bridge'
import { Tabs, WebRequest } from 'webextension-polyfill'
import { browser } from 'webextension-polyfill-ts'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  // load latest content script
  import('./contentScriptHMR')
}

browser.runtime.onInstalled.addListener((): void => {
  // eslint-disable-next-line no-console
  console.log('Extension installed')
})

let previousTabId = 0

// communication example: send previous tab title from background page
// see shim.d.ts for type declaration
browser.tabs.onActivated.addListener(async({ tabId }) => {
  if (!previousTabId) {
    previousTabId = tabId
    return
  }

  let tab: Tabs.Tab

  try {
    tab = await browser.tabs.get(previousTabId)
    previousTabId = tabId
  }
  catch {
    return
  }

  // eslint-disable-next-line no-console
  console.log('previous tab', tab)
  sendMessage(
    'tab-prev',
    { title: tab.title },
    { context: 'content-script', tabId },
  )
})

onMessage('get-current-tab', async() => {
  try {
    const tab = await browser.tabs.get(previousTabId)
    return {
      title: tab?.id,
    }
  }
  catch {
    return {
      title: undefined,
    }
  }
})

function logURL(requestDetails: WebRequest.OnBeforeRequestDetailsType) {
  console.log(`Loading: ${requestDetails.url}`)
  console.log({ requestDetails })

  const filter = browser.webRequest.filterResponseData(requestDetails.requestId)
  const decoder = new TextDecoder('utf-8')
  const encoder = new TextEncoder()

  filter.ondata = (event) => {
    const str = decoder.decode(event.data, { stream: true })
    filter.write(encoder.encode(str))

    console.log(JSON.parse(str))

    filter.disconnect()
  }

  return {}
}

browser.webRequest.onBeforeRequest.addListener(logURL, {
  urls: ['https://www.lingoda.com/api/users/me'],
}, ['blocking'])
