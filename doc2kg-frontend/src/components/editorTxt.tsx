import { Box, Text } from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import CodeMirror, { EditorView, ViewPlugin, Decoration } from "@uiw/react-codemirror"
import { abcdef } from "@uiw/codemirror-themes-all"
import { useEffect } from "react"

const hangingIndentPlugin = ViewPlugin.fromClass(class {
  decorations: any

  constructor(view: EditorView) {
    this.decorations = this.getDecorations(view)
  }

  update(update: any) {
    if (update.docChanged || update.viewportChanged)
      this.decorations = this.getDecorations(update.view)
  }

  getDecorations(view: EditorView) {
    const decorations = []
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos)
        const text = line.text
        const match = text.match(/^\s+/)
        if (match) {
          const indent = match[0]
          let width = 0
          for (let i = 0; i < indent.length; i++) {
             width += (indent[i] === '\t') ? 4 : 1
          }
          decorations.push(Decoration.line({
            attributes: { style: `padding-left: ${width}ch; text-indent: -${width}ch;` }
          }).range(line.from))
        }
        pos = line.to + 1
      }
    }
    return Decoration.set(decorations)
  }
}, {
  decorations: v => v.decorations
})

const indentGuidePlugin = ViewPlugin.fromClass(class {
  decorations: any

  constructor(view: EditorView) {
    this.decorations = this.getDecorations(view)
  }

  update(update: any) {
    if (update.docChanged || update.viewportChanged)
      this.decorations = this.getDecorations(update.view)
  }

  getDecorations(view: EditorView) {
    const decorations = []
    const tabSize = view.state.tabSize
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos)
        const text = line.text
        const match = text.match(/^\s+/)
        if (match) {
          const indent = match[0]
          decorations.push(Decoration.mark({
            class: "cm-indent-guides",
            attributes: { style: `--indent-size: ${tabSize}ch` }
          }).range(line.from, line.from + indent.length))
        }
        pos = line.to + 1
      }
    }
    return Decoration.set(decorations)
  }
}, {
  decorations: v => v.decorations
})

export default function EditorTxt() {
  const queryClient = useQueryClient()
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity })
  const { data: unsavedContent } = useQuery({ queryKey: ['unsavedContent'], staleTime: Infinity })

  const { data, isLoading, error } = useQuery({
    queryKey: ['documentText', docId],
    queryFn: () =>
      fetch(`/doc2kg-backend/document/${docId}/plaintext`).then((res) =>
        res.text(),
      ),
    enabled: !!docId,
  })

  useEffect(() => {
    if (data !== undefined) {
      queryClient.setQueryData(['unsavedContent'], data)
    }
  }, [data, queryClient])

  if (isLoading) return <Box p={4}><Text>Loading...</Text></Box>
  if (error) return <Box p={4}><Text>An error occurred</Text></Box>

  return (
    <Box w="full" h="full" overflowY="auto">
      <CodeMirror
        value={typeof unsavedContent === 'string' ? unsavedContent : ""}
        height="100%"
        theme={abcdef}
        extensions={[
          EditorView.lineWrapping,
          hangingIndentPlugin,
          indentGuidePlugin,
          EditorView.theme({
            "& .cm-indent-guides": {
              backgroundImage: "linear-gradient(to right, rgba(128, 128, 128, 0.3) 1px, transparent 1px)",
              backgroundSize: "var(--indent-size, 4ch) 100%",
              backgroundRepeat: "repeat-x",
            },
          }),
        ]}
        onChange={(val) => {
          queryClient.setQueryData(['unsavedContent'], val)
        }}
        onUpdate={(viewUpdate) => {
          if (viewUpdate.selectionSet) {
            const range = viewUpdate.state.selection.main
            const text = viewUpdate.state.sliceDoc(range.from, range.to)
            queryClient.setQueryData(['selectedText'], text)
            queryClient.setQueryData(['selectionRange'], { from: range.from, to: range.to })
          }
        }}
      />
    </Box>
  )
}
