import { Flex, Button, Dialog, Box, Heading, Text, VStack } from "@chakra-ui/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Toaster, toaster } from "@/components/ui/toaster"
import { useMemo, useEffect, useCallback, useState } from "react"

export default function EditorToolbar() {
  const queryClient = useQueryClient()
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity })
  const { data: unsavedContent } = useQuery({ queryKey: ['unsavedContent'], staleTime: Infinity })
  const { data: originalContent } = useQuery({ queryKey: ['documentText', docId], staleTime: Infinity })
  const { data: selectedText } = useQuery({ queryKey: ['selectedText'], staleTime: Infinity })
  const { data: selectionRange } = useQuery({ queryKey: ['selectionRange'], staleTime: Infinity })
  const { data: isPdfFolded } = useQuery({ queryKey: ['isPdfFolded'], initialData: false, staleTime: Infinity })
  const [dialogData, setDialogData] = useState<{ title: string; data: any } | null>(null)

  const isDirty = useMemo(() => {
    if (typeof unsavedContent !== 'string' || typeof originalContent !== 'string') return false
    return unsavedContent !== originalContent
  }, [unsavedContent, originalContent])

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

  const extractMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/doc2kg-backend/document/${docId}/extract`, {
        method: 'PUT',
      })
      if (!res.ok) throw new Error('Failed to extract text')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['unsavedContent'], data.text)
      queryClient.invalidateQueries({ queryKey: ['documentText', docId] })
      toaster.create({
        title: "Text extracted",
        type: "success",
      })
    },
    onError: () => {
      toaster.create({
        title: "Failed to extract text",
        type: "error",
      })
    },
  })

  const testGraphMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/doc2kg-backend/document/${docId}/graphtest`, {
        method: 'PUT'
      })
      const data = await res.json()
      if (!res.ok) throw data
      return data
    },
    onSuccess: (data) => {
      setDialogData({ title: 'Graph Test Successful', data: {errors: data.errors }})
    },
    onError: (error: any) => {
      setDialogData({ title: 'Graph Test Failed', data: error })
    },
  })

  const handleDeleteAll = () => {
    if (typeof selectedText === 'string' && selectedText && typeof unsavedContent === 'string') {
      const newContent = unsavedContent.replaceAll(selectedText, '')
      queryClient.setQueryData(['unsavedContent'], newContent)
    }
  }

  const handleJoinLines = useCallback(() => {
    if (typeof unsavedContent === 'string' && selectionRange) {
      const range = selectionRange as { from: number, to: number }
      const text = unsavedContent.substring(range.from, range.to)
      const newText = text.replace(/\n/g, ' ')
      const newContent = unsavedContent.substring(0, range.from) + newText + unsavedContent.substring(range.to)
      queryClient.setQueryData(['unsavedContent'], newContent)
    }
  }, [unsavedContent, selectionRange, queryClient])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault()
        handleJoinLines()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleJoinLines])

  const handleToggleFold = () => {
    queryClient.setQueryData(['isPdfFolded'], (old?: boolean) => !old)
  }

  return (
    <>
      <Flex w="full" p={4} borderBottomWidth="1px" alignItems="center" gap={4}>
        <Toaster />
        <Button onClick={() => extractMutation.mutate()} loading={extractMutation.isPending} disabled={!docId} >
          Extract
        </Button>
        <Button onClick={handleToggleFold} ml="auto">{isPdfFolded ? "Unfold" : "Fold"}</Button>
        <Button onClick={handleDeleteAll} disabled={!selectedText}>
          Delete All
        </Button>
        <Button onClick={handleJoinLines} disabled={!selectedText}>
          Join Lines
        </Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!docId} colorPalette={isDirty ? "blue" : undefined}>
          Save
        </Button>
        <Button onClick={() => testGraphMutation.mutate()} loading={testGraphMutation.isPending} disabled={!docId}>
          Test
        </Button>
      </Flex>
      <Dialog.Root open={!!dialogData} onOpenChange={(e) => !e.open && setDialogData(null)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{dialogData?.title}</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              {dialogData?.data && (dialogData.data.errors || dialogData.data.error_messages || dialogData.data.messages) ? (
                <>
                  {dialogData.data.error && <Text mb={2} fontWeight="bold">{dialogData.data.error}</Text>}
                  {dialogData.data.errors && (
                    <Box mb={4}>
                      <Heading size="sm">Errors:</Heading>
                      <Text as="pre" p={2} whiteSpace="pre-wrap">{JSON.stringify(dialogData.data.errors, null, 2)}</Text>
                    </Box>
                  )}
                  {(dialogData.data.error_messages || dialogData.data.messages) && (
                    <Box>
                      <Heading size="sm">Messages:</Heading>
                      <Text as="pre" p={2} whiteSpace="pre-wrap">{dialogData.data.error_messages || dialogData.data.messages}</Text>
                    </Box>
                  )}
                </>
              ) : (
                <Text as="pre" p={2} whiteSpace="pre-wrap" overflowY="auto" maxHeight="60vh">{JSON.stringify(dialogData?.data, null, 2)}</Text>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => setDialogData(null)}>Close</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  )
}