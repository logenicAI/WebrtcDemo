import { useWebRTCStore } from './stire'
import { useEffect } from 'react'

function App () {
  const { sendText, connectSocket, messageList, createPeerConnection, iceConnectionLog } = useWebRTCStore()
  useEffect(() => {
    connectSocket()
  }, [])
  // iceConnectionLog.textContent  语音连接状态 connected时表示已接通
  return (
    <div className='App'>
      <header className='App-header'>
        {messageList.map(item => {
          const { voice = [] } = item
          return (
            <p key={item.message_id}>
              {item.message_content}
              {voice.map(({ voice: voiceLink }) => {
                return voiceLink
              })}
            </p>
          )
        })}
        <button onClick={sendText}>
          发送消息
        </button>
        {iceConnectionLog.textContent}
        <button onClick={createPeerConnection}>
          语音电话
        </button>
        <audio id='audio' autoPlay />
      </header>
    </div>
  )
}

export default App
