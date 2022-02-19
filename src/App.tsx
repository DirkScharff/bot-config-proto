import './App.css'
import { useEffect, useState } from 'react'
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import {
  atom,
  atomFamily,
  RecoilState,
  selectorFamily,
  SerializableParam,
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilCallback,
  useRecoilState,
  useRecoilValue,
  useSetRecoilState,
} from 'recoil'
import _ from 'lodash'
import '@elastic/eui/dist/eui_theme_dark.css'
import { EuiButton, EuiFlexGroup, EuiFlexItem, EuiProvider } from '@elastic/eui'

import { v4 as uuid4 } from 'uuid'
import { TupleType } from 'typescript'
import { number } from 'prop-types'

interface INode {
  name: string
  inputs: string[]
  outputs: string[]
  options: any[]
}

const nodestypes: INode[] = [
  {
    name: 'MACD',
    inputs: ['price'],
    outputs: ['shortMA', 'longMA', 'hist', 'buy', 'sell'],
    options: [],
  },
]
const nodemap = nodestypes.reduce((prev, curr) => {
    return {...prev, [curr.name] : curr}
}, {})

interface IElement {
  id: ID
  type: string
}

const elements = atom<IElement[]>({
  key: 'canvas-elements',
  default: [],
})

type ID = string
type Mode = 'in' | 'out'

interface IPortID {
  id: ID
  name: string
}

interface IPort extends IPortID {
  mode: Mode
  types: any[]
}

type IConnection = [source: IPort, target: IPort]

const connections = atom<IConnection[]>({
  key: 'connections',
  default: [],
})

interface RelPos {
  dx: number
  dy: number
}

const connector_positions = atomFamily<RelPos, Readonly<IPortID>>({
  key: 'connector_positions',
  default: { dx: 0, dy: 0 },
})

interface Pos {
  x: number
  y: number
}
const positions = atomFamily<Pos, ID>({
  key: 'canvas-pos',
  default: { x: 100, y: 100 },
})

const connection_start = atom<IPort>({
  key: 'connection-start',
  default: undefined,
})

const hoveredID = atom<ID>({
  key: 'hovered',
  default: undefined,
})

const hoverables = atomFamily<Boolean, ID>({
  key: 'hoverables',
  default: false,
})

const hoverable = selectorFamily<Boolean, any>({
  key: 'hoverable',
  get:
    id =>
    ({ get }) =>
      get(hoverables(id)),
  set:
    id =>
    ({ get, set }, val) => {
      if (val === true) {
        set(hoverables(id), true)
        set(hoveredID, id)
      } else {
        set(hoverables(id), false)
        if (get(hoveredID) == id) set(hoveredID, undefined)
      }
    },
})

const useHoverable = ({ id, name }) => {
  const [hovered, setHovered] = useRecoilState(hoverable({ id, name }))

  const handlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  }
  return [hovered, handlers]
}

const useConnectible = ({ id, name, mode, types }: IPort) => {
  const [hovered, hoverHandlers] = useHoverable({ id, name })
  const start = useSetRecoilState(connection_start)
  const addConnection = useRecoilCallback(
    ({ snapshot, set }) =>
      ({ id, name, mode, types }) => {
        const s = snapshot.getLoadable(connection_start).contents as IPort
        set(connections, cs => [...cs, [s, { id, name, mode, types }] as IConnection])
      },
  )
  const handlers = {
    onMouseDown: () => {
      start({ id, name, mode, types })
    },
    onMouseUp: () => {
      addConnection({ id, name, mode, types })
    },
  }
  return [hovered, { ...hoverHandlers, ...handlers }]
}

const Connector = ({ id, name, mode, types = [], dx, dy, ...props }) => {
  const [hovered, handlers] = useConnectible({ id, name, mode, types })
  const { x, y } = useRecoilValue(positions(id))
  const set_positon = useSetRecoilState(connector_positions({ id, name }))

  useEffect(() => {
    set_positon({ dx, dy })
  }, [dx, dy, set_positon])

  return (
    <>
      <Circle
        {...props}
        {...handlers}
        x={x + dx}
        y={y + dy}
        fill={hovered ? 'black' : 'white'}
      />
      <Text
        {...{ x: mode === 'in' ? x + props.radius : x + dx + props.radius, y: y + dy }}
        text={name}
      />
    </>
  )
}

const BasicExampleNode = ({ id }) => {
  return <Node {...{ id, name: 'example', inputs: ['a'], outputs: ['b', 'c', 'd'] }} />
}

