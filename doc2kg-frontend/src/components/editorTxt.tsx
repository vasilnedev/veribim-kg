import { Box, Text } from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import CodeMirror, { EditorView } from "@uiw/react-codemirror"
import { abcdef } from "@uiw/codemirror-themes-all"
import { useEffect } from "react"

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
        extensions={[EditorView.lineWrapping]}
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