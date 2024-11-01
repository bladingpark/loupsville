// ==UserScript==
// @name         LoupsVille
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  wolvesville mod
// @author       me
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wolvesville.com
// @match        *://*.wolvesville.com/*
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

// Global state
var VERSION = GM_info.script.version
var AUTHTOKENS = {
  idToken: '',
  refreshToken: '',
  'Cf-JWT': '',
}
var PLAYER = undefined
var INVENTORY = undefined
var HISTORY = []
var PLAYERS = []
var ROLE = undefined
var GAME_STATUS = undefined
var IS_CONSOLE_OPEN = false
var GOLD_WHEEL_SPINS_COUNTER = 0
var GOLD_WHEEL_SILVER_SESSION = 0
var TOTAL_XP_SESSION = 0
var TOTAL_UP_LEVEL = 0
var GAME_STARTED_AT = 0
var DOCUMENT_TITLE = undefined
var LV_SETTINGS = {
  HIDE_USERNAME: false,
  ALLOW_MULTI: true,
  DEBUG_MODE: false,
  SHOW_HIDDEN_LVL: true,
  AUTO_REPLAY: false,
}
var AUTO_REPLAY_INTERVAL = undefined

const main = async () => {
  getAuthtokens()
  loadSettings()
  patchLocalStorage()
  injectChat()
  injectSettings()
  injectStyles()
  setInterval(injectChat, 1000)
  fetchInterceptor()
  socketInterceptor(onMessage)
  setInterval(setChatState, 1000)
  setInterval(setDocumentTitle, 1000)
}

const injectSettings = () => {
  $('html').append(lvModal)
  $('.lv-modal-close').on('click', () => {
    $('.lv-modal-popup-container').css({ display: 'none' })
  })
  $('.lv-modal-veil').on('click', () => {
    $('.lv-modal-popup-container').css({ display: 'none' })
  })
  $('.lv-modal-rose-wheel-btn').on('click', () => {
    fetch('https://core.api-wolvesville.com/rewards/goldenWheelSpin', {
      method: 'POST',
      headers: getHeaders(),
    })
  })
  $('.lv-modal-gold-wheel-btn').on('click', () => {
    fetch(`https://core.api-wolvesville.com/rewards/wheelRewardWithSecret/${getRewardSecret()}`, {
      method: 'POST',
      headers: getHeaders(),
    })
  })
  $('.lv-modal-loot-boxes-btn').on('click', () => {
    if (INVENTORY.lootBoxes?.length) lootBox()
  })
  $('.lv-modal-checkbox.hide-player').on('click', () => {
    LV_SETTINGS.HIDE_USERNAME = !LV_SETTINGS.HIDE_USERNAME
    $('.lv-modal-checkbox.hide-player').text(LV_SETTINGS.HIDE_USERNAME ? '' : '')
    saveSetting()
  })
  $('.lv-modal-checkbox.allow-multi').on('click', () => {
    LV_SETTINGS.ALLOW_MULTI = !LV_SETTINGS.ALLOW_MULTI
    $('.lv-modal-checkbox.allow-multi').text(LV_SETTINGS.ALLOW_MULTI ? '' : '')
    saveSetting()
  })
  $('.lv-modal-checkbox.debug').on('click', () => {
    LV_SETTINGS.DEBUG_MODE = !LV_SETTINGS.DEBUG_MODE
    $('.lv-modal-checkbox.debug').text(LV_SETTINGS.DEBUG_MODE ? '' : '')
    saveSetting()
  })
  $('.lv-modal-checkbox.show-hidden-lvl').on('click', () => {
    LV_SETTINGS.SHOW_HIDDEN_LVL = !LV_SETTINGS.SHOW_HIDDEN_LVL
    $('.lv-modal-checkbox.show-hidden-lvl').text(LV_SETTINGS.SHOW_HIDDEN_LVL ? '' : '')
    saveSetting()
  })
  $('.lv-modal-checkbox.auto-replay').on('click', () => {
    LV_SETTINGS.AUTO_REPLAY = !LV_SETTINGS.AUTO_REPLAY
    $('.lv-modal-checkbox.auto-replay').text(LV_SETTINGS.AUTO_REPLAY ? '' : '')
    handleAutoReplay()
    saveSetting()
  })
  $('.lv-modal-checkbox.hide-player').text(LV_SETTINGS.HIDE_USERNAME ? '' : '')
  $('.lv-modal-checkbox.allow-multi').text(LV_SETTINGS.ALLOW_MULTI ? '' : '')
  $('.lv-modal-checkbox.debug').text(LV_SETTINGS.DEBUG_MODE ? '' : '')
  $('.lv-modal-checkbox.show-hidden-lvl').text(LV_SETTINGS.SHOW_HIDDEN_LVL ? '' : '')
  $('.lv-modal-checkbox.auto-replay').text(LV_SETTINGS.AUTO_REPLAY ? '' : '')
  handleAutoReplay()
}

