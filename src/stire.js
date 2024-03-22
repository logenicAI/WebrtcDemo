import { create } from 'zustand'
import { createWebRTCSlice } from './slice/webRTC'

export const useWebRTCStore = create((...a) => ({
  ...createWebRTCSlice(...a)
}))
