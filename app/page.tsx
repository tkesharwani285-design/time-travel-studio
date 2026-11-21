"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownToLine, Check, ChevronDown, Circle, CircleHelp, Clock3, Cloud, Eraser, Hand, Layers2, Minus, MousePointer2, Palette, Pen, Plus, Redo2, RotateCcw, Share2, Square, Undo2, X } from "lucide-react"

type Tool = "pen" | "line" | "rectangle" | "circle" | "eraser" | "picker"
type Shape = { id: string; type: "path" | "line" | "rectangle" | "circle"; points?: { x: number; y: number }[]; x: number; y: number; width: number; height: number; color: string; strokeWidth: number }
type Version = { id: string; label: string; parent: string | null; shapes: Shape[]; time: string }
const initialShapes: Shape[] = [
  { id: "a", type: "circle", x: 405, y: 260, width: 175, height: 175, color: "#a78bfa", strokeWidth: 5 },
  { id: "b", type: "path", points: [{x:160,y:390},{x:206,y:370},{x:253,y:400},{x:298,y:363},{x:344,y:383}], x:160,y:363,width:184,height:37,color:"#39d7e8",strokeWidth:5 },
  { id: "c", type: "rectangle", x: 645, y: 194, width: 128, height: 110, color: "#f5b941", strokeWidth: 5 },
]
const seedVersions: Version[] = [
  {id:"v001",label:"Blank",parent:null,shapes:[],time:"10:12 AM"},
  {id:"v002",label:"Circle",parent:"v001",shapes:[initialShapes[0]],time:"10:14 AM"},
  {id:"v003",label:"Sketch lines",parent:"v002",shapes:[...initialShapes.slice(0,2)],time:"10:18 AM"},
  {id:"v004",label:"Golden frame",parent:"v003",shapes:initialShapes,time:"10:21 AM"},
  {id:"v005",label:"Red Square",parent:"v002",shapes:[initialShapes[0],{...initialShapes[2],id:"d",color:"#fb7185"}],time:"10:19 AM"},
  {id:"v006",label:"Blue Square",parent:"v002",shapes:[initialShapes[0],{...initialShapes[2],id:"e",color:"#5b9dff"}],time:"10:20 AM"},
]
const tools: {id:Tool; label:string; icon:typeof Pen; key:string}[] = [
  {id:"pen",label:"Pen",icon:Pen,key:"P"},{id:"line",label:"Line",icon:Minus,key:"L"},{id:"rectangle",label:"Rectangle",icon:Square,key:"R"},{id:"circle",label:"Circle",icon:Circle,key:"O"},{id:"eraser",label:"Eraser",icon:Eraser,key:"E"},{id:"picker",label:"Color picker",icon:Palette,key:"I"},
]
const swatches=["#f5f5f7","#a78bfa","#39d7e8","#fb7185","#f5b941","#5b9dff","#67d7a5"]

function DrawShape({shape}:{shape:Shape}) {
  const common={fill:"none",stroke:shape.color,strokeWidth:shape.strokeWidth,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,vectorEffect:"non-scaling-stroke" as const}
  if(shape.type==="circle") return <ellipse {...common} cx={shape.x+shape.width/2} cy={shape.y+shape.height/2} rx={Math.abs(shape.width/2)} ry={Math.abs(shape.height/2)}/>
  if(shape.type==="rectangle") return <rect {...common} x={shape.width<0?shape.x+shape.width:shape.x} y={shape.height<0?shape.y+shape.height:shape.y} width={Math.abs(shape.width)} height={Math.abs(shape.height)} rx="2"/>
  if(shape.type==="line") return <line {...common} x1={shape.x} y1={shape.y} x2={shape.x+shape.width} y2={shape.y+shape.height}/>
  return <polyline {...common} points={(shape.points||[]).map(p=>`${p.x},${p.y}`).join(" ")}/>
}