const handleAutoReplay = () => {
  if (LV_SETTINGS.AUTO_REPLAY) {
    AUTO_REPLAY_INTERVAL = setInterval(() => {
      $('div:contains("Rejouer")').click()
      $('div:contains("Continuer")').click()
      $('div:contains("Play again")').click()
      $('div:contains("Continue")').click()
    }, 500)
  } else {
    clearInterval(AUTO_REPLAY_INTERVAL)
  }
}

const saveSetting = () => {
  let settings = {
    HIDE_USERNAME: LV_SETTINGS.HIDE_USERNAME,
    ALLOW_MULTI: LV_SETTINGS.ALLOW_MULTI,
    DEBUG_MODE: LV_SETTINGS.DEBUG_MODE,
    SHOW_HIDDEN_LVL: LV_SETTINGS.SHOW_HIDDEN_LVL,
    AUTO_REPLAY: LV_SETTINGS.AUTO_REPLAY,
  }
  localStorage.setItem('lv-settings', JSON.stringify(settings))
}

const log = (m) => {
  if (LV_SETTINGS.DEBUG_MODE) console.log(m)
}

const loadSettings = () => {
  const settings = localStorage.getItem('lv-settings')
  if (settings) {
    LV_SETTINGS = JSON.parse(settings)
  } else {
    saveSetting()
  }
  log(LV_SETTINGS)
}

const delay = (time = 500) =>
  new Promise((r) => {
    setTimeout(r, time)
  })

const lootBox = async (c = 0) => {
  if (c === 40) {
    addChatMsg(`⏳ wait 1 min before opening again`)
    await delay(1000 * 60 * 1)
    c = 0
  }
  await fetch(`https://core.api-wolvesville.com/inventory/lootBoxes/${INVENTORY.lootBoxes[0].id}`, {
    method: 'POST',
    headers: getHeaders(),
  }).then((rep) => {
    if (rep.status === 200) {
      INVENTORY.lootBoxes.shift()
      $('.lv-modal-loot-boxes-status').text(`(${INVENTORY.lootBoxes.length} 🎁 available)`)
      if (INVENTORY.lootBoxes.length) {
        return lootBox(c + 1)
      }
    }
  })
}

const setDocumentTitle = () => {
  document.title = DOCUMENT_TITLE || `🔥 LoupsVille v${VERSION}`
}

const setRole = (id) => {
  ROLE = JSON.parse(localStorage.getItem('roles-meta-data')).roles[id]
}

const getAuthtokens = () => {
  const authtokens = JSON.parse(localStorage.getItem('authtokens'))
  log(authtokens)
  if (authtokens) {
    AUTHTOKENS.idToken = authtokens.idToken || ''
    AUTHTOKENS.refreshToken = authtokens.refreshToken || ''
  }
}

