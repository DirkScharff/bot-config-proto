import './App.css';
import { useEffect, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage } from 'react-konva';
import { atom, atomFamily, selectorFamily, useRecoilBridgeAcrossReactRoots_UNSTABLE, useRecoilCallback, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import _ from "lodash"
import "@elastic/eui/dist/eui_theme_dark.css"
import { EuiButton, EuiFlexGroup, EuiFlexItem, EuiProvider } from '@elastic/eui';

import {v4 as uuid4} from "uuid"

const elements = atom({
  key: "canvas-elements",
  default: []
})

const connections = atom({
  key: "connections", 
  default: []
})

const connector_positions = atomFamily({
  key: 'connector_positions',
  default: {x:0, y:0},
});

const positions = atomFamily({
  key: "canvas-pos",
  default: {x:100, y:100}
})

const connection_start = atom({
  key: "connection-start",
  default: undefined
})

const hoveredID = atom({
  key: "hovered",
  default: undefined
})

const hoverables = atomFamily({
  key: "hoverables",
  default: false
})

const hoverable = selectorFamily({
  key: "hoverable",
  get: id => ({get}) => get(hoverables(id)),
  set: id => ({get, set}, val) => {
    if (val === true){
      set(hoverables(id), true)
      set(hoveredID, id)
    } else {
      set(hoverables(id), false)
      if (get(hoveredID) == id)
        set(hoveredID, undefined)
    }
  }
})

const useHoverable = ({id, name})=>{
  const [hovered, setHovered] = useRecoilState(hoverable({id, name}))

  const handlers = {
    onMouseEnter:()=> setHovered(true),
    onMouseLeave:()=> setHovered(false)
  }
  return [hovered, handlers]
}

const useConnectible = ({id, name, mode, types}) => {
    const [hovered, hoverHandlers] = useHoverable({id, name})
    const start = useSetRecoilState(connection_start)
    const addConnection = useRecoilCallback(({snapshot, set}) => ({id, name, mode, types}) => {
      const start=snapshot.getLoadable(connection_start).contents
      set(connections, cs => [...cs, [start, {id, name, mode, types}]])
    })
    const handlers = {
      onMouseDown: () => {start({id, name, mode, types})},
      onMouseUp: () => {
        addConnection({id, name, mode, types})
      }
    }
    return [hovered, {...hoverHandlers, ...handlers}]
}

const Connector = ({id, name, mode, types=[], dx,dy, ...props}) => {
  const [hovered, handlers] = useConnectible({id, name, mode, types})
  const {x,y} = useRecoilValue(positions(id))
  const set_positon = useSetRecoilState(connector_positions({id, name, mode}))

  useEffect(()=>{
    set_positon({x:x+dx,y:y+dy}) //TODO: Better just save dx, dy in recoil and have connection calculate the position
  },[x,y,dx,dy, set_positon])

  return <Circle {...props} {...handlers} x={x+dx} y={y+dy}
    fill={hovered?"black":"white"}
  />
}


const Node = ({id}) => {
  const [{x,y}, setXY] = useRecoilState(positions(id))
  const [dragroot, setDragroot] = useState(undefined)

  return <Group >
    <Rect x={x} y={y} width={200} height={100} cornerRadius={5} stroke="black" fill='white' 
    onMouseDown={e => {setDragroot({x:e.evt.clientX-x, y:e.evt.clientY-y})}}
    onMouseMove={e => {if (dragroot){setXY({x: e.evt.clientX - dragroot.x, y:e.evt.clientY-dragroot.y})}}}
    onMouseUp = {e=> setDragroot(undefined)}
    onMouseLeave= {e=> setDragroot(undefined)}
    />

    <Connector id={id} name="a" dx={0} dy={50} radius={5} stroke="black" fill='white'></Connector>
    <Connector id={id} name="b" dx={200} dy={50} radius={5} stroke="black" fill='white'></Connector>
  </Group>
}

const Connection = ({start, end}) => {
  const st = _.omit(start, "types")
  const en = _.omit(end, "types")

  const st_pos = useRecoilValue(connector_positions(st))
  const en_pos = useRecoilValue(connector_positions(en))

  return <Line points={[st_pos.x, st_pos.y, en_pos.x, en_pos.y]} stroke="black"/>
}

const Connections = () => {
  const con = useRecoilValue(connections)  
  return <>
  {con.map(([start, end], i) => <Connection key={i} start={start} end={end}/>)}
  </>
}

const Debug = () => {
  const con = useRecoilValue(connections)
  
  return <pre>
    {JSON.stringify(con)}
  </pre>
}

export const Controls = () => {

  const setElements = useSetRecoilState(elements)

  const addNode = () => {
    const id = uuid4()
    setElements( s => [...s, {id, type:"Node"}])
  }

  return (
    <EuiFlexGroup>
      <EuiFlexItem>
        <EuiButton onClick={addNode}>
          addNode
        </EuiButton>
      </EuiFlexItem>
    </EuiFlexGroup>
  )
}

export const Element = ({id, type}) => {
  switch (type) {
    case "Node": return <Node {...{id}}/>
    default: return <></>
  }
}

export const Elements = () => {
  const elems = useRecoilValue(elements)
  return <>
    {elems.map(({id, type}) => <Element key={id} {...{id, type}}/>)}
  </>
}

function App() {
  const RecoilBridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  return (<>
  <EuiProvider>
    <Controls/>
  {/* <Debug/> */}
  <Stage width={window.innerWidth} height={window.innerHeight}>
    <RecoilBridge>
    <Layer>
      <Elements/>
  {/* <Node id="dalskdlsk"></Node> */}
  <Connections/>
  </Layer>
  </RecoilBridge>
  </Stage>
  </EuiProvider>
  </>
  );
}

export default App;