function HistoryPanel({versions,current,onSelect,onCheckpoint}:{versions:Version[];current:string;onSelect:(id:string)=>void;onCheckpoint:()=>void}) {
  const path=useMemo(()=>{const result=new Set<string>();let item=versions.find(v=>v.id===current);while(item){result.add(item.id);item=versions.find(v=>v.id===item?.parent)}return result},[versions,current])
  const colors:Record<string,string>={v001:"#596273",v002:"#ad8aff",v003:"#41cde0",v004:"#eab84f",v005:"#fb7185",v006:"#5b9dff"}
  const children=(parent:string|null)=>versions.filter(v=>v.parent===parent)
  const leaves=versions.filter(v=>!versions.some(c=>c.parent===v.id)).length
  const renderBranch=(parent:string|null,depth:number):React.ReactNode=>{const kids=children(parent),branched=kids.length>1;return kids.map((v,index)=>{
    const active=v.id===current
    return <div key={v.id} className="tree-node" style={{marginLeft:branched?22:0}}>
      {branched&&<span className={`tree-connector ${path.has(v.id)?"is-path":""} ${index===kids.length-1?"last":""}`} aria-hidden="true"/>}
      <button className={`history-item ${active?"current":""} ${path.has(v.id)&&!active?"on-path":""}`} onClick={()=>onSelect(v.id)} aria-current={active?"true":undefined}>
        <span className="version-dot" style={{background:colors[v.id]||"#8872c4"}}/>
        <span className="history-copy"><span className="history-label">{v.label}</span><span className="history-meta">{v.id} <span>·</span> {v.time}</span></span>
        {active&&<span className="current-pill">CURRENT</span>}
      </button>{renderBranch(v.id,depth+1)}
    </div>
  })}
  return <aside className="history-panel"><div className="panel-heading"><div><span className="eyebrow">TIMELINE</span><h2>Version history</h2></div><button className="icon-button panel-add" title="Save a checkpoint" aria-label="Save a checkpoint" onClick={onCheckpoint}><Plus/></button></div><div className="history-summary"><span className="summary-bullet"/> <span>{versions.length} versions</span><span className="summary-divider"/> <span>{leaves} {leaves===1?"branch":"branches"}</span></div><div className="history-scroll" aria-label="Version history tree">{renderBranch(null,0)}</div><div className="history-footer"><div className="path-key"><i/>Path to current</div><span>Click a version to restore</span></div></aside>
}

const STORAGE_KEY = "time-travel-studio:v1"
const MAX_SHARE_URL = 60000
type Saved = { versions: Version[]; current: string }
const labels: Record<Tool, string> = { pen: "Sketch", line: "Line", rectangle: "Rectangle", circle: "Circle", eraser: "Erase", picker: "Pick" }

function bounds(s: Shape, pad = 0) {
  return {
    x1: Math.min(s.x, s.x + s.width) - pad, x2: Math.max(s.x, s.x + s.width) + pad,
    y1: Math.min(s.y, s.y + s.height) - pad, y2: Math.max(s.y, s.y + s.height) + pad,
  }
}
function hits(s: Shape, p: { x: number; y: number }, pad: number) {
  const b = bounds(s, pad)
  return p.x >= b.x1 && p.x <= b.x2 && p.y >= b.y1 && p.y <= b.y2
}
const clock = () => new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
const nextVersionId = (vs: Version[]) => `v${String(Math.max(0, ...vs.map(v => Number(v.id.slice(1)) || 0)) + 1).padStart(3, "0")}`
const toBase64Url = (text: string) => {
  let bin = ""
  new TextEncoder().encode(text).forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
const fromBase64Url = (b64: string) => {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"))
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))
}
function isSaved(d: unknown): d is Saved {
  if (!d || typeof d !== "object") return false
  const { versions, current } = d as Partial<Saved>
  return Array.isArray(versions) && versions.length > 0 && typeof current === "string" &&
    versions.every(v => v && typeof v.id === "string" && typeof v.label === "string" && typeof v.time === "string" && (v.parent === null || typeof v.parent === "string") && Array.isArray(v.shapes)) &&
    versions.some(v => v.id === current)
}

