import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Control {
  label: string
  value?: number | string | boolean
  min?: number
  max?: number
  step?: number
  type?: 'range' | 'checkbox' | 'select'
  options?: string[]
  noRestart?: boolean
}

type ConfigState = Record<string, number | string | boolean>

const algorithms = [
  { value: 'squiggle.js', label: 'Squiggle' },
  { value: 'squiggleLeftRight.js', label: 'Squiggle Left/Right' },
  { value: 'spiral.js', label: 'Spiral' },
  { value: 'polyspiral.js', label: 'Polygon Spiral' },
  { value: 'sawtooth.js', label: 'Sawtooth' },
  { value: 'stipple.js', label: 'Stipples' },
  { value: 'delaunay.js', label: 'Delaunay' },
  { value: 'linedraw.js', label: 'Linedraw' },
  { value: 'mosaic.js', label: 'Mosaic' },
  { value: 'subline.js', label: 'Subline' },
  { value: 'springs.js', label: 'Springs' },
  { value: 'waves.js', label: 'Waves' },
  { value: 'needles.js', label: 'Needles' },
  { value: 'implode.js', label: 'Implode' },
  { value: 'halftone.js', label: 'Halftone' },
  { value: 'boxes.js', label: 'Boxes' },
  { value: 'dots.js', label: 'Dots' },
  { value: 'jaggy.js', label: 'Jaggy' },
  { value: 'longwave.js', label: 'Longwave' },
  { value: 'linescan.js', label: 'Linescan' },
  { value: 'woven.js', label: 'Woven' },
  { value: 'peano.js', label: 'Peano' },
  { value: 'margins.js', label: 'Margins' },
]

const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