const requestsToCatch = {
  'https://auth.api-wolvesville.com/players/signUpWithEmailAndPassword': (data) => {
    if (data?.idToken) {
      AUTHTOKENS.idToken = data.idToken
      AUTHTOKENS.refreshToken = data.refreshToken
    }
  },
  'https://auth.api-wolvesville.com/players/createIdToken': (data) => {
    if (data?.idToken) {
      AUTHTOKENS.idToken = data.idToken
      AUTHTOKENS.refreshToken = data.refreshToken
    }
  },
  'https://auth.api-wolvesville.com/cloudflareTurnstile/verify': (data) => {
    if (data?.jwt) {
      AUTHTOKENS['Cf-JWT'] = data.jwt || ''
      addChatMsg('🛡️ Cloudflare token intercepted')
    }
  },
  'https://core.api-wolvesville.com/players/meAndCheckAppVersion': (data) => {
    if (data?.player) {
      const { username, level } = data.player
      !PLAYER &&
        addChatMsg(
          `👋 ${LV_SETTINGS.HIDE_USERNAME ? '???' : username} (lvl ${LV_SETTINGS.HIDE_USERNAME ? '?' : level})`
        )
      PLAYER = data.player
      if (LV_SETTINGS.HIDE_USERNAME) {
        data.player.username = '???'
        data.player.clanTag = '❓'
        data.player.level = 10000
        data.player.xpTotal = 0
        return new Response(JSON.stringify(data))
      }
    }
  },
  'https://core.api-wolvesville.com/inventory/lootBoxes/': (data) => {
    if (data?.items?.length) {
      let silver = 0
      let loots = []
      data.items.forEach((item) => {
        loots.push(item.type)
        if (item.duplicateItemCompensationInSilver) {
          silver += item.duplicateItemCompensationInSilver
        } else if (item.type === 'SILVER_PILE') {
          silver += item.silverPile.silverCount
        }
      })
      INVENTORY.silverCount += silver
      addChatMsg(`🎁 ${loots.join(', ')} and 🪙${silver}`)
    }
  },
  'https://core.api-wolvesville.com/inventory?': (data, url) => {
    console.log(data)
    if (data?.silverCount) {
      INVENTORY = data
    }
    if (data?.lootBoxes !== undefined) {
      const { lootBoxes } = data
      if (lootBoxes.length) {
        const cardBoxes = lootBoxes.filter((v) => v.event === 'LEVEL_UP_CARD').length
        const tmp = cardBoxes ? `(including ${cardBoxes} role cards)` : ''
        addChatMsg(`🎁 ${lootBoxes.length} boxes available ${tmp}`)
      }
      $('.lv-modal-loot-boxes-status').text(`(${lootBoxes.length} 🎁 available)`)
    }
  },
  'https://game.api-wolvesville.com/api/public/game/running': (data) => {
    if (LV_SETTINGS.ALLOW_MULTI) {
      return new Response(JSON.stringify({ running: false }))
    }
  },
  'https://core.api-wolvesville.com/rewards/goldenWheelSpin': (data) => {
    if (data?.length) {
      const winner = data.find((v) => v.winner)
      if (winner) {
        const tmp = winner.silver > 0 ? `🪙${winner.silver}` : winner.type
        addChatMsg(`${tmp} looted from 🌹 wheel`)
        INVENTORY.silverCount += winner.silver
        INVENTORY.roseCount -= 30
        setChatState()
      }
    }
  },
  'https://core.api-wolvesville.com/rewards/wheelRewardWithSecret/': (data) => {
    if (data?.code) {
      addChatMsg(`Error: You probably hit the spins limit for today ${JSON.stringify(data)}`, true, 'color: #ff603b;')
      $('.lv-modal-gold-wheel-status').text(`Unavailable`).css({ color: '#ff603b' })
    } else if (data?.length) {
      const winner = data.find((v) => v.winner)
      if (winner) {
        const tmp = winner.silver > 0 ? `🪙${winner.silver}` : winner.type
        INVENTORY.silverCount += winner.silver
        GOLD_WHEEL_SPINS_COUNTER += 1
        GOLD_WHEEL_SILVER_SESSION += winner.silver
        PLAYER.silverCount += winner.silver
        addChatMsg(
          `#${GOLD_WHEEL_SPINS_COUNTER}: ${tmp} looted from 🪙 wheel (session: 🪙${GOLD_WHEEL_SILVER_SESSION})`
        )
        setChatState()
      }
    }
  },
  'https://core.api-wolvesville.com/rewards/wheelItems/v2': (data) => {
    if (data.nextRewardAvailableTime) {
      $('.lv-modal-gold-wheel-status')
        .text(
          `Unavailable until ${new Date(data.nextRewardAvailableTime).toLocaleString('en-US', {
            timeZoneName: 'short',
          })}`
        )
        .css({ color: '#ff603b' })
    } else {
      $('.lv-modal-gold-wheel-status').text(`Available`).css({ color: '#67c23a' })
    }
  },
}