const Node = ({ id, name = '', inputs = [], outputs = [] }) => {
  const [{ x, y }, setXY] = useRecoilState(positions(id))
  const [dragroot, setDragroot] = useState(undefined)
  const nodeSettings = {
    width: 200,
    height: 100,
    cornerRadius: 5,
    stroke: 'black',
    fill: 'white',
  }

  return (
    <Group>
      <Rect {...{ ...nodeSettings, x, y }} />
      <Text
        x={x}
        y={y}
        text={name}
        align='center'
        verticalAlign='middle'
        width={nodeSettings.width}
        height={nodeSettings.height}
        onMouseDown={e => {
          setDragroot({ x: e.evt.clientX - x, y: e.evt.clientY - y })
        }}
        onMouseMove={e => {
          if (dragroot) {
            setXY({
              x: e.evt.clientX - dragroot.x,
              y: e.evt.clientY - dragroot.y,
            })
          }
        }}
        onMouseUp={_e => setDragroot(undefined)}
        onMouseLeave={_e => setDragroot(undefined)}
      />

      {inputs.map((name, index) => {
        const dx = 0
        const dy = ((index + 1) / (inputs.length + 1)) * nodeSettings.height
        return (
          <Connector
            {...{
              key: index,
              id,
              name,
              dx,
              dy,
              mode: 'in',
              radius: 5,
              stroke: 'black',
              fill: 'white',
            }}
          />
        )
      })}
      {outputs.map((name, index) => {
        const dx = nodeSettings.width
        const dy = ((index + 1) / (outputs.length + 1)) * nodeSettings.height
        return (
          <Connector
            {...{
              key: index,
              id,
              name,
              dx,
              dy,
              mode: 'out',
              radius: 5,
              stroke: 'black',
              fill: 'white',
            }}
          />
        )
      })}
    </Group>
  )
}

const Connection = ({ start, end }: { start: IPort; end: IPort }) => {
  const st = useRecoilValue(positions(start.id))
  const en = useRecoilValue(positions(end.id))
  const st_rel = useRecoilValue(connector_positions({ id: start.id, name: start.name }))
  const en_rel = useRecoilValue(connector_positions({ id: end.id, name: end.name }))

  const pstart = [st.x + st_rel.dx, st.y + st_rel.dy]
  const pend = [en.x + en_rel.dx, en.y + en_rel.dy]

  return <Line points={[...pstart, ...pend]} stroke='black' />
}

const Connections = () => {
  const con = useRecoilValue(connections)
  return (
    <>
      {con.map(([start, end], i) => (
        <Connection key={i} start={start} end={end} />
      ))}
    </>
  )
}

const Debug = () => {
  const con = useRecoilValue(connections)
  const elem = useRecoilValue(elements)

  return <pre>{JSON.stringify({elem, con}, undefined, 2)}</pre>
}

export const Controls = () => {
  const setElements = useSetRecoilState(elements)

  const addNode = (type="Node") => {
    const id = uuid4()
    setElements(s => [...s, { id, type}])
  }

  return (
    <EuiFlexGroup>
      <EuiFlexItem>
        <EuiButton onClick={()=>addNode()}>addNode("Node")</EuiButton>
        
      </EuiFlexItem>
      <EuiFlexItem>
      <EuiButton onClick={()=>addNode("MACD")}>addNode("MACD")</EuiButton>
      </EuiFlexItem>
    </EuiFlexGroup>
  )
}

export const Element = ({ id, type }) => {
  console.log({id, type})
  switch (type) {
    case 'Node':
      return <BasicExampleNode {...{ id }} />
    default:
      if (type in nodemap){
        return <Node id={id} {...nodemap[type]}/>
      }
      return <div>ERROR</div>
  }
}

export const Elements = () => {
  const elems = useRecoilValue(elements)
  return (
    <>
      {elems.map(({ id, type }) => (
        <Element key={id} {...{ id, type }} />
      ))}
    </>
  )
}

function App() {
  const RecoilBridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  return (
    <>
      <EuiProvider>
        <Controls />
        <Debug/>
        <Stage width={window.innerWidth} height={window.innerHeight}>
          <RecoilBridge>
            <Layer>
              <Elements />
              {/* <Node id="dalskdlsk"></Node> */}
              <Connections />
            </Layer>
          </RecoilBridge>
        </Stage>
      </EuiProvider>
    </>
  )
}

export default App
