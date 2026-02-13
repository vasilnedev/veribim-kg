import { Flex, Text, Button, HStack } from "@chakra-ui/react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Toaster, toaster } from "@/components/ui/toaster"
import { useMemo } from "react"

export default function RangesToolbar() {
  const queryClient = useQueryClient()
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity })
  const { data: pages } = useQuery({ queryKey: ['pages'], staleTime: Infinity, enabled: false })
  const { data: page } = useQuery({ queryKey: ['page'], initialData: 1, staleTime: Infinity })
  const { data: selectedRangeIndex } = useQuery({ queryKey: ['selectedRangeIndex'], staleTime: Infinity })

  const { data: ranges } = useQuery({
    queryKey: ['ranges', docId],
    queryFn: () =>
      fetch(`/doc2kg-backend/document/${docId}/ranges`).then((res) => res.json()),
    enabled: !!docId,
    staleTime: Infinity,
  })

  const { data: serverRanges } = useQuery({
    queryKey: ['serverRanges', docId],
    queryFn: () =>
      fetch(`/doc2kg-backend/document/${docId}/ranges`).then((res) => res.json()),
    enabled: !!docId,
    staleTime: Infinity,
  })

  const isDirty = useMemo(() => {
    if (!ranges || !serverRanges) return false
    return JSON.stringify(ranges) !== JSON.stringify(serverRanges)
  }, [ranges, serverRanges])

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/doc2kg-backend/document/${docId}/ranges`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(ranges),
      })
      if (!res.ok) throw new Error('Failed to save ranges')
    },
    onSuccess: () => {
      queryClient.setQueryData(['serverRanges', docId], JSON.parse(JSON.stringify(ranges)))
      toaster.create({
        title: "Ranges saved",
        type: "success",
      })
    },
    onError: () => {
      toaster.create({
        title: "Failed to save ranges",
        type: "error",
      })
    },
  })

  const handleAddRange = () => {
    if (!docId || !page) return
    queryClient.setQueryData(['ranges', docId], (oldData: any) => {
      const newData = oldData ? { ...oldData } : {}
      const pageKey = String(page)
      const pageRanges = newData[pageKey] ? [...newData[pageKey]] : []
      pageRanges.push([0.25, 0.25, 0.75, 0.75])
      newData[pageKey] = pageRanges
      return newData
    })
  }

  const handleDeleteRange = () => {
    if (!docId || !page || selectedRangeIndex === null || selectedRangeIndex === undefined) return
    
    queryClient.setQueryData(['ranges', docId], (oldData: any) => {
      const newData = oldData ? { ...oldData } : {}
      const pageKey = String(page)
      if (!newData[pageKey]) return newData
      
      const pageRanges = [...newData[pageKey]]
      if (typeof selectedRangeIndex === 'number' && selectedRangeIndex >= 0 && selectedRangeIndex < pageRanges.length) {
        pageRanges.splice(selectedRangeIndex, 1)
        newData[pageKey] = pageRanges
      }
      return newData
    })
    queryClient.setQueryData(['selectedRangeIndex'], null)
  }

  return (
    <Flex w="full" p={4} borderBottomWidth="1px" alignItems="center" justifyContent="space-between">
      <Toaster />
      <HStack gap={4}>
        <Button 
          onClick={() => queryClient.setQueryData(['page'], (p: number) => Math.max(1, p - 1))} 
          disabled={page <= 1}
        >
          Previous
        </Button>
        <Text>Page {page} {pages ? `of ${pages}` : ''}</Text>
        <Button 
          onClick={() => queryClient.setQueryData(['page'], (p: number) => Math.min(Number(pages), p + 1))} 
          disabled={!pages || page >= Number(pages)}
        >
          Next
        </Button>
      </HStack>
      <HStack gap={4}>
        <Button onClick={handleAddRange} disabled={!docId}>
          Add Range
        </Button>
        <Button onClick={handleDeleteRange} disabled={!docId || selectedRangeIndex === null || selectedRangeIndex === undefined} colorPalette="red">
          Delete
        </Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!docId || !ranges} colorPalette={isDirty ? "blue" : undefined}>
          Save
        </Button>
      </HStack>
    </Flex>
  )
}