import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Box, Text, Stack, Image, Card } from "@chakra-ui/react"

export default function ExplorerList() {
  const queryClient = useQueryClient()
  const { data: selectedDocId } = useQuery({ queryKey: ['docId'], staleTime: Infinity })
  const { isLoading, error, data } = useQuery({
    queryKey: ['documents'],
    queryFn: () =>
      fetch('/doc2kg-backend/documents').then((res) =>
        res.json(),
      ),
  })

  if (isLoading) return <Box p={4}><Text>Loading...</Text></Box>

  if (error) return <Box p={4}><Text>An error has occurred: {error.message}</Text></Box>

  return (
    <Box w="full" h="full" p={4} borderRightWidth="1px" overflowY="auto">
      <Stack gap={4} direction="row" wrap="wrap">
        {data?.map((doc: any, index: number) => (
          <Card.Root
            key={index}
            w="300px"
            borderWidth={selectedDocId === doc.doc_id ? "3px" : undefined}
            borderColor={selectedDocId === doc.doc_id ? "green.500" : undefined}
            cursor="pointer"
            onClick={() => queryClient.setQueryData(['docId'], doc.doc_id)}
          >
            <Card.Body>
              <Image src={`/doc2kg-backend/document/${doc.doc_id}/page/1`} alt="Page 1" mb={2} />
              <Text css={{
                display: '-webkit-box',
                WebkitLineClamp: '3',
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {doc.text?.slice(0, 100)}
              </Text>
            </Card.Body>
          </Card.Root>
        ))}
      </Stack>
    </Box>
  )
}