const fetchInterceptor = () => {
  const { fetch: origFetch } = window
  window.fetch = async (...args) => {
    const url = args[0]
    if (url.startsWith('https://core.api-wolvesville.com/inventory?')) {
      args[0] = 'https://core.api-wolvesville.com/inventory?'
    }
    const catchMethod = requestsToCatch[Object.keys(requestsToCatch).find((_url) => url.startsWith(_url))]
    if (!!catchMethod) {
      log('fetch called with args:', args)
      const response = await origFetch(...args)
      const mockedReponse = await response
        .clone()
        .json()
        .then((data) => {
          log('intercepted response data:', data)
          return catchMethod(data)
        })
      if (mockedReponse) log(mockedReponse, response)
      return mockedReponse || response
    } else {
      return origFetch(...args)
    }
  }
}

function socketInterceptor(fn) {
  fn = fn || log
  let property = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data')
  const data = property.get
  function lookAtMessage() {
    let socket = this.currentTarget instanceof WebSocket
    if (!socket) return data.call(this)
    let msg = data.call(this)
    Object.defineProperty(this, 'data', { value: msg })
    fn({ data: msg, socket: this.currentTarget, event: this })
    return msg
  }
  property.get = lookAtMessage
  Object.defineProperty(MessageEvent.prototype, 'data', property)
}

const onMessage = (message) => {
  const messageId = message.data.slice(0, 2)
  if (messageId === '42') {
    const parsedMessage = messageParser(message.data)
    log(parsedMessage)
    if (parsedMessage?.length) {
      messageDispatcher(parsedMessage)
    }
  }
}

