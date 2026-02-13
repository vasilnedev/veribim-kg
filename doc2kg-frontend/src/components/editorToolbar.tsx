import { Flex, Button } from "@chakra-ui/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Toaster, toaster } from "@/components/ui/toaster"
import { useMemo, useEffect, useCallback } from "react"

export default function EditorToolbar() {
  const queryClient = useQueryClient()
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity })
  const { data: unsavedContent } = useQuery({ queryKey: ['unsavedContent'], staleTime: Infinity })
  const { data: originalContent } = useQuery({ queryKey: ['documentText', docId], staleTime: Infinity })
  const { data: selectedText } = useQuery({ queryKey: ['selectedText'], staleTime: Infinity })
  const { data: selectionRange } = useQuery({ queryKey: ['selectionRange'], staleTime: Infinity })
  const { data: isPdfFolded } = useQuery({ queryKey: ['isPdfFolded'], initialData: false, staleTime: Infinity })

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
        method: 'GET',
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
    </Flex>
  )
}