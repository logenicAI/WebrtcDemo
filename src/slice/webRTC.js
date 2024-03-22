const host = 'dev-hk.logenic.ai'
const useSSL = false
const { v4: uuidv4 } = require('uuid')

export function generateUUID () {
  return uuidv4()
}

export const createWebRTCSlice = (set, get) => ({
  // 用户token
  token: 'wWurhkQL8DSaxQjp6W94cUL3HSiEecs3',
  // 用户所创建的agentid
  agentId: 1,
  // 历史消息记录
  messageList: [],
  //  WebRTC 连接状态
  iceGatheringLog: {
    textContent: ''
  },
  iceConnectionLog: {
    textContent: ''
  },
  signalingLog: {
    textContent: ''
  },
  timeStart: null,
  connectSocket: () => {
    const { token, agentId } = get()
    let socket = null
    const protocol = (useSSL ? 'wss' : 'ws')
    const url = `wss://${host}/ws/agents?token=${token}&agent_id=${agentId}`
    socket = new window.WebSocket(url)
    socket.onmessage = async (e) => {
      const serverMsg = JSON.parse(e.data)
      const { message_type: messageType } = serverMsg
      switch (messageType) {
        case 'user_input':
          get().received(serverMsg)
          return
        case 'append_text':
          get().received(serverMsg)
          return
        case 'append_voice':
          get().receivedVoice(serverMsg)
          return
        default:
          return
      }
    }
    socket.onopen = () => { }
    set({
      agentId,
      token,
      socket
    })
  },
  receivedVoice: (messageObj) => {
    const old = get().messageList
    let newMsg = []
    const msgObj = old.filter(msgItem => msgItem.message_id === messageObj.message_id)
    if (msgObj.length === 0) {
      newMsg = old.concat([{ ...messageObj, voice: [messageObj.extra] }])
    } else {
      msgObj[0].voice = msgObj[0].voice.concat([messageObj.extra])
      newMsg = old
    }
    set({
      messageList: newMsg,
    })
  },
  received: (messageObj) => {
    const old = get().messageList
    let newMsg = []
    const msgObj = old.filter(msgItem => msgItem.message_id === messageObj.message_id)
    if (msgObj.length === 0) {
      newMsg = old.concat([messageObj])
    } else {
      msgObj[0].message_content += messageObj.message_content
      newMsg = old
    }
    set({
      messageList: newMsg,
    })
  },
  // 发送文字消息
  sendText: () => {
    const msg = {
      message_id: generateUUID(),
      'event': 'message',
      'message_type': 'text',
      'message_content': 'hello'
    }
    get().socket.send(JSON.stringify(msg))
  },
  close: () => {},
  currentStamp: () => {
    let timeStart = get().timeStart
    if (timeStart === null) {
      timeStart = new Date().getTime()
      set({ timeStart })
      return 0
    } else {
      return new Date().getTime() - timeStart
    }
  },
  createPeerConnection: async () => {
    let dcInterval = null
    const {
      iceGatheringLog,
      iceConnectionLog,
      signalingLog,
    } = get()
    const pc = new window.RTCPeerConnection({
      sdpSemantics: 'unified-plan'
    })
    pc.addEventListener('icegatheringstatechange', () => {
      iceGatheringLog.textContent += ' -> ' + pc.iceGatheringState
    }, false)
    iceGatheringLog.textContent = pc.iceGatheringState
    pc.addEventListener('iceconnectionstatechange', () => {
      iceConnectionLog.textContent += ' -> ' + pc.iceConnectionState
      set({
        iceConnectionLog
      })
    }, false)
    iceConnectionLog.textContent = pc.iceConnectionState

    pc.addEventListener('signalingstatechange', () => {
      signalingLog.textContent += ' -> ' + pc.signalingState
    }, false)
    signalingLog.textContent = pc.signalingState
    pc.addEventListener('track', (evt) => {
      document.getElementById('audio').srcObject = evt.streams[0]
    })

    const dc = pc.createDataChannel('heartbeat', { ordered: true })
    dc.addEventListener('close', () => {
    })
    dc.addEventListener('open', () => {
      // dc 用来保持连接 每秒发送一次
      dcInterval = setInterval(function () {
        const message = 'ping ' + get().currentStamp()
        dc.send(message)
        iceConnectionLog.textContent = pc.iceConnectionState
        set({
          iceConnectionLog
        })
      }, 1000)
    })
    dc.addEventListener('message', (evt) => {
      console.log(evt, 'evt')
    })
    const messageDc = pc.createDataChannel('message', { ordered: true })
    messageDc.onclose = function () { }
    messageDc.onmessage = function (evt) {
      get().onMessage(evt)
    }
    messageDc.onopen = function () {
      messageDc.send(JSON.stringify({ event: 'message', message_type: 'voice' }))
      set({
        messageDc,
      })
    }

    const constraints = {
      audio: true,
      video: false
    }
    set({
      dc,
      pc
    })
    const audioConstraints = {}
    constraints.audio = Object.keys(audioConstraints).length ? audioConstraints : true
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      stream.getTracks().forEach((track) => {
        pc && pc.addTrack(track, stream)
      })
      return get().negotiate()
    }, (err) => {
      console.log('Could not acquire media: ' + err)
    })
  },
  negotiate: () => {
    const { pc } = get()
    return pc.createOffer().then((offer) => {
      return pc.setLocalDescription(offer)
    }).then(() => {
      // wait for ICE gathering to complete
      return new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve()
        } else {
          function checkState () {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState)
              resolve()
            }
          }
          pc.addEventListener('icegatheringstatechange', checkState)
        }
      })
    }).then(() => {
      const offer = pc.localDescription
      return fetch(`https://${host}/rtc`, {
        body: JSON.stringify({
          agent_id: get().agentId,
          sdp: offer.sdp,
          type: offer.type
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${get().token}`
        },
        method: 'POST'
      })
    }).then((response) => {
      return response.json()
    }).then((answer) => {
      return pc.setRemoteDescription(answer)
    }).catch((e) => {
    })
  },
  onMessage: (msg) => {
    const serverMsg = (msg && msg.data && JSON.parse(msg.data)) || {}
    // 包含语音  文字消息
    if (serverMsg.event === 'message') {
      get().received(serverMsg)
    }
  },
})