const messagesToCatch = {
  'game-joined': (data) => {
    addChatMsg('🔗 Game joined')
    DOCUMENT_TITLE = '🔗 Game joined'
    ROLE = undefined
    setTimeout(setPlayersLevel, 1000)
  },
  'game-starting': (data) => {
    GAME_STATUS = 'starting'
    addChatMsg('🚩 Game starting')
    DOCUMENT_TITLE = '🚩 Game starting'
  },
  'game-started': (data) => {
    GAME_STATUS = 'started'
    addChatMsg('🚀 Game started')
    DOCUMENT_TITLE = '🚀 Game started'
    GAME_STARTED_AT = new Date().getTime()
    setRole(data.role)
    addChatMsg(`You are ${ROLE.name} (${ROLE.id})`, true, 'color: #FF4081;')
    DOCUMENT_TITLE = `⌛ ${ROLE.name}`
    PLAYERS = data.players
    setTimeout(setPlayersLevel, 1000)
  },
  'game-reconnect-set-players': (data) => {
    PLAYERS = Object.values(data)
    setTimeout(setPlayersLevel, 1000)
    if (PLAYER) {
      const tmp = PLAYERS.find((v) => v.username === PLAYER.username)
      if (tmp) {
        if (tmp.spectate) {
          DOCUMENT_TITLE = `🚀 Spectator`
          addChatMsg(`You are Spectator`, true, 'color: #FF4081;')
        } else {
          setRole(tmp.role)
          DOCUMENT_TITLE = `🚀 ${tmp.gridIdx}. ${ROLE.name}`
          addChatMsg(`You are ${ROLE.name} (${ROLE.id})`, true, 'color: #FF4081;')
        }
      }
    }
  },
  'game-night-started': (data) => {
    setTimeout(setPlayersLevel, 1000)
    const tmp = PLAYERS.find((v) => v.id === PLAYER.id)
    if (ROLE) DOCUMENT_TITLE = `🚀 ${tmp.gridIdx}. ${ROLE.name}`
  },
  'players-and-equipped-items': (data) => {
    console.log(GAME_STATUS)
    if (GAME_STATUS === 'started') {
      console.log(data.players)
      PLAYERS = data.players
      setTimeout(setPlayersLevel, 1000)
    }
  },
  'game-players-killed': (data) => {
    data['victims'].forEach((victim) => {
      const player = PLAYERS.find((v) => v.id === victim.targetPlayerId)
      const tmp = player ? `${parseInt(player.gridIdx) + 1}. ${player.username}` : '?'
      addChatMsg(`☠️ ${tmp} (${victim.targetPlayerRole}) by ${victim.cause}`)
    })
  },
  'game-over-awards-available': (data) => {
    TOTAL_XP_SESSION += data.playerAward.awardedTotalXp
    addChatMsg(`🧪 ${data.playerAward.awardedTotalXp} xp`)
    if (data.playerAward.awardedLevels) {
      PLAYER.level += data.playerAward.awardedLevels
      TOTAL_UP_LEVEL += data.playerAward.awardedLevels
      log(`🆙 ${PLAYER.level}`)
    }
  },
  'game-game-over': (data) => {
    GAME_STATUS = 'over'
    let tmp = `🏁 Game over`
    if (GAME_STARTED_AT) {
      const gameDuration = new Date().getTime() - GAME_STARTED_AT
      tmp += ` (${(gameDuration / 1000).toFixed(0)}s)`
      GAME_STARTED_AT = 0
    }
    DOCUMENT_TITLE = tmp
    addChatMsg(tmp)
  },
}

const messageDispatcher = (message) => {
  const msg = message[0]
  const data = message.length > 1 ? message[1] : null
  const method = messagesToCatch[msg]
  !!method && method(data)
}

function setPlayersLevel() {
  // if ($('.lv-username').length) return
  if (!LV_SETTINGS.SHOW_HIDDEN_LVL) return
  PLAYERS.forEach((player) => {
    const hide = !!(player.id === PLAYER.id && LV_SETTINGS.HIDE_USERNAME)
    const str = `${parseInt(player.gridIdx) + 1} ${player.username}`
    const el = $(`div:contains("${str}")`)
    const gridIdx = parseInt(player.gridIdx) + 1
    const username = hide ? '???' : player.username
    const level = hide ? '0' : player.level
    let clanTag = ''
    if (player.clanTag) clanTag = hide ? '❓' : `${player.clanTag}`
    let newUsername = `${gridIdx} ${username} [${level}] ${clanTag}`
    if (el.length) {
      el[el.length - 1].innerHTML = newUsername
      el[el.length - 1].className = 'lv-username'
      el[el.length - 1].parentElement.className = 'lv-username-box'
    }
  })
}

const addChatEvents = () => {
  $('.lv-chat-toggle').on('click', () => {
    IS_CONSOLE_OPEN = !IS_CONSOLE_OPEN
    onToggleChat()
  })
  $('.lv-chat-settings').on('click', () => {
    $('.lv-modal-popup-container').css({ display: 'block' })
  })
}