function DrawingStudio() {
  const [tool,setTool]=useState<Tool>("pen"),[color,setColor]=useState("#a78bfa"),[width,setWidth]=useState(4),[versions,setVersions]=useState(seedVersions),[current,setCurrent]=useState("v004"),[zoom,setZoom]=useState(100),[draft,setDraft]=useState<Shape|null>(null),[erasing,setErasing]=useState<Shape[]|null>(null),[lastChild,setLastChild]=useState<Record<string,string>>({}),[saved,setSaved]=useState(true),[toast,setToast]=useState("")
  const svgRef=useRef<SVGSVGElement>(null), start=useRef({x:0,y:0})
  // The canvas is always derived from the current version, so the tree and the drawing can never disagree.
  const activeVersion=versions.find(v=>v.id===current)??versions[0]
  const shapes=activeVersion.shapes
  const visible=erasing??shapes
  const parent=activeVersion.parent
  const remembered=lastChild[current]
  const redoTarget=remembered&&versions.some(v=>v.id===remembered)?remembered:[...versions].reverse().find(v=>v.parent===current)?.id

  const notify=useCallback((text:string)=>{setToast(text);window.setTimeout(()=>setToast(""),2200)},[])

  // Drawing after an undo creates a NEW child of the current version, so the old future is kept as a branch.
  const commit=(next:Shape[],label:string)=>{
    const id=nextVersionId(versions)
    setVersions(v=>[...v,{id,label,parent:activeVersion.id,shapes:next,time:clock()}])
    setLastChild(m=>({...m,[activeVersion.id]:id}))
    setCurrent(id);setSaved(false)
  }
  const undo=useCallback(()=>{if(!parent)return;setLastChild(m=>({...m,[parent]:current}));setCurrent(parent);setSaved(false)},[parent,current])
  const redo=useCallback(()=>{if(!redoTarget)return;setCurrent(redoTarget);setSaved(false)},[redoTarget])
  const restore=(id:string)=>{setCurrent(id);setSaved(false)}

  const mapPoint=(e:React.PointerEvent<SVGRectElement>)=>{const r=svgRef.current!.getBoundingClientRect();return{x:Math.round((e.clientX-r.left)*9200/r.width)/10,y:Math.round((e.clientY-r.top)*6000/r.height)/10}}
  const onDown=(e:React.PointerEvent<SVGRectElement>)=>{
    const p=mapPoint(e)
    if(tool==="picker"){const hit=[...shapes].reverse().find(s=>hits(s,p,6));if(hit){setColor(hit.color);notify(`Picked ${hit.color.toUpperCase()}`)};return}
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current=p
    if(tool==="eraser"){setErasing(shapes.filter(s=>!hits(s,p,12)));return}
    setDraft({id:"draft",type:tool==="pen"?"path":tool,points:[p],x:p.x,y:p.y,width:0,height:0,color,strokeWidth:width})
  }
  const onMove=(e:React.PointerEvent<SVGRectElement>)=>{
    const p=mapPoint(e)
    if(erasing){setErasing(erasing.filter(s=>!hits(s,p,12)));return}
    if(!draft)return
    if(draft.type==="path")setDraft({...draft,points:[...(draft.points||[]),p]})
    else setDraft({...draft,width:p.x-start.current.x,height:p.y-start.current.y})
  }
  const onUp=()=>{
    if(erasing){if(erasing.length!==shapes.length)commit(erasing,labels.eraser);setErasing(null);return}
    if(!draft)return
    setDraft(null)
    let s:Shape={...draft,id:`s${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`}
    if(s.type==="path"){
      const pts=s.points||[]
      if(pts.length<2)return
      const xs=pts.map(q=>q.x),ys=pts.map(q=>q.y),x=Math.min(...xs),y=Math.min(...ys)
      s={...s,x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y}
    }else if(Math.abs(s.width)<3&&Math.abs(s.height)<3)return
    commit([...shapes,s],labels[tool])
  }

  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"){e.preventDefault();if(e.shiftKey)redo();else undo()}else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo()}else if(!e.metaKey&&!e.ctrlKey&&!e.altKey){const t=tools.find(t=>t.key.toLowerCase()===e.key.toLowerCase());if(t)setTool(t.id);if(e.key==="+")setZoom(z=>Math.min(150,z+10));if(e.key==="-")setZoom(z=>Math.max(50,z-10))}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[undo,redo])

  // Load a shared link (#p=...) or the last autosave. Runs after hydration so server and client HTML match.
  useEffect(()=>{
    const t=window.setTimeout(()=>{
      try{
        const fromLink=window.location.hash.startsWith("#p=")
        const raw=fromLink?fromBase64Url(window.location.hash.slice(3)):window.localStorage.getItem(STORAGE_KEY)
        if(!raw)return
        const data:unknown=JSON.parse(raw)
        if(!isSaved(data)){if(fromLink)notify("That share link looks damaged");return}
        if(fromLink){
          const mine=window.localStorage.getItem(STORAGE_KEY)
          if(mine)window.localStorage.setItem(`${STORAGE_KEY}:backup`,mine)
          window.history.replaceState(null,"",window.location.pathname)
          notify("Opened shared drawing")
        }
        setVersions(data.versions);setCurrent(data.current);setLastChild({})
      }catch{/* storage blocked or bad data: keep the demo project */}
    },0)
    return()=>window.clearTimeout(t)
  },[notify])

  // Autosave 0.5s after the last change.
  useEffect(()=>{
    if(saved)return
    const t=window.setTimeout(()=>{try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify({versions,current}))}catch{/* private mode */};setSaved(true)},500)
    return()=>window.clearTimeout(t)
  },[saved,versions,current])

  const save=()=>{try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify({versions,current}));setSaved(true);notify("Saved in this browser")}catch{notify("Browser storage is blocked")}}
  const share=()=>{
    const url=`${window.location.origin}${window.location.pathname}#p=${toBase64Url(JSON.stringify({versions,current}))}`
    if(url.length>MAX_SHARE_URL){notify("Too big for a link. Use Export PNG");return}
    navigator.clipboard.writeText(url).then(()=>notify("Share link copied to clipboard"),()=>notify("Clipboard blocked by the browser"))
  }
  const exportPng=()=>{if(!svgRef.current)return;const svg=svgRef.current.cloneNode(true) as SVGSVGElement;svg.setAttribute("xmlns","http://www.w3.org/2000/svg");const source=new XMLSerializer().serializeToString(svg),url=URL.createObjectURL(new Blob([source],{type:"image/svg+xml;charset=utf-8"})),image=new Image();image.onload=()=>{const canvas=document.createElement("canvas");canvas.width=1840;canvas.height=1200;const ctx=canvas.getContext("2d");if(ctx){ctx.fillStyle="#171922";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const a=document.createElement("a");a.download="time-travel-studio.png";a.href=canvas.toDataURL("image/png");a.click()}URL.revokeObjectURL(url)};image.src=url}
  return <main className="studio-shell"><header className="topbar"><div className="brand"><div className="brand-mark"><Clock3/></div><span className="brand-name">rewind<span className="brand-dot">.</span></span></div><div className="top-divider"/><div className="project-title"><span className="project-name">Time-Travel Drawing Studio</span><span className="project-subtitle"><span className="saved-dot"/>{saved?"Saved in this browser":"Saving…"}<ChevronDown/></span></div><div className="top-actions"><button className="icon-button history-top" aria-label="Undo" title="Undo (⌘Z)" onClick={undo} disabled={!parent}><Undo2/></button><button className="icon-button history-top" aria-label="Redo" title="Redo (⌘⇧Z)" onClick={redo} disabled={!redoTarget}><Redo2/></button><button className="button-quiet save-btn" onClick={save}><Check/>Save</button><button className="button-quiet export-btn" onClick={exportPng}><ArrowDownToLine/>Export PNG</button><button className="share-button" onClick={share}><Share2/>Share</button><div className="top-divider action-divider"/><button className="avatar-button" aria-label="Log in">JD</button></div></header>
    <div className="workspace"><aside className="tools-panel"><div className="panel-label">TOOLS <span>⌘K</span></div><div className="tool-grid">{tools.map(t=><button key={t.id} onClick={()=>setTool(t.id)} className={`tool-button ${tool===t.id?"selected":""}`} aria-label={`${t.label} (${t.key})`} title={`${t.label} · ${t.key}`} aria-pressed={tool===t.id}><t.icon/><span>{t.label}</span><kbd>{t.key}</kbd></button>)}</div><div className="tool-separator"/><div className="setting-block"><div className="setting-heading"><span>Stroke</span><span className="setting-value">{width}px</span></div><input aria-label="Stroke width" type="range" min="1" max="16" value={width} onChange={e=>setWidth(Number(e.target.value))}/><div className="range-labels"><span>Fine</span><span>Bold</span></div></div><div className="tool-separator"/><div className="setting-block"><div className="setting-heading"><span>Color</span><span className="color-hex">{color.toUpperCase()}</span></div><div className="swatches">{swatches.map(c=><button key={c} className={`swatch ${color===c?"active":""}`} style={{backgroundColor:c}} title={c} aria-label={`Choose ${c}`} aria-pressed={color===c} onClick={()=>setColor(c)}/>)}</div><label className="custom-color"><span className="custom-color-dot" style={{backgroundColor:color}}/><span>Custom color</span><input type="color" value={color} onChange={e=>setColor(e.target.value)} aria-label="Choose custom color"/></label></div><div className="tool-spacer"/><div className="canvas-actions"><button className="canvas-action" onClick={()=>setZoom(z=>Math.max(50,z-10))}><Minus/>Zoom out</button><button className="canvas-action" onClick={()=>setZoom(100)}><RotateCcw/>Reset view</button><button className="canvas-action clear-action" onClick={()=>{commit([],"Cleared");notify("Canvas cleared")}}><X/>Clear canvas</button></div><div className="help-hint"><CircleHelp/><span>Need a hand?</span><kbd>?</kbd></div></aside>
    <section className="canvas-area" aria-label="Drawing canvas"><div className="canvas-toolbar"><div className="canvas-breadcrumb"><span className="crumb-muted">My projects</span><span className="breadcrumb-slash">/</span><span>Untitled canvas</span><span className="canvas-tag">DRAFT</span></div><div className="canvas-controls"><span className="live-indicator"><i/>LIVE</span><button className="icon-button" aria-label="Fit canvas" title="Fit canvas"><Hand/></button><span className="control-divider"/><button className="zoom-button" onClick={()=>setZoom(z=>Math.max(50,z-10))} aria-label="Zoom out"><Minus/></button><span className="zoom-text">{zoom}%</span><button className="zoom-button" onClick={()=>setZoom(z=>Math.min(150,z+10))} aria-label="Zoom in"><Plus/></button></div></div><div className="canvas-stage"><div className="canvas-paper" style={{transform:`scale(${zoom/100})`}}><svg ref={svgRef} className="drawing-canvas" viewBox="0 0 920 600" role="img" aria-label="Interactive drawing canvas. Draw with the selected tool."><defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#2b303d"/></pattern></defs><rect width="920" height="600" fill="url(#dots)"/><g>{visible.map(s=><DrawShape key={s.id} shape={s}/>)}{draft&&<DrawShape shape={draft}/>}</g><rect width="920" height="600" fill="transparent" style={{cursor:tool==="pen"?"crosshair":tool==="eraser"?"cell":"crosshair",touchAction:"none"}} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}/></svg><div className="canvas-corner top-left"/><div className="canvas-corner top-right"/><div className="canvas-corner bottom-left"/><div className="canvas-corner bottom-right"/></div><div className="stage-hint"><span className="hint-icon"><MousePointer2/></span><span>Click and drag to draw</span><kbd>⌘</kbd><kbd>Z</kbd><span className="hint-undo">to undo</span></div><div className="stage-coords">X 842&nbsp;&nbsp; Y 316</div></div><div className="canvas-footer"><div className="footer-left"><span className="footer-icon"><Layers2/></span><span>{visible.length} objects</span><span className="footer-sep"/><span>Canvas · 1920 × 1080</span></div><div className="footer-right"><span className="cloud-sync"><Cloud/>{saved?"Saved locally":"Saving…"}</span><button className="icon-button" aria-label="More canvas options"><ChevronDown/></button></div></div></section>
    <HistoryPanel versions={versions} current={current} onSelect={restore} onCheckpoint={()=>{commit(shapes,"Checkpoint");notify("Checkpoint saved")}}/></div><footer className="statusbar"><div className="status-left"><span className="status-light"/><span>READY</span><span className="status-divider"/><span>Version <b>{activeVersion.id}</b></span><span className="status-divider"/><span>Tool <b>{tool[0].toUpperCase()+tool.slice(1)}</b></span></div><div className="status-right"><span>{visible.length} shapes</span><span className="status-divider"/><span>{zoom}%</span><span className="status-divider"/><button aria-label="Keyboard shortcuts"><kbd>⌘</kbd><span>Shortcuts</span></button></div></footer>{toast&&<div className="toast" role="status"><Check/>{toast}</div>}</main>
}
export default function Page(){return <DrawingStudio/>}
