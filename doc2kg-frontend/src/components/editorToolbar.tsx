import { Flex, Text, Button } from "@chakra-ui/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Toaster, toaster } from "@/components/ui/toaster"

export default function EditorToolbar() {
  const queryClient = useQueryClient()
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity })
  const { data: unsavedContent } = useQuery({ queryKey: ['unsavedContent'], staleTime: Infinity })
  const { data: selectedText } = useQuery({ queryKey: ['selectedText'], staleTime: Infinity })
  const { data: selectionRange } = useQuery({ queryKey: ['selectionRange'], staleTime: Infinity })

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/doc2kg-backend/document/${docId}/plaintext`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: unsavedContent as string,
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: () => {
      console.log('Document saved')
      queryClient.invalidateQueries({ queryKey: ['documentText', docId] })
      toaster.create({
        title: "Document saved",
        type: "success",
      })
    },
    onError: () => {
      toaster.create({
        title: "Failed to save",
        type: "error",
      })
    },
  })

  const handleDeleteAll = () => {
    if (typeof selectedText === 'string' && selectedText && typeof unsavedContent === 'string') {
      const newContent = unsavedContent.replaceAll(selectedText, '')
      queryClient.setQueryData(['unsavedContent'], newContent)
    }
  }

  const handleJoinLines = () => {
    if (typeof unsavedContent === 'string' && selectionRange) {
      const range = selectionRange as { from: number, to: number }
      const text = unsavedContent.substring(range.from, range.to)
      const lastIndex = text.lastIndexOf('\n')
      if (lastIndex !== -1) {
        const newText = text.substring(0, lastIndex).replace(/\n/g, '') + text.substring(lastIndex)
        const newContent = unsavedContent.substring(0, range.from) + newText + unsavedContent.substring(range.to)
        queryClient.setQueryData(['unsavedContent'], newContent)
      }
    }
  }

  return (
    <Flex w="full" p={4} borderBottomWidth="1px" alignItems="center" gap={4}>
      <Toaster />
      <Text>Selected Document ID: {String(docId)}</Text>  
      <Button onClick={handleDeleteAll} disabled={!selectedText} ml="auto">
        Delete All
      </Button>
      <Button onClick={handleJoinLines} disabled={!selectedText}>
        Join Lines
      </Button>
      <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!docId}>
        Save
      </Button>
    </Flex>
  )
}