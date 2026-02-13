import { Box, Center, Text } from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { WheelEvent } from "react"
import { useEffect, useRef, useState } from "react"
import * as fabric from "fabric"

export default function RangesView() {
  const queryClient = useQueryClient()
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity })
  const { data: page } = useQuery({ queryKey: ['page'], initialData: 1, staleTime: Infinity })
  const { data: pages } = useQuery({ queryKey: ['pages'], staleTime: Infinity, enabled: false })
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const { data: ranges } = useQuery({
    queryKey: ['ranges', docId],
    queryFn: () =>
      fetch(`/doc2kg-backend/document/${docId}/ranges`).then((res) => res.json()),
    enabled: !!docId,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        setContainerSize({ width, height })
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [docId])

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current)
    setFabricCanvas(canvas)

    return () => {
      canvas.dispose()
      setFabricCanvas(null)
    }
  }, [canvasRef, docId])

  useEffect(() => {
    if (!fabricCanvas || !docId || !page || containerSize.width === 0 || containerSize.height === 0) return

    const handleModified = (e: any) => {
      const target = e.target
      if (!target || typeof target.rangeIndex !== 'number') return

      const canvasWidth = fabricCanvas.width
      const canvasHeight = fabricCanvas.height
      if (!canvasWidth || !canvasHeight) return

      const scaleX = target.scaleX || 1
      const scaleY = target.scaleY || 1
      const width = (target.width || 0) * scaleX
      const height = (target.height || 0) * scaleY
      const left = target.left || 0
      const top = target.top || 0

      const newRange = [
        left / canvasWidth,
        top / canvasHeight,
        (left + width) / canvasWidth,
        (top + height) / canvasHeight
      ]

      queryClient.setQueryData(['ranges', docId], (oldData: any) => {
        if (!oldData) return oldData
        const newData = { ...oldData }
        const pageRanges = [...(newData[String(page)] || [])]
        pageRanges[target.rangeIndex] = newRange
        newData[String(page)] = pageRanges
        return newData
      })
    }

    const updateSelection = () => {
      const activeObject = fabricCanvas.getActiveObject()
      const index = activeObject ? (activeObject as any).rangeIndex : null
      queryClient.setQueryData(['selectedRangeIndex'], index)
    }

    fabricCanvas.on('object:modified', handleModified)
    fabricCanvas.on('selection:created', updateSelection)
    fabricCanvas.on('selection:updated', updateSelection)
    fabricCanvas.on('selection:cleared', updateSelection)

    const imageUrl = `/doc2kg-backend/document/${docId}/page/${page}`
    
    fabric.FabricImage.fromURL(imageUrl).then((img) => {
      if (!img) return

      const { width: clientWidth, height: clientHeight } = containerSize
      const imgWidth = img.width || 0
      const imgHeight = img.height || 0
      
      if (imgWidth === 0 || imgHeight === 0) return

      const activeObject = fabricCanvas.getActiveObject()
      const activeIndex = activeObject ? (activeObject as any).rangeIndex : null

      const scale = Math.min(
        clientWidth / imgWidth,
        clientHeight / imgHeight
      )

      const scaledWidth = imgWidth * scale
      const scaledHeight = imgHeight * scale

      fabricCanvas.setDimensions({ width: scaledWidth, height: scaledHeight })
      fabricCanvas.clear()
      fabricCanvas.backgroundImage = undefined
      
      img.set({
        scaleX: scale,
        scaleY: scale,
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false
      })
      
      fabricCanvas.add(img)

      if (ranges && ranges[String(page)]) {
        ranges[String(page)].forEach((range: number[], index: number) => {
          const [left, top, right, bottom] = range
          const rect = new fabric.Rect({
            left: left * scaledWidth,
            top: top * scaledHeight,
            width: (right - left) * scaledWidth,
            height: (bottom - top) * scaledHeight,
            fill: 'rgba(0, 255, 0, 0.3)',
            stroke: 'green',
            strokeWidth: 2,
            selectable: true,
            originX: 'left',
            originY: 'top',
          })
          ;(rect as any).rangeIndex = index
          fabricCanvas.add(rect)
          if (index === activeIndex) {
            fabricCanvas.setActiveObject(rect)
          }
        })
      }
      fabricCanvas.renderAll()
    })

    return () => {
      fabricCanvas.off('object:modified', handleModified)
      fabricCanvas.off('selection:created', updateSelection)
      fabricCanvas.off('selection:updated', updateSelection)
      fabricCanvas.off('selection:cleared', updateSelection)
    }
  }, [docId, page, ranges, fabricCanvas, containerSize, queryClient])

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (e.deltaY > 0) {
      queryClient.setQueryData(['page'], (p: number) => Math.min(Number(pages || 1), p + 1))
    } else {
      queryClient.setQueryData(['page'], (p: number) => Math.max(1, p - 1))
    }
  }

  if (!docId) {
    return <Center h="full"><Text>No document selected</Text></Center>
  }

  return (
    <Box ref={containerRef} w="full" h="full" p={4} bg="gray.100" overflow="hidden" onWheel={handleWheel}>
      <Center h="full">
        <canvas ref={canvasRef} />
      </Center>
    </Box>
  )
}