function injectChat() {
  const lvChat = $('.lv-chat')
  const gameChat = $('div[style="flex: 1 1 0%; margin-top: 16px;"]')
  const endScreen = $(
    'div[style="font-size: 28px; color: rgba(255, 255, 255, 0.87); font-family: FontAwesome6_Pro_Solid; font-weight: normal; font-style: normal;"]'
  )
  if (!lvChat.length) {
    $('html').append(lvChatEl)
    onToggleChat()
    addChatEvents()
    injectHistory()
  } else {
    if (!endScreen.length && gameChat.length) {
      if (!lvChat.hasClass('game')) {
        lvChat.appendTo(gameChat)
        lvChat.removeClass().addClass('lv-chat game')
        scrollToBottom()
      }
    } else {
      if (!lvChat.hasClass('abs')) {
        lvChat.appendTo('html')
        lvChat.removeClass().addClass('lv-chat abs')
        scrollToBottom()
      }
    }
  }
}

function addChatMsg(message, strong = false, style = '') {
  log(`[LoupsVille] ${message}`)
  if (strong) message = `<strong>${message}</strong>`
  const content = `[${formatTime(new Date(Date.now()))}] ${message}`
  const inner = `<div class="lv-chat-msg" style="${style}">${content}</div>`
  HISTORY.push(inner)
  $('.lv-chat-container').append(inner)
  scrollToBottom()
}

function addOldChatMsg(inner) {
  $('.lv-chat-container').append(inner)
  scrollToBottom()
}

function injectHistory() {
  const lvChat = $('.lv-chat')
  const lvChatMsg = $('.lv-chat-msg')
  if (!lvChat.length) return
  if (HISTORY.length) {
    if (!lvChatMsg.length) HISTORY.forEach(addOldChatMsg)
  } else {
    addChatMsg(`🔥 LoupsVille v${VERSION} injected !`, true, 'color: #ffe31f;')
  }
}

function injectStyles() {
  $('html').append(lvStyles)
}

function messageParser(message) {
  let tmp = message.slice(2)
  tmp = tmp.replaceAll('"{', '{')
  tmp = tmp.replaceAll('}"', '}')
  tmp = tmp.replaceAll('\\"', '"')
  let parsedMessage = undefined
  try {
    parsedMessage = JSON.parse(tmp)
  } catch {
    console.error('[LoupsVille] Error parsing message: ', message)
  }
  return parsedMessage
}

function formatTime(d) {
  const HH = d.getHours().toString().padStart(2, '0')
  const MM = d.getMinutes().toString().padStart(2, '0')
  const SS = d.getSeconds().toString().padStart(2, '0')
  const mmm = d.getMilliseconds().toString().padStart(3, '0')
  return `${HH}:${MM}:${SS}.${mmm}`
}

function scrollToBottom() {
  var elems = document.getElementsByClassName('lv-chat-container')
  if (elems.length) elems[0].scrollTop = elems[0].scrollHeight
}

const onToggleChat = () => {
  $('.lv-chat-toggle').text(IS_CONSOLE_OPEN ? '' : '')
  $('.lv-chat-container').css({
    height: IS_CONSOLE_OPEN ? '180px' : '0',
    padding: IS_CONSOLE_OPEN ? '.25rem .5rem' : '0',
    'border-top': IS_CONSOLE_OPEN ? 'thin solid #414243' : '0',
  })
  $('.lv-chat').css({ opacity: IS_CONSOLE_OPEN ? '1' : '.5' })
}

const setChatState = () => {
  if (INVENTORY) {
    $('.lv-chat-state').text(
      `🪙${INVENTORY.silverCount} 🌹${INVENTORY.roseCount} 🧪${TOTAL_XP_SESSION} 🆙${TOTAL_UP_LEVEL}`
    )
  }
}

