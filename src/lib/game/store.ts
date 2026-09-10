import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createNewGame, hydrateSave, advanceWeek } from './engine'
import type { GameState, TeamId } from './types'
interface Store { game:GameState|null; start:(team:TeamId)=>void; next:()=>void; load:(data:unknown)=>void; reset:()=>void }
export const useGame=create<Store>()(persist((set,get)=>({game:null,start:(team)=>set({game:createNewGame(team)}),next:()=>{const g=get().game;if(g)set({game:advanceWeek(g)})},load:(data)=>set({game:hydrateSave(data as Partial<GameState>)}),reset:()=>set({game:null})}),{name:'nfl-rewind-dynasty'}))