function App() {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const configRef = useRef<ConfigState>({})

  const [controls, setControls] = useState<Control[]>([])
  const [config, setConfig] = useState<ConfigState>({})
  const [selectedAlgo, setSelectedAlgo] = useState(algorithms[0].value)
  const [status, setStatus] = useState('')
  const [svgPath, setSvgPath] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingControls, setIsLoadingControls] = useState(true)
  const [activeTab, setActiveTab] = useState<'image' | 'webcam'>('image')
  const [imageSet, setImageSet] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: DEFAULT_WIDTH / 2, y: DEFAULT_HEIGHT / 2 })

  const viewBox = useMemo(() => {
    const width = Number(configRef.current.width) || canvasSize.width
    const height = Number(configRef.current.height) || canvasSize.height
    return `0 0 ${width} ${height}`
  }, [canvasSize.height, canvasSize.width])

  const resetSvg = useCallback(
    (width: number, height: number) => {
      configRef.current.width = width
      configRef.current.height = height
      setConfig({ ...configRef.current })
      setSvgPath('')
    },
    [setConfig]
  )

  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    canvas.width = canvasSize.width
    canvas.height = canvasSize.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)
    ctx.drawImage(
      img,
      offset.x - scale * img.width * 0.5,
      offset.y - scale * img.height * 0.5,
      scale * img.width,
      scale * img.height
    )
  }, [canvasSize.height, canvasSize.width, offset.x, offset.y, scale])

  useEffect(() => {
    drawPreview()
  }, [drawPreview])

  const stopWebcam = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      stopWebcam()
    }
  }, [stopWebcam])

  const mergeConfig = useCallback(
    (controlsList: Control[]) => {
      const nextConfig: ConfigState = { ...configRef.current }
      controlsList.forEach((control) => {
        if (control.type === 'checkbox') {
          if (nextConfig[control.label] === undefined) {
            nextConfig[control.label] = Boolean(control.value ?? control['default'] ?? false)
          }
        } else if (control.type === 'select') {
          if (nextConfig[control.label] === undefined) {
            nextConfig[control.label] = control.value ?? control.options?.[0] ?? ''
          }
        } else {
          if (nextConfig[control.label] === undefined) {
            const numericValue = typeof control.value === 'number' ? control.value : Number(control.value ?? 0)
            nextConfig[control.label] = numericValue
          }
        }
      })
      configRef.current = nextConfig
      setConfig(nextConfig)
    },
    [setConfig]
  )

  const handleWorkerMessage = useCallback(
    (event: MessageEvent) => {
      const [type, data] = event.data

      if (type === 'sliders') {
        setIsLoadingControls(false)
        setControls(data)
        mergeConfig(data)
        setStatus('')
        if (imageSet) {
          const width = Number(configRef.current.width) || canvasSize.width
          const height = Number(configRef.current.height) || canvasSize.height
          resetSvg(width, height)
          setTimeout(() => processImage(), 0)
        }
      } else if (type === 'msg') {
        setStatus(String(data))
      } else if (type === 'dbg') {
        console.debug(data)
      } else if (type === 'svg-path') {
        setSvgPath(String(data))
        setIsProcessing(false)
      }
    },
    [canvasSize.height, canvasSize.width, imageSet, mergeConfig, resetSvg]
  )

  const loadWorker = useCallback(
    (source: string) => {
      setIsLoadingControls(true)
      setStatus('Loading algorithm...')
      workerRef.current?.terminate()
      const worker = new Worker(`/workers/${source}`)
      worker.onmessage = handleWorkerMessage
      workerRef.current = worker
    },
    [handleWorkerMessage]
  )

  useEffect(() => {
    loadWorker(selectedAlgo)
  }, [loadWorker, selectedAlgo])

  const processImage = useCallback(() => {
    if (!imageSet) return
    const workingCanvas = workingCanvasRef.current
    if (!workingCanvas) return
    const ctx = workingCanvas.getContext('2d')
    if (!ctx) return

    const width = workingCanvas.width
    const height = workingCanvas.height
    const currentConfig = { ...configRef.current, width, height }
    configRef.current = currentConfig
    setConfig(currentConfig)
    const imageData = ctx.getImageData(0, 0, width, height)
    setIsProcessing(true)
    workerRef.current?.postMessage([currentConfig, imageData])
  }, [imageSet])

  const handleControlChange = useCallback(
    (control: Control, value: number | string | boolean) => {
      const nextConfig = { ...configRef.current, [control.label]: value }
      configRef.current = nextConfig
      setConfig(nextConfig)
      if (control.noRestart) {
        workerRef.current?.postMessage([nextConfig])
      } else {
        processImage()
      }
    },
    [processImage]
  )

  const handleFile = useCallback(
    (file: File) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        imageRef.current = img
        URL.revokeObjectURL(objectUrl)

        let width = canvasSize.width
        let height = canvasSize.height
        if (img.width > width || img.height > height) {
          height = Math.round((width * img.height) / img.width)
        } else if (img.width > 10 && img.height > 10) {
          width = img.width
          height = img.height
        }

        setCanvasSize({ width, height })
        const nextScale = Math.min(height / img.height, width / img.width)
        setScale(nextScale)
        setOffset({ x: width / 2, y: height / 2 })
        setImageSet(false)
        drawPreview()
      }
      img.src = objectUrl
    },
    [canvasSize.height, canvasSize.width, drawPreview]
  )

  const handleWheel: React.WheelEventHandler<HTMLCanvasElement> = (event) => {
    event.preventDefault()
    event.stopPropagation()

    const canvas = previewCanvasRef.current
    if (!canvas || !imageRef.current) return

    const rect = canvas.getBoundingClientRect()
    const csc = canvasSize.width / rect.width
    const deltaScale = event.deltaY > 0 ? 1.1 : 0.9
    const newScale = scale * deltaScale
    const centerX = offset.x
    const centerY = offset.y

    const newOffset = {
      x: ((centerX - canvasSize.width / 2) / scale) * newScale + canvasSize.width / 2,
      y: ((centerY - canvasSize.height / 2) / scale) * newScale + canvasSize.height / 2,
    }

    setScale(newScale)
    setOffset(newOffset)
  }

  const handlePointerDown: React.PointerEventHandler<HTMLCanvasElement> = (event) => {
    const startX = event.clientX
    const startY = event.clientY
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect()
    const csc = canvasSize.width / rect.width
    let lastX = startX
    let lastY = startY

    const move = (e: PointerEvent) => {
      setOffset((current) => ({
        x: current.x + (e.clientX - lastX) * csc,
        y: current.y + (e.clientY - lastY) * csc,
      }))
      lastX = e.clientX
      lastY = e.clientY
    }

    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const copyPreviewToWorkingCanvas = useCallback(() => {
    const preview = previewCanvasRef.current
    const working = workingCanvasRef.current
    if (!preview || !working) return false
    working.width = canvasSize.width
    working.height = canvasSize.height
    const ctx = working.getContext('2d')
    if (!ctx) return false
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, working.width, working.height)
    ctx.drawImage(preview, 0, 0)
    return true
  }, [canvasSize.height, canvasSize.width])

  const handleUseImage = useCallback(() => {
    if (!imageRef.current) return
    if (!copyPreviewToWorkingCanvas()) return
    setImageSet(true)
    resetSvg(canvasSize.width, canvasSize.height)
    processImage()
  }, [canvasSize.height, canvasSize.width, copyPreviewToWorkingCanvas, processImage, resetSvg])

  const handleSnapshot = useCallback(() => {
    const video = videoRef.current
    const working = workingCanvasRef.current
    if (!video || !working) return
    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) return
    working.width = width
    working.height = height
    const ctx = working.getContext('2d')
    ctx?.drawImage(video, 0, 0)
    setCanvasSize({ width, height })

    const snapshotImage = new Image()
    snapshotImage.onload = () => {
      imageRef.current = snapshotImage
      setScale(Math.min(height / snapshotImage.height, width / snapshotImage.width))
      setOffset({ x: width / 2, y: height / 2 })
      drawPreview()
    }
    snapshotImage.src = working.toDataURL('image/png')

    setImageSet(true)
    resetSvg(width, height)
    processImage()
  }, [drawPreview, processImage, resetSvg])

  const startWebcam = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Webcam not available in this browser')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 800 } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setStatus('Webcam ready')
      }
    } catch (error) {
      console.error(error)
      setStatus('Unable to start webcam')
    }
  }, [])

  const handleTabChange = (value: string) => {
    if (value === 'webcam') {
      startWebcam()
    } else {
      stopWebcam()
    }
    setActiveTab(value as 'image' | 'webcam')
  }

  const handleCanvasSizeChange = (dimension: 'width' | 'height', value: number) => {
    setCanvasSize((prev) => ({ ...prev, [dimension]: value }))
  }

  const downloadSvg = () => {
    const width = Number(configRef.current.width) || canvasSize.width
    const height = Number(configRef.current.height) || canvasSize.height
    const background = configRef.current.Inverted ? 'black' : 'white'
    const stroke = configRef.current.Inverted ? 'white' : 'black'
    const path = svgPath || ''
    const svgString = `<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:${background}">` +
      `<path d="${path}" style="stroke-width:2px; fill:none; stroke:${stroke}" /></svg>`

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const downloadLink = document.createElement('a')
    downloadLink.href = URL.createObjectURL(blob)
    downloadLink.download = selectedAlgo.replace('.js', '_') + Date.now() + '.svg'
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }

  const backgroundColor = configRef.current.Inverted ? '#0f172a' : '#ffffff'
  const strokeColor = configRef.current.Inverted ? '#f8fafc' : '#0f172a'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Plotterfun</p>
            <h1 className="text-2xl font-semibold text-slate-900">Vector art playground</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full gap-6 px-6 py-6 lg:grid-cols-[420px_1fr]">
        <section className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="image">Image</TabsTrigger>
                  <TabsTrigger value="webcam">Webcam</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="width">Canvas width</Label>
                      <Input
                        id="width"
                        type="number"
                        min={10}
                        value={canvasSize.width}
                        onChange={(e) => handleCanvasSizeChange('width', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="height">Canvas height</Label>
                      <Input
                        id="height"
                        type="number"
                        min={10}
                        value={canvasSize.height}
                        onChange={(e) => handleCanvasSizeChange('height', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <TabsContent value="image">
                <div className="space-y-3">
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 p-3">
                    <canvas
                      ref={previewCanvasRef}
                      className="w-full cursor-grab rounded-md border border-slate-200 bg-white"
                      onWheel={handleWheel}
                      onPointerDown={handlePointerDown}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button asChild variant="secondary">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFile(file)
                          }}
                        />
                        Select image
                      </label>
                    </Button>
                    <Button onClick={handleUseImage} disabled={!imageRef.current}>
                      Use image
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="webcam">
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                    <video ref={videoRef} autoPlay playsInline muted className="block w-full" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => (videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause())}>
                      {videoRef.current?.paused ? 'Play' : 'Pause'}
                    </Button>
                    <Button onClick={handleSnapshot}>Use image</Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <div className="space-y-1">
              <Label>Algorithm</Label>
              <Select value={selectedAlgo} onValueChange={(value) => setSelectedAlgo(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an algorithm" />
                </SelectTrigger>
                <SelectContent>
                  {algorithms.map((algo) => (
                    <SelectItem key={algo.value} value={algo.value}>
                      {algo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Parameters</h2>
                {isLoadingControls && <span className="text-xs text-slate-500">Loading...</span>}
              </div>
              <div className="space-y-3">
                {controls.length === 0 && !isLoadingControls && (
                  <p className="text-sm text-slate-500">No parameters for this algorithm.</p>
                )}
                {controls.map((control) => (
                  <div key={control.label} className="space-y-2 rounded-md border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-slate-800">{control.label}</Label>
                      {control.type !== 'checkbox' && control.type !== 'select' && (
                        <Input
                          className="w-24"
                          type="number"
                          value={String(config[control.label] ?? control.value ?? '')}
                          onChange={(e) => handleControlChange(control, Number(e.target.value))}
                        />
                      )}
                    </div>

                    {control.type === 'checkbox' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={Boolean(config[control.label])}
                          onChange={(e) => handleControlChange(control, e.target.checked)}
                        />
                        <span className="text-sm text-slate-700">Toggle</span>
                      </div>
                    ) : control.type === 'select' ? (
                      <Select
                        value={String(config[control.label])}
                        onValueChange={(value) => handleControlChange(control, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {control.options?.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <input
                        type="range"
                        min={control.min ?? 0}
                        max={control.max ?? 100}
                        step={control.step ?? 1}
                        value={Number(config[control.label] ?? control.value ?? 0)}
                        onChange={(e) => handleControlChange(control, Number(e.target.value))}
                        className="w-full accent-slate-900"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={processImage} disabled={!imageSet || isLoadingControls}>
                {isProcessing ? 'Processing...' : 'Run algorithm'}
              </Button>
              <span className="text-sm text-slate-500">{status}</span>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Preview</p>
              <p className="text-sm text-slate-700">Drag the image to position it and scroll to zoom.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={downloadSvg} disabled={!svgPath}>
                Download SVG
              </Button>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {configRef.current.width || canvasSize.width} × {configRef.current.height || canvasSize.height}
              </div>
            </div>
          </div>
          <div className="relative w-full overflow-auto rounded-md border border-slate-100 bg-slate-50 p-4">
            <svg
              className="h-full w-full min-h-[320px]"
              viewBox={viewBox}
              style={{ background: backgroundColor }}
            >
              <path d={svgPath} stroke={strokeColor} strokeWidth={2} fill="none" />
            </svg>
            <canvas ref={workingCanvasRef} className="hidden" />
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