const lvChatEl = `
<div class="lv-chat abs">
  <div class="lv-chat-header">
    <div style="display: flex; align-items: center">
      <div class="lv-chat-toggle lv-icon"></div>
      LoupsVille v${VERSION}
    </div>
    <div class="lv-chat-state"></div>
    <div class="lv-chat-settings lv-icon"></div>
  </div>
  <div class="lv-chat-container"></div>
</div>
`

const lvModal = `
<div class="lv-modal-popup-container">
  <div class="lv-modal-veil"></div>
  <div class="lv-modal">
    <div class="lv-modal-header">
      <div style="display: flex; align-items: center;">
        <div class="lv-icon"></div>
        <span class="lv-modal-title">Settings</span>
      </div>
      <div class="lv-icon lv-modal-close"></div>
    </div>
    <div class="lv-modal-container">
      <div class="lv-modal-section">
        <div class="lv-modal-subtitle">General</div>
        <div class="lv-modal-option">
          <div class="lv-modal-checkbox hide-player lv-icon"></div>
          <span>Hide your name and level (reload to take effect)</span>
        </div>
        <div class="lv-modal-option">
          <div class="lv-modal-checkbox allow-multi lv-icon"></div>
          <span>Allow playing several games simultaneously</span>
        </div>
        <div class="lv-modal-option">
          <div class="lv-modal-checkbox debug lv-icon"></div>
          <span>Debug mode</span>
        </div>
      </div>
      <div class="lv-modal-section">
        <div class="lv-modal-subtitle">In Game</div>
        <div class="lv-modal-option">
          <div class="lv-modal-checkbox show-hidden-lvl lv-icon"></div>
          <span>Show hidden level of other players</span>
        </div>
        <div class="lv-modal-option">
          <div class="lv-modal-checkbox auto-replay lv-icon"></div>
          <span>Replay when game is over (your game must be in english)</span>
        </div>
        <div class="lv-modal-option disabled">
          <div class="lv-modal-checkbox chat-stats lv-icon"></div>
          <span>Chat stats perk <strong class="lv-coming-soon">COMING SOON</strong></span>
        </div>
      </div>
      <div class="lv-modal-section">
        <div class="lv-modal-subtitle">Commands</div>
        <div class="lv-modal-command">
          <button class="lv-modal-gold-wheel-btn">Spin Gold Wheel</button>
          <span class="lv-modal-gold-wheel-status"></span>
        </div>
        <div class="lv-modal-command">
          <button class="lv-modal-rose-wheel-btn">Spin Rose Wheel</button>
          <span style="font-style: italic;">(cost 30 🌹/spin)</span>
          <span class="lv-modal-rose-wheel-status"></span>
        </div>
        <div class="lv-modal-command">
          <button class="lv-modal-loot-boxes-btn">Open all loot boxes</button>
          <span class="lv-modal-loot-boxes-status" style="font-style: italic;"></span>
        </div>
      </div>
      <div class="lv-modal-footer">
        Made with ❤️ by
        <strong>&nbsp;Master Chief&nbsp;</strong>
        (discord: masterchief_09)
      </div>
    </div>
  </div>
</div>
`

const lvStyles = `
<style>
div {
  user-select: auto !important;
}
.lv-chat {
  width: 100%;
  margin-top: 1rem;
  box-sizing: border-box;
  background-color: #181818;
  border: thin solid #414243;
  border-radius: .5rem;
  font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #fafafa;
}
.lv-chat-header {
  height: 28px;
  background-color: #181818;
  border-radius: .5rem;
  padding: 0 6px;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.lv-modal-close,
.lv-chat-toggle,
.lv-chat-settings {
  font-size: 18px;
  cursor: pointer;
  user-select: none !important;
}
.lv-chat-toggle {
  margin-right: 6px;
}
.lv-chat-state {
  font-weight: 500;
  display: flex;
  align-items: center;
}
.lv-chat-container {
  overflow-y: scroll;
  height: 180px;
  transition: height .25s ease-out;
  scrollbar-color: #fafafa rgba(0, 0, 0, 0) !important;
  display: flex;
  flex-direction: column;
}
.lv-chat.abs {
  position: absolute;
  bottom: 4rem;
  left: 1rem;
  z-index: 1041;
  width: 500px !important;
}
.lv-chat.end {
  position: absolute;
  bottom: -216px;
}
.lv-chat-msg {
  display: inline;
  text-align: inherit;
  text-decoration: none;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
.lv-username {
  color: #fafafa;
  font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-weight: 500;
}
.lv-username-box {
  background-color: #181818;
  padding: 2px 8px 4px 8px;
  border-radius: 8px;
}
.lv-modal-popup-container {
  display: none;
}
.lv-modal {
  z-index: 1042;
  position: absolute;
  left: 50%;
  top: 40%;
  width: 500px;
  transform: translate(-50%, -50%);
  background-color: #181818;
  border: thin solid #414243;
  border-radius: .5rem;
  font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #fafafa;
}
.lv-modal-veil {
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgb(17, 23, 31);
  opacity: 0.7;
  z-index: 1040;
}
.lv-modal-header {
  height: 2rem;
  font-size: 18px;
  gap: 1rem;
  padding: 0.5rem 1rem 0.5rem 1rem;
  border-bottom: thin solid #414243;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.lv-modal-title {
  font-weight: bold;
  margin-left: 0.5rem;
}
.lv-modal-container {
  padding: 1rem 1.25rem;
}
.lv-modal-section {
  padding-bottom: .75rem;
  margin-bottom: .75rem;
  border-bottom: thin solid #414243;
}
.lv-modal-subtitle {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: .5rem;
  }
.lv-modal-command {
  margin-bottom: .25rem;
  display: flex;
  align-items: center;
}
.lv-modal-command button {
  font-size: 14px;
  cursor: pointer;
  margin-right: .5rem;
}
.lv-modal-gold-wheel-status {
  font-weight: bold;
}
.lv-modal-option {
  display: flex;
  align-items: center;
  margin-bottom: .25rem;
}
.lv-modal-option .lv-modal-checkbox {
  margin-right: .5rem;
  font-size: 18px;
  cursor: pointer;
}
.lv-modal-option.disabled {
  color: #fafafa75 !important;
}
.lv-modal-option.disabled .lv-coming-soon {
  color: #ffe31f !important;
}
.lv-modal-option.disabled .lv-modal-checkbox {
  cursor: not-allowed !important;
}
.lv-modal-option span {
  font-size: 14px;
}
.lv-modal-footer {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.lv-icon {
  font-family: FontAwesome6_Pro_Regular;
}
</style>
`

const patchLocalStorage = () => {
  var orignalSetItem = localStorage.setItem
  localStorage.setItem = function (k, v) {
    if (k == 'open-page') {
      localStorage.removeItem(k)
      return
    }
    orignalSetItem.apply(this, arguments)
  }
  setTimeout(() => {
    if (LV_SETTINGS.HIDE_USERNAME) {
      let settings = JSON.parse(localStorage.getItem('settings'))
      settings.hidePlayerNames = true
      localStorage.setItem('settings', JSON.stringify(settings))
    }
  }, 1000)
}

const getHeaders = () => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Authorization: `Bearer ${AUTHTOKENS.idToken}`,
  'Cf-JWT': `${AUTHTOKENS['Cf-JWT']}`,
  ids: 1,
})

const getRewardSecret = () => {
  const i = PLAYER.id
  const o = INVENTORY.silverCount
  const n = PLAYER.xpTotal
  const r = INVENTORY.roseCount
  log(i, o, n, r)
  return `${i.charAt(o % 32)}${i.charAt(n % 32)}${new Date().getTime().toString(16)}${i.charAt((o + 1) % 32)}${i.charAt(
    r % 32
  )}`
}

main()

window.addEventListener('load', function () {